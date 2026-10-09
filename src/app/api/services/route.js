import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getNextSortOrder } from '@/lib/sortOrder';

const makeSlug = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

let serviceSchemaMigration;
const ensureServiceSchema = () => {
  if (!serviceSchemaMigration) {
    serviceSchemaMigration = db.query("ALTER TABLE services ADD COLUMN IF NOT EXISTS price VARCHAR(100) DEFAULT ''")
      .catch((error) => { serviceSchemaMigration = null; throw error; });
  }
  return serviceSchemaMigration;
};

export async function GET(request) {
  try {
    await ensureServiceSchema();
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    let services = await db.query('SELECT * FROM services WHERE is_active = $1 OR $2 = true', [true, all]);
    services.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return NextResponse.json({ services });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureServiceSchema();
    const body = await request.json();
    const { title, description = '', image_url = '', icon = '', price = '', sort_order = 0, is_active = true } = body;

    if (!title) {
      return NextResponse.json({ error: 'Service title is required' }, { status: 400 });
    }

    const slug = makeSlug(title);
    const existing = await db.query('SELECT * FROM services WHERE slug = $1', [slug]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'A service with this title already exists' }, { status: 400 });
    }

    const serviceSort = is_active ? (Number(sort_order) > 0 ? Number(sort_order) : await getNextSortOrder('services')) : 0;
    if (serviceSort > 0) {
      const duplicates = await db.query('SELECT id FROM services WHERE sort_order = $1 AND is_active = true', [serviceSort]);
      if (duplicates.length > 0) {
        return NextResponse.json({ error: `Sort number ${serviceSort} is already used by another published service. Unpublish that service or choose a different number.` }, { status: 400 });
      }
    }

    const service = await db.insert('services', {
      title,
      slug,
      description,
      image_url,
      icon,
      price,
      sort_order: serviceSort,
      is_active: is_active,
    });

    return NextResponse.json({ success: true, service });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await ensureServiceSchema();
    const body = await request.json();
    const { id, title, description, image_url, icon, price, sort_order, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Service ID required' }, { status: 400 });
    }

    const existing = await db.get('services', Number(id));
    if (!existing) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Unpublishing frees the sort number so another item can use it.
    const nextActive = is_active !== undefined ? Boolean(is_active) : Boolean(existing.is_active);
    const nextSortOrder = nextActive ? (sort_order !== undefined ? Number(sort_order) : Number(existing.sort_order) || 0) : null;

    if (nextActive && nextSortOrder > 0) {
      const duplicates = await db.query('SELECT id FROM services WHERE sort_order = $1 AND is_active = true AND id != $2', [nextSortOrder, Number(id)]);
      if (duplicates.length > 0) {
        return NextResponse.json({ error: `Sort number ${nextSortOrder} is already used by another published service. Unpublish that service or choose a different number.` }, { status: 400 });
      }
    }

    const updateData = {};
    if (title !== undefined) {
      updateData.title = title;
      updateData.slug = makeSlug(title);
      const duplicate = await db.query('SELECT * FROM services WHERE slug = $1 AND id != $2', [updateData.slug, Number(id)]);
      if (duplicate.length > 0) {
        return NextResponse.json({ error: 'A service with this title already exists' }, { status: 400 });
      }
    }
    if (description !== undefined) updateData.description = description;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (icon !== undefined) updateData.icon = icon;
    if (price !== undefined) updateData.price = price;
    updateData.sort_order = nextSortOrder;
    updateData.is_active = nextActive;
    updateData.updated_at = new Date().toISOString();

    await db.update('services', Number(id), updateData);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    await ensureServiceSchema();
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'Service ID required' }, { status: 400 });
    }

    await db.delete('services', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
