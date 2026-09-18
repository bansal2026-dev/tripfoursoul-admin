import { NextResponse } from 'next/server';
import db from '@/lib/db';

// In-memory cache for IP Geo lookups (to prevent redundant lookups)
const geoCache = new Map();

// Helper to determine if IP is private/local
const isPrivateIp = (ip) => {
  if (!ip) return true;
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.31.') ||
    ip.startsWith('fe80:')
  );
};

// Lightweight GeoIP resolver
const resolveGeo = async (ip, reqHeaders) => {
  // 1. Check Cloudflare / Vercel headers first
  const cloudCountry = reqHeaders.get('cf-ipcountry') || reqHeaders.get('x-vercel-ip-country') || reqHeaders.get('x-country');
  const cloudCity = reqHeaders.get('x-vercel-ip-city') || reqHeaders.get('cf-ipcity');
  const cloudRegion = reqHeaders.get('x-vercel-ip-country-region') || reqHeaders.get('x-region');

  if (cloudCountry && cloudCountry !== 'XX' && cloudCountry !== 'T1') {
    return {
      country: cloudCountry,
      city: cloudCity ? decodeURIComponent(cloudCity) : '',
      region: cloudRegion ? decodeURIComponent(cloudRegion) : '',
      countryCode: cloudCountry,
    };
  }

  if (isPrivateIp(ip)) {
    return {
      country: 'Local Network',
      city: 'Development',
      region: 'Local',
      countryCode: 'DEV',
    };
  }

  // 2. Check in-memory cache
  if (geoCache.has(ip)) {
    return geoCache.get(ip);
  }

  // 3. Fallback to free ip-api lookup with short timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success') {
        const geo = {
          country: data.country || 'Unknown',
          city: data.city || '',
          region: data.regionName || '',
          countryCode: data.countryCode || '',
        };
        // Cache for 1 hour
        geoCache.set(ip, geo);
        if (geoCache.size > 2000) {
          const firstKey = geoCache.keys().next().value;
          geoCache.delete(firstKey);
        }
        return geo;
      }
    }
  } catch (err) {
    // Non-blocking geo failure
  }

  return { country: 'Unknown', city: '', region: '', countryCode: '' };
};

// Parse User Agent
const parseUserAgent = (uaString = '') => {
  const ua = uaString.toLowerCase();

  // Device
  let deviceType = 'desktop';
  if (/ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobi|ipod|iphone|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    deviceType = 'mobile';
  }

  // OS
  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/cros/i.test(ua)) os = 'Chrome OS';

  // Browser
  let browser = 'Other';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/msie|trident/i.test(ua)) browser = 'Internet Explorer';

  return { deviceType, os, browser };
};

// Parse Referrer Domain & UTMs
const parseReferrer = (referrerUrl = '', pageUrl = '') => {
  let domain = 'Direct';
  if (referrerUrl) {
    try {
      const parsed = new URL(referrerUrl);
      domain = parsed.hostname.replace(/^www\./, '');
      if (domain.includes('google.')) domain = 'Google Search';
      else if (domain.includes('instagram.')) domain = 'Instagram';
      else if (domain.includes('facebook.')) domain = 'Facebook';
      else if (domain.includes('youtube.')) domain = 'YouTube';
      else if (domain.includes('linkedin.')) domain = 'LinkedIn';
      else if (domain.includes('twitter.') || domain.includes('t.co') || domain.includes('x.com')) domain = 'Twitter / X';
      else if (domain.includes('bing.')) domain = 'Bing';
      else if (domain.includes('yahoo.')) domain = 'Yahoo';
      else if (domain.includes('whatsapp.')) domain = 'WhatsApp';
    } catch {
      domain = 'External Referral';
    }
  }

  let utm_source = '';
  let utm_medium = '';
  let utm_campaign = '';

  try {
    const full = pageUrl ? new URL(pageUrl, 'http://localhost') : null;
    if (full) {
      utm_source = full.searchParams.get('utm_source') || '';
      utm_medium = full.searchParams.get('utm_medium') || '';
      utm_campaign = full.searchParams.get('utm_campaign') || '';
    }
  } catch {}

  return { domain, utm_source, utm_medium, utm_campaign };
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      visitor_id,
      session_id,
      type = 'pageview',
      page_path = '/',
      page_title = '',
      referrer = '',
      screen_resolution = '',
      event_name = '',
      event_data = null,
      duration_seconds = 0,
      cookie_consent = 'essential',
    } = body;

    if (!visitor_id || !session_id) {
      return NextResponse.json({ success: false, error: 'Missing visitor_id or session_id' }, { status: 400, headers: CORS_HEADERS });
    }

    const reqHeaders = request.headers;
    const rawIp = reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                  reqHeaders.get('x-real-ip') ||
                  reqHeaders.get('cf-connecting-ip') ||
                  '127.0.0.1';

    const userAgent = reqHeaders.get('user-agent') || '';
    const { deviceType, os, browser } = parseUserAgent(userAgent);
    const geo = await resolveGeo(rawIp, reqHeaders);
    const { domain: referrerDomain, utm_source, utm_medium, utm_campaign } = parseReferrer(referrer, page_path);

    // Upsert session
    const existingSession = await db.query(
      'SELECT id, total_pages, duration_seconds FROM visitor_sessions WHERE session_id = $1 LIMIT 1',
      [session_id]
    );

    if (existingSession && existingSession.length > 0) {
      // Update existing session
      const current = existingSession[0];
      const newTotal = type === 'pageview' ? Number(current.total_pages || 1) + 1 : Number(current.total_pages || 1);
      const newDuration = Math.max(Number(current.duration_seconds || 0), Number(duration_seconds || 0));

      await db.query(
        `UPDATE visitor_sessions 
         SET last_page = $1, total_pages = $2, duration_seconds = $3, 
             cookie_consent = COALESCE(NULLIF($4, ''), cookie_consent),
             updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $5`,
        [page_path, newTotal, newDuration, cookie_consent, session_id]
      );
    } else {
      // Create new session
      await db.query(
        `INSERT INTO visitor_sessions 
         (session_id, visitor_id, ip_address, user_agent, browser, os, device_type, screen_resolution, 
          country, city, region, country_code, referrer, referrer_domain, utm_source, utm_medium, utm_campaign, 
          first_page, last_page, total_pages, duration_seconds, cookie_consent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
         ON CONFLICT (session_id) DO NOTHING`,
        [
          session_id,
          visitor_id,
          rawIp,
          userAgent,
          browser,
          os,
          deviceType,
          screen_resolution,
          geo.country,
          geo.city,
          geo.region,
          geo.countryCode,
          referrer,
          referrerDomain,
          utm_source,
          utm_medium,
          utm_campaign,
          page_path,
          page_path,
          1,
          duration_seconds || 0,
          cookie_consent,
        ]
      );
    }

    // Insert Pageview
    if (type === 'pageview') {
      await db.query(
        `INSERT INTO visitor_pageviews (session_id, visitor_id, page_path, page_title, referrer, duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [session_id, visitor_id, page_path, page_title, referrer, duration_seconds || 0]
      );
    }

    // Insert Event
    if (type === 'event' && event_name) {
      await db.query(
        `INSERT INTO visitor_events (session_id, visitor_id, event_name, event_data, page_path)
         VALUES ($1, $2, $3, $4, $5)`,
        [session_id, visitor_id, event_name, event_data ? JSON.stringify(event_data) : null, page_path]
      );
    }

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Analytics track ingestion error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}

