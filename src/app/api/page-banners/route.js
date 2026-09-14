import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageKey = searchParams.get('page_key') || searchParams.get('key');
    const id = searchParams.get('id');

    if (pageKey) {
      const banners = await db.query('SELECT * FROM page_banners WHERE page_key = $1', [pageKey]);
      return NextResponse.json({ banner: banners[0] || null });
    }

    if (id) {
      const banner = await db.get('page_banners', Number(id));
      return NextResponse.json({ banner: banner || null });
    }

    const banners = await db.query('SELECT * FROM page_banners ORDER BY id ASC');
    return NextResponse.json({ banners });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { page_key, heading = '', subheading = '', background_image, image_url, is_active } = body;
    // Support both field names: background_image (correct) and image_url (legacy)
    const bgImage = background_image || image_url || '';

    if (!page_key) {
      return NextResponse.json({ error: 'Page key is required' }, { status: 400 });
    }

    // Check if banner exists for this page
    const existing = await db.query('SELECT * FROM page_banners WHERE page_key = $1', [page_key]);
    if (existing.length > 0) {
      await db.update('page_banners', existing[0].id, {
        heading: heading || '',
        subheading: subheading || '',
        background_image: bgImage,
        is_active: is_active !== undefined ? is_active : true,
      });
      return NextResponse.json({ success: true, message: 'Banner updated successfully' });
    }

    await db.insert('page_banners', {
      page_key,
      heading: heading || '',
      subheading: subheading || '',
      background_image: bgImage,
      is_active: is_active !== undefined ? is_active : true,
    });
    return NextResponse.json({ success: true, message: 'Banner created successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, heading = '', subheading = '', background_image, image_url, is_active } = body;
    const bgImage = background_image || image_url || '';

    if (!id) {
      return NextResponse.json({ error: 'Banner ID is required' }, { status: 400 });
    }

    await db.update('page_banners', id, {
      heading: heading || '',
      subheading: subheading || '',
      background_image: bgImage,
      is_active,
    });
    return NextResponse.json({ success: true, message: 'Banner updated successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const pageKey = searchParams.get('page_key') || searchParams.get('key');

    if (id) {
      await db.delete('page_banners', Number(id));
      return NextResponse.json({ success: true, message: 'Banner deleted successfully' });
    }

    if (pageKey) {
      await db.query('DELETE FROM page_banners WHERE page_key = $1', [pageKey]);
      return NextResponse.json({ success: true, message: 'Banner deleted successfully' });
    }

    return NextResponse.json({ error: 'Banner ID or page_key required' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
