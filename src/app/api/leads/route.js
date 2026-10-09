import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

const ensureLeadsTableUncached = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) DEFAULT '',
    middle_name VARCHAR(255) DEFAULT '',
    last_name VARCHAR(255) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    phone VARCHAR(100) DEFAULT '',
    destination VARCHAR(255) DEFAULT '',
    package_name VARCHAR(255) DEFAULT '',
    date VARCHAR(100) DEFAULT '',
    travel_start_date DATE,
    travel_end_date DATE,
    travel_style VARCHAR(255) DEFAULT '',
    trip_budget VARCHAR(255) DEFAULT '',
    receive_offers BOOLEAN DEFAULT false,
    travellers VARCHAR(100) DEFAULT '',
    traveler_count INTEGER,
    travel_month VARCHAR(20) DEFAULT '',
    selected_additional_services JSONB DEFAULT '[]'::jsonb,
    message TEXT DEFAULT '',
    additional_information TEXT DEFAULT '',
    coupon_code VARCHAR(100) DEFAULT '',
    offer_duration TEXT,
    offer_duration_days INTEGER,
    source VARCHAR(100) DEFAULT 'website',
    service_type VARCHAR(100) DEFAULT '',
    source_page VARCHAR(500) DEFAULT '',
    selected_package VARCHAR(255) DEFAULT '',
    landing_url TEXT DEFAULT '',
    utm_source VARCHAR(255) DEFAULT '',
    utm_medium VARCHAR(255) DEFAULT '',
    utm_campaign VARCHAR(255) DEFAULT '',
    utm_term VARCHAR(255) DEFAULT '',
    utm_content VARCHAR(255) DEFAULT '',
    gclid VARCHAR(500) DEFAULT '',
    nationality VARCHAR(255) DEFAULT '',
    travel_intent VARCHAR(255) DEFAULT '',
    financial_sponsorship_info TEXT DEFAULT '',
    date_of_birth DATE,
    travel_date DATE,
    gender VARCHAR(20) DEFAULT '',
    marital_status VARCHAR(100) DEFAULT '',
    status VARCHAR(30) DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
  `);

  // Existing deployments may already have the original leads table.
  await db.query(`
    ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS middle_name VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS travel_start_date DATE,
      ADD COLUMN IF NOT EXISTS travel_end_date DATE,
      ADD COLUMN IF NOT EXISTS travel_style VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS trip_budget VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS receive_offers BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS traveler_count INTEGER,
      ADD COLUMN IF NOT EXISTS travel_month VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS selected_additional_services JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS additional_information TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100) DEFAULT '',
      ADD COLUMN IF NOT EXISTS offer_duration TEXT,
      ADD COLUMN IF NOT EXISTS offer_duration_days INTEGER,
      ADD COLUMN IF NOT EXISTS service_type VARCHAR(100) DEFAULT '',
      ADD COLUMN IF NOT EXISTS source_page VARCHAR(500) DEFAULT '',
      ADD COLUMN IF NOT EXISTS selected_package VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS landing_url TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS utm_term VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS utm_content VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS gclid VARCHAR(500) DEFAULT '',
      ADD COLUMN IF NOT EXISTS nationality VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS travel_intent VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS financial_sponsorship_info TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS date_of_birth DATE,
      ADD COLUMN IF NOT EXISTS travel_date DATE,
      ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS marital_status VARCHAR(100) DEFAULT ''
  `);
  await db.query('CREATE INDEX IF NOT EXISTS idx_leads_created_at_id ON leads (created_at DESC, id DESC)');
};

let leadsSchemaMigration;
const ensureLeadsTable = () => {
  if (!leadsSchemaMigration) {
    leadsSchemaMigration = ensureLeadsTableUncached().catch((error) => {
      leadsSchemaMigration = null;
      throw error;
    });
  }
  return leadsSchemaMigration;
};

const value = (item) => String(item ?? '').trim();
const booleanValue = (item) => item === true || item === 1 || item === '1' || ['true', 'yes', 'on'].includes(String(item).toLowerCase());
const messageLeadLabels = ['Travel start date', 'Travel end date', 'Travel style', 'Trip budget', 'Receive offers'];
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const messageLeadLabelsPattern = messageLeadLabels.map(escapeRegex).join('|');

const messageField = (message, label) => {
  const pattern = new RegExp(`${escapeRegex(label)}\\s*:\\s*([\\s\\S]*?)(?=\\s*(?:${messageLeadLabelsPattern})\\s*:|$)`, 'i');
  return value(message.match(pattern)?.[1]);
};

const cleanMessage = (message) => messageLeadLabels.reduce(
  (cleaned, label) => cleaned.replace(
    new RegExp(`${escapeRegex(label)}\\s*:\\s*[\\s\\S]*?(?=\\s*(?:${messageLeadLabelsPattern})\\s*:|$)`, 'gi'),
    ''
  ),
  value(message)
).replace(/\s{2,}/g, ' ').trim();

const parsedMessageDetails = (message) => ({
  travel_start_date: messageField(message, 'Travel start date'),
  travel_end_date: messageField(message, 'Travel end date'),
  travel_style: messageField(message, 'Travel style'),
  trip_budget: messageField(message, 'Trip budget'),
  receive_offers: messageField(message, 'Receive offers'),
});

const validDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
const validDurationDays = (days) => {
  const item = value(days);
  return /^\d+$/.test(item) && Number(item) > 0 ? Number(item) : null;
};
const normalizeSelectedServices = (services) => {
  if (!Array.isArray(services)) return [];
  return services.slice(0, 50).map((service) => {
    if (service && typeof service === 'object') {
      return {
        id: Number.isInteger(Number(service.id)) ? Number(service.id) : null,
        title: value(service.title || service.name).slice(0, 255),
      };
    }
    return { id: null, title: value(service).slice(0, 255) };
  }).filter((service) => service.title);
};
const travelServiceTypes = new Set(['private-transfer', 'travel-insurance', 'visa']);
const normalizedServiceType = (serviceType) => {
  const s = value(serviceType).toLowerCase().replace(/[\s_]+/g, '-');
  if (s.includes('visa')) return 'visa';
  if (s.includes('insurance')) return 'travel-insurance';
  if (s.includes('transfer')) return 'private-transfer';
  if (s.includes('custom') || s.includes('planning')) return 'custom-travel-planning';
  if (s.includes('esim')) return 'esim';
  return s;
};
const hydrateMessageDetails = (lead) => {
  const parsed = parsedMessageDetails(lead.message);
  return {
    ...lead,
    travel_start_date: lead.travel_start_date || validDate(parsed.travel_start_date),
    travel_end_date: lead.travel_end_date || validDate(parsed.travel_end_date),
    travel_style: lead.travel_style || parsed.travel_style,
    trip_budget: lead.trip_budget || parsed.trip_budget,
    receive_offers: lead.receive_offers ?? booleanValue(parsed.receive_offers),
    message: cleanMessage(lead.message),
  };
};
const hasValidLeadsApiKey = (request) => {
  const expectedKey = process.env.LEADS_API_KEY;
  return Boolean(expectedKey) && request.headers.get('x-leads-api-key') === expectedKey;
};

export async function GET() {
  try {
    await ensureLeadsTable();
    const leads = await db.query('SELECT * FROM leads ORDER BY created_at DESC, id DESC', [], { processImages: false });
    return NextResponse.json({ leads: leads.map(hydrateMessageDetails) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // The middleware applies the same check before this route runs. Keeping it
    // here protects the endpoint if it is invoked outside that proxy layer.
    if (!hasValidLeadsApiKey(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await ensureLeadsTable();
    const body = await request.json();
    const rawMessage = value(body.message);
    const parsed = parsedMessageDetails(rawMessage);
    const firstName = value(body.first_name);
    const middleName = value(body.middle_name);
    const lastName = value(body.last_name);
    const serviceType = normalizedServiceType(body.service_type || body.service || body.service_name || (body.source_page?.includes('service=') ? body.source_page.split('service=')[1]?.split('&')[0] : ''));
    const destination = value(body.destination || body.country_visiting || body.country_to_visit || body.country_you_are_visiting || body.country_you_want_to_visit);
    const nationality = value(body.nationality || body.citizenship);
    const travelIntent = value(body.travel_intent);
    const financialSponsorshipInfo = value(body.financial_sponsorship_info || body.financial_info);
    const dateOfBirth = validDate(value(body.date_of_birth));
    const travelDate = validDate(value(body.travel_date));
    const gender = value(body.gender).toUpperCase();
    const additionalInfo = value(body.additional_information) || cleanMessage(rawMessage);
    const finalMessage = cleanMessage(rawMessage) || additionalInfo;
    const lead = {
      // Keep the legacy full-name field for existing admin views and integrations.
      name: value(body.name) || [firstName, middleName, lastName].filter(Boolean).join(' '),
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      email: value(body.email),
      phone: value(body.phone),
      destination,
      package_name: value(body.package_name || body.package),
      date: value(body.date) || value(body.travel_start_date),
      travel_start_date: validDate(value(body.travel_start_date)) || validDate(parsed.travel_start_date),
      travel_end_date: validDate(value(body.travel_end_date)) || validDate(parsed.travel_end_date),
      travel_style: value(body.travel_style) || parsed.travel_style,
      trip_budget: value(body.trip_budget) || parsed.trip_budget,
      receive_offers: Object.prototype.hasOwnProperty.call(body, 'receive_offers') ? booleanValue(body.receive_offers) : booleanValue(parsed.receive_offers),
      travellers: value(body.travellers),
      traveler_count: Number.isInteger(Number(body.traveler_count ?? body.travellers)) && Number(body.traveler_count ?? body.travellers) > 0
        ? Number(body.traveler_count ?? body.travellers)
        : null,
      travel_month: value(body.travel_month).slice(0, 20),
      selected_additional_services: normalizeSelectedServices(body.selected_additional_services || body.selected_services),
      message: finalMessage,
      additional_information: additionalInfo,
      coupon_code: value(body.coupon_code || body.coupon).toUpperCase(),
      offer_duration: value(body.offer_duration) || null,
      offer_duration_days: validDurationDays(body.offer_duration_days),
      source: value(body.source) || 'website',
      service_type: serviceType,
      source_page: value(body.source_page || body.source_url || body.page),
      selected_package: value(body.selected_package || body.package_name || body.package),
      landing_url: value(body.landing_url),
      utm_source: value(body.utm_source),
      utm_medium: value(body.utm_medium),
      utm_campaign: value(body.utm_campaign),
      utm_term: value(body.utm_term),
      utm_content: value(body.utm_content),
      gclid: value(body.gclid),
      nationality,
      travel_intent: travelIntent,
      financial_sponsorship_info: financialSponsorshipInfo,
      date_of_birth: dateOfBirth,
      travel_date: travelDate,
      gender,
      marital_status: value(body.marital_status),
      status: 'new',
    };
    if (!lead.name || !lead.email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }
    if (travelServiceTypes.has(serviceType)) {
      const missing = [];
      if (!firstName) missing.push('first_name');
      if (!lastName) missing.push('last_name');
      if (!lead.email) missing.push('email');
      if (!lead.phone) missing.push('phone');
      if (!nationality) missing.push('nationality');
      if (!destination) missing.push('destination');
      if (serviceType !== 'private-transfer' && !travelIntent) missing.push('travel_intent');
      if (serviceType !== 'private-transfer' && !financialSponsorshipInfo) missing.push('financial_sponsorship_info');
      if (serviceType === 'travel-insurance' && !travelDate) missing.push('travel_date');
      if (serviceType === 'visa' && !dateOfBirth) missing.push('date_of_birth');
      if (serviceType === 'visa' && !['M', 'F'].includes(gender)) missing.push('gender');
      if (serviceType === 'visa' && !lead.marital_status) missing.push('marital_status');
      if (missing.length) {
        return NextResponse.json({ error: `Missing or invalid required fields: ${missing.join(', ')}` }, { status: 400 });
      }
    }
    const saved = await db.insert('leads', lead);
    return NextResponse.json({ success: true, lead: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await ensureLeadsTable();
    const { id, status } = await request.json();
    if (!id || !['new', 'contacted', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Lead id and valid status are required' }, { status: 400 });
    }
    await db.query('UPDATE leads SET status = $1 WHERE id = $2', [status, Number(id)]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const payload = verifyToken(getTokenFromCookies(request));
    if (!payload || payload.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can delete leads' }, { status: 403 });
    }
    await ensureLeadsTable();
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'Lead id is required' }, { status: 400 });
    await db.delete('leads', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
