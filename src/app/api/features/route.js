import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getNextSortOrder } from '@/lib/sortOrder';

export const dynamic = 'force-dynamic';

// GET - Fetch all features
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const features = await db.query('SELECT * FROM features WHERE is_active = $1 OR $2 = true', [true, all]);
    features.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return NextResponse.json({ features });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create feature
export async function POST(request) {
  try {
    const body = await request.json();
    const { icon, title, description, sort_order, image_url } = body;

    const featureSort = Number(sort_order) > 0 ? Number(sort_order) : await getNextSortOrder('features');
    if (featureSort > 0) {
      const duplicates = await db.query('SELECT id FROM features WHERE sort_order = $1 AND is_active = true', [featureSort]);
      if (duplicates.length > 0) {
        return NextResponse.json({ error: `Sort number ${featureSort} is already used by another published feature. Unpublish that feature or choose a different number.` }, { status: 400 });
      }
    }

    const feature = await db.insert('features', {
      icon: icon || '',
      title,
      description,
      image_url: image_url || '',
      sort_order: featureSort,
      is_active: true
    });
    return NextResponse.json({ success: true, id: feature.id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update feature
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, icon, title, description, is_active, sort_order, image_url } = body;

    const nextActive = is_active !== undefined ? Boolean(is_active) : true;
    const nextSortOrder = nextActive ? (Number(sort_order) || 0) : null;

    if (nextActive && nextSortOrder > 0) {
      const duplicates = await db.query('SELECT id FROM features WHERE sort_order = $1 AND is_active = true AND id != $2', [nextSortOrder, Number(id)]);
      if (duplicates.length > 0) {
        return NextResponse.json({ error: `Sort number ${nextSortOrder} is already used by another published feature. Unpublish that feature or choose a different number.` }, { status: 400 });
      }
    }

    const updateData = { is_active };
    if (icon !== undefined) updateData.icon = icon;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (sort_order !== undefined) updateData.sort_order = nextSortOrder;

    await db.update('features', id, updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete feature
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    await db.delete('features', Number(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
