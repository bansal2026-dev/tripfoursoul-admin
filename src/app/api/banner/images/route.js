import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getNextSortOrder } from '@/lib/sortOrder';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    try {
      await db.query(`ALTER TABLE banner_images ADD COLUMN IF NOT EXISTS mobile_image_url TEXT DEFAULT ''`);
    } catch {}

    const images = await db.query('SELECT * FROM banner_images');
    images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return NextResponse.json({ images });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const existing = await db.query('SELECT COUNT(*) as count FROM banner_images');
    const count = parseInt(existing[0]?.count || 0, 10);
    if (count >= 5) {
      return NextResponse.json({ error: 'Maximum 5 banner images allowed. Please delete an existing slide first.' }, { status: 400 });
    }

    const { image_url, mobile_image_url, sort_order } = await request.json();
    const image = await db.insert('banner_images', {
      image_url,
      mobile_image_url: mobile_image_url || '',
      sort_order: Number(sort_order) > 0 ? Number(sort_order) : await getNextSortOrder('banner_images', false),
      is_active: true,
    });
    return NextResponse.json({ success: true, id: image.id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, image_url, mobile_image_url, sort_order, is_active } = await request.json();
    if (!id) return NextResponse.json({ error: 'Image ID is required' }, { status: 400 });
    const updateData = {};
    if (image_url !== undefined) updateData.image_url = image_url;
    if (mobile_image_url !== undefined) updateData.mobile_image_url = mobile_image_url;
    if (sort_order !== undefined) updateData.sort_order = Number(sort_order);
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);
    await db.update('banner_images', Number(id), updateData);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    await db.delete('banner_images', Number(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}