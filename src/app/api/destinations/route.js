import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getNextSortOrder } from '@/lib/sortOrder';

const makeSlug = (value = '') => String(value).trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const MAX_DESTINATION_IMAGES = 10;

const hasTooManyGalleryImages = (images) => Array.isArray(images) && images.length > MAX_DESTINATION_IMAGES;

const parseGalleryImages = (value) => {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
};

// Older deployments can predate the Spiritual Escape fields. Keep the API
// usable while those databases are upgraded, without requiring a manual setup
// request before an admin can create a destination.
let destinationSchemaMigration;
const ensureDestinationSchema = () => {
  if (!destinationSchemaMigration) {
    destinationSchemaMigration = Promise.all([
      db.query('ALTER TABLE destinations ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false'),
      db.query('ALTER TABLE destinations ADD COLUMN IF NOT EXISTS is_spiritual BOOLEAN DEFAULT false'),
      db.query("ALTER TABLE destinations ADD COLUMN IF NOT EXISTS price_usd VARCHAR(50) DEFAULT ''"),
      db.query("ALTER TABLE destinations ADD COLUMN IF NOT EXISTS price_inr VARCHAR(50) DEFAULT ''"),
      db.query("ALTER TABLE destinations ADD COLUMN IF NOT EXISTS price_eur VARCHAR(50) DEFAULT ''"),
      db.query('ALTER TABLE destinations ADD COLUMN IF NOT EXISTS gallery_images JSONB'),
    ]).catch((error) => {
      // Allow a retry on a transient database failure instead of caching it.
      destinationSchemaMigration = null;
      throw error;
    });
  }
  return destinationSchemaMigration;
};

// GET - Fetch all destinations
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');
    const destinationId = searchParams.get('id');

    const all = searchParams.get('all') === 'true';
    const summary = searchParams.get('summary') === 'true' || (!all && !destinationId);
    const columns = summary
      ? `id, name, slug,
         regexp_replace(COALESCE(description, ''), 'data:image/[^;]+;base64,[A-Za-z0-9+/=]+', '[embedded image]', 'g') AS description,
         image_url, region, price, price_usd, price_inr, price_eur, sort_order, is_trending, is_spiritual, is_active`
      : '*';
    let destinations = await db.query(
      `SELECT ${columns} FROM destinations WHERE (is_active = $1 OR $2 = true) AND ($3::int IS NULL OR id = $3) ORDER BY sort_order ASC`,
      [true, all, destinationId ? Number(destinationId) : null],
      { processImages: false }
    );

    if (region && region !== 'all') {
      destinations = destinations.filter(d => d.region === region);
    }

    // Full destination requests return gallery_images as an array. Summary
    // list requests intentionally skip this potentially large field.
    destinations = destinations.map((d) => {
      try { d.gallery_images = parseGalleryImages(d.gallery_images); } catch { d.gallery_images = []; }
      return d;
    });

    return NextResponse.json({ destinations });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new destination
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, image_url, gallery_images, region, price, price_usd, price_inr, price_eur, description, sort_order = 0, is_trending = false, is_spiritual = false } = body;

    if (!name?.trim() || !region?.trim()) {
      return NextResponse.json({ error: 'Destination name and region are required' }, { status: 400 });
    }
    if (!image_url?.trim()) {
      return NextResponse.json({ error: 'Destination image is required' }, { status: 400 });
    }
    if (hasTooManyGalleryImages(gallery_images)) {
      return NextResponse.json({ error: `A destination can have a maximum of ${MAX_DESTINATION_IMAGES} images` }, { status: 400 });
    }

    await ensureDestinationSchema();

    // Prevent two active destinations from sharing the same sort number.
    const destinationSort = Number(sort_order) > 0 ? Number(sort_order) : await getNextSortOrder('destinations');
    if (destinationSort > 0) {
      const duplicates = await db.query('SELECT id FROM destinations WHERE sort_order = $1 AND is_active = true', [destinationSort]);
      if (duplicates.length > 0) {
        return NextResponse.json({ error: `Sort number ${destinationSort} is already used by another published destination. Unpublish that destination or choose a different number.` }, { status: 400 });
      }
    }

    const galleryImages = Array.isArray(gallery_images)
      ? gallery_images.map(String).filter(Boolean)
      : [image_url];

    const newDestination = await db.insert('destinations', {
      name,
      slug: makeSlug(name),
      image_url,
      gallery_images: JSON.stringify(galleryImages),
      region,
      price,
      price_usd,
      price_inr,
      price_eur,
      description,
      is_trending: Boolean(is_trending),
      is_spiritual: Boolean(is_spiritual),
      is_active: true,
      sort_order: destinationSort
    });

    return NextResponse.json({
      success: true,
      id: newDestination.id,
      message: 'Destination created successfully'
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, image_url, gallery_images, region, price, price_usd, price_inr, price_eur, description, is_active, sort_order, is_trending, is_spiritual } = body;

    const existing = await db.get('destinations', id);
    if (!existing) return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
    // The image is compulsory: explicitly clearing it is rejected so the user
    // must upload a replacement before saving. Partial updates (e.g. publishing
    // from the list page) that omit image_url are unaffected.
    if (image_url !== undefined && !String(image_url || '').trim()) {
      return NextResponse.json({ error: 'Destination image is required' }, { status: 400 });
    }
    if (hasTooManyGalleryImages(gallery_images)) {
      return NextResponse.json({ error: `A destination can have a maximum of ${MAX_DESTINATION_IMAGES} images` }, { status: 400 });
    }

    // Merge the incoming gallery with the existing one so partial updates (e.g.
    // publish/unpublish from the list page) never wipe out uploaded images.
    const nextGallery = gallery_images !== undefined
      ? (Array.isArray(gallery_images) ? gallery_images.map(String).filter(Boolean) : [])
      : parseGalleryImages(existing.gallery_images);

    await ensureDestinationSchema();
    const shouldCascadeUnpublish = is_active !== undefined && !Boolean(is_active) && Boolean(existing.is_active);

    // Unpublishing frees the sort number so another item can use it.
    const nextActive = is_active !== undefined ? Boolean(is_active) : Boolean(existing.is_active);
    const nextSortOrder = nextActive
      ? (sort_order !== undefined ? Number(sort_order) : Number(existing.sort_order) || 0)
      : null;

    if (nextActive && nextSortOrder > 0) {
      const duplicates = await db.query('SELECT id FROM destinations WHERE sort_order = $1 AND is_active = true AND id != $2', [nextSortOrder, Number(id)]);
      if (duplicates.length > 0) {
        return NextResponse.json({ error: `Sort number ${nextSortOrder} is already used by another published destination. Unpublish that destination or choose a different number.` }, { status: 400 });
      }
    }

    const updated = await db.update('destinations', id, {
      name: name !== undefined ? name : existing.name,
      slug: makeSlug(name !== undefined ? name : existing.name),
      image_url: image_url !== undefined ? image_url : existing.image_url,
      gallery_images: JSON.stringify(nextGallery),
      region: region !== undefined ? region : existing.region,
      price: price !== undefined ? price : existing.price,
      price_usd: price_usd !== undefined ? price_usd : existing.price_usd,
      price_inr: price_inr !== undefined ? price_inr : existing.price_inr,
      price_eur: price_eur !== undefined ? price_eur : existing.price_eur,
      description: description !== undefined ? description : existing.description,
      is_trending: is_trending !== undefined ? Boolean(is_trending) : existing.is_trending,
      is_spiritual: is_spiritual !== undefined ? Boolean(is_spiritual) : existing.is_spiritual,
      is_active: nextActive,
      sort_order: nextSortOrder
    });

    let unpublishedPackageCount = 0;
    if (shouldCascadeUnpublish) {
      const unpublishedPackages = await db.query(
        'UPDATE packages SET is_active = false WHERE destination_id = $1 AND is_active = true RETURNING id',
        [Number(id)]
      );
      unpublishedPackageCount = Array.isArray(unpublishedPackages) ? unpublishedPackages.length : 0;
    }

    return NextResponse.json({
      success: true,
      message: 'Destination updated successfully',
      unpublishedPackageCount,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete destination
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'Destination ID required' }, { status: 400 });
    }

    await db.delete('destinations', id);

    return NextResponse.json({ success: true, message: 'Destination deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
