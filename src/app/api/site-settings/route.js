import { NextResponse } from 'next/server';
import db from '@/lib/db';

const defaults = {
  design: { primary_color: '#0f766e', font_family: 'Inter', content_width: '7xl', section_spacing: 'py-16' },
  services: { enabled: true, heading: 'Other Services', description: '', contact_form_enabled: true, youtube_url: '', items: [] },
  insurance: { enabled: true, heading: 'Travel Insurance', description: '', button_text: 'Enquire now', button_link: '/contact?subject=Travel%20Insurance' },
  cookies: { enabled: true, message: 'We use cookies to improve your experience.', policy_url: '/privacy-policy', accept_text: 'Accept all', reject_text: 'Reject non-essential' },
  crm: { provider: 'none', enabled: false, webhook_url: '', form_mapping: {} },
  google_ads: {
    conversion_id: '', conversion_label: '', enhanced_conversions_enabled: false,
    consent_required: true, consent_mode: 'granted_only',
  },
  social: { facebook: '', instagram: '', linkedin: '', tiktok: '', youtube: '', whatsapp: '' }
};

export async function GET() {
  try {
    const rows = await db.query('SELECT * FROM site_settings');
    const settings = { ...defaults };
    rows.forEach((row) => {
      try {
        // PostgreSQL JSONB returns parsed objects
        settings[row.setting_key] = typeof row.setting_value === 'string' ? JSON.parse(row.setting_value) : row.setting_value;
      } catch {}
    });
    return NextResponse.json({ settings });
  } catch (error) { return NextResponse.json({ settings: defaults, warning: error.message }); }
}

export async function PUT(request) {
  try {
    const { key, value } = await request.json();
    if (!Object.hasOwn(defaults, key) || !value || typeof value !== 'object') return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 });
    const rows = await db.query('SELECT * FROM site_settings WHERE setting_key = $1', [key]);
    // Pass the object directly for PostgreSQL JSONB column
    const data = { setting_key: key, setting_value: value };
    if (rows[0]) await db.update('site_settings', rows[0].id, data); else await db.insert('site_settings', data);
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
