import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '7d';

    let dateCondition = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
    if (range === 'today') {
      dateCondition = "created_at >= CURRENT_DATE";
    } else if (range === '30d') {
      dateCondition = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (range === 'all') {
      dateCondition = "1=1";
    }

    // 1. Overview counts
    const [pageviewsCountRes, uniqueVisitorsRes, sessionsCountRes, avgDurationRes] = await Promise.all([
      db.query(`SELECT COUNT(*) as count FROM visitor_pageviews WHERE ${dateCondition}`),
      db.query(`SELECT COUNT(DISTINCT visitor_id) as count FROM visitor_sessions WHERE ${dateCondition}`),
      db.query(`SELECT COUNT(*) as count FROM visitor_sessions WHERE ${dateCondition}`),
      db.query(`SELECT ROUND(AVG(duration_seconds)) as avg_duration FROM visitor_sessions WHERE ${dateCondition} AND duration_seconds > 0`),
    ]);

    const totalPageviews = parseInt(pageviewsCountRes[0]?.count || 0, 10);
    const uniqueVisitors = parseInt(uniqueVisitorsRes[0]?.count || 0, 10);
    const totalSessions = parseInt(sessionsCountRes[0]?.count || 0, 10);
    const avgDuration = parseInt(avgDurationRes[0]?.avg_duration || 0, 10);

    // 2. Top Visited Pages
    const topPages = await db.query(`
      SELECT page_path, COUNT(*) as views, COUNT(DISTINCT visitor_id) as unique_visitors
      FROM visitor_pageviews
      WHERE ${dateCondition}
      GROUP BY page_path
      ORDER BY views DESC
      LIMIT 10
    `);

    // 3. Traffic Sources / Referrers
    const topReferrers = await db.query(`
      SELECT referrer_domain, COUNT(*) as count
      FROM visitor_sessions
      WHERE ${dateCondition} AND referrer_domain IS NOT NULL AND referrer_domain != ''
      GROUP BY referrer_domain
      ORDER BY count DESC
      LIMIT 8
    `);

    // 4. Device Breakdown
    const deviceBreakdown = await db.query(`
      SELECT device_type, COUNT(*) as count
      FROM visitor_sessions
      WHERE ${dateCondition}
      GROUP BY device_type
      ORDER BY count DESC
    `);

    // 5. Browser Breakdown
    const browserBreakdown = await db.query(`
      SELECT browser, COUNT(*) as count
      FROM visitor_sessions
      WHERE ${dateCondition}
      GROUP BY browser
      ORDER BY count DESC
      LIMIT 6
    `);

    // 6. Top Countries & Cities
    const [topCountries, topCities] = await Promise.all([
      db.query(`
        SELECT country, country_code, COUNT(*) as count
        FROM visitor_sessions
        WHERE ${dateCondition} AND country IS NOT NULL AND country != ''
        GROUP BY country, country_code
        ORDER BY count DESC
        LIMIT 8
      `),
      db.query(`
        SELECT city, country, COUNT(*) as count
        FROM visitor_sessions
        WHERE ${dateCondition} AND city IS NOT NULL AND city != ''
        GROUP BY city, country
        ORDER BY count DESC
        LIMIT 8
      `),
    ]);

    // 7. Interaction Events
    const topEvents = await db.query(`
      SELECT event_name, COUNT(*) as count
      FROM visitor_events
      WHERE ${dateCondition}
      GROUP BY event_name
      ORDER BY count DESC
      LIMIT 8
    `);

    // 8. Recent Visitor Activity Log (Last 50 sessions)
    const recentVisitors = await db.query(`
      SELECT id, session_id, visitor_id, ip_address, browser, os, device_type,
             country, city, region, country_code, referrer_domain, first_page, last_page,
             total_pages, duration_seconds, created_at
      FROM visitor_sessions
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return NextResponse.json({
      success: true,
      stats: {
        totalPageviews,
        uniqueVisitors,
        totalSessions,
        avgDuration,
        topPages,
        topReferrers,
        deviceBreakdown,
        browserBreakdown,
        topCountries,
        topCities,
        topEvents,
        recentVisitors,
      },
    });
  } catch (error) {
    console.error('Analytics stats error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

