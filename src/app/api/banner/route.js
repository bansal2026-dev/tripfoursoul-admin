import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    try {
      await db.query(`ALTER TABLE banner_images ADD COLUMN IF NOT EXISTS mobile_image_url TEXT DEFAULT ''`);
    } catch {}

    const settings = await db.query('SELECT * FROM banner_settings ORDER BY id ASC LIMIT 1');
    const images = await db.query('SELECT * FROM banner_images WHERE is_active = true');
    images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return NextResponse.json({ settings: settings[0] || null, images });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { heading, subtitle, button1_text, button2_text, button2_link } = await request.json();
    const settings = await db.query('SELECT * FROM banner_settings ORDER BY id ASC LIMIT 1');
    if (settings.length > 0) {
      const updated = await db.update('banner_settings', settings[0].id, { heading, subtitle, button1_text, button2_text, button2_link });
      return NextResponse.json({ success: true, settings: updated });
    }
    return NextResponse.json({ success: false, error: 'Banner settings record not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
