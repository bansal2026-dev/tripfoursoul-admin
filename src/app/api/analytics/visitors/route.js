import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    // If sessionId is provided, return the full journey timeline for this specific session
    if (sessionId) {
      const [sessionRes, pageviews, events] = await Promise.all([
        db.query('SELECT * FROM visitor_sessions WHERE session_id = $1 LIMIT 1', [sessionId]),
        db.query('SELECT * FROM visitor_pageviews WHERE session_id = $1 ORDER BY created_at ASC', [sessionId]),
        db.query('SELECT * FROM visitor_events WHERE session_id = $1 ORDER BY created_at ASC', [sessionId]),
      ]);

      return NextResponse.json({
        success: true,
        session: sessionRes[0] || null,
        pageviews: pageviews || [],
        events: events || [],
      });
    }

    // Otherwise, handle paginated list of visitor sessions with filters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const range = searchParams.get('range') || 'all';
    const device = searchParams.get('device') || '';
    const search = (searchParams.get('search') || '').trim();

    const conditions = [];
    const params = [];

    if (range === 'today') {
      conditions.push("created_at >= CURRENT_DATE");
    } else if (range === '7d') {
      conditions.push("created_at >= CURRENT_DATE - INTERVAL '7 days'");
    } else if (range === '30d') {
      conditions.push("created_at >= CURRENT_DATE - INTERVAL '30 days'");
    }

    if (device) {
      params.push(device.toLowerCase());
      conditions.push(`LOWER(device_type) = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const pIdx = params.length;
      conditions.push(`(
        ip_address ILIKE $${pIdx} OR 
        visitor_id ILIKE $${pIdx} OR 
        country ILIKE $${pIdx} OR 
        city ILIKE $${pIdx} OR 
        first_page ILIKE $${pIdx} OR 
        last_page ILIKE $${pIdx} OR 
        referrer_domain ILIKE $${pIdx}
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count query
    const countSql = `SELECT COUNT(*) as total FROM visitor_sessions ${whereClause}`;
    const countRes = await db.query(countSql, params);
    const total = parseInt(countRes[0]?.total || 0, 10);

    // Paginated list query
    const listParams = [...params, limit, offset];
    const listSql = `
      SELECT * FROM visitor_sessions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
    `;
    const visitors = await db.query(listSql, listParams);

    return NextResponse.json({
      success: true,
      visitors: visitors || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Visitors list API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

