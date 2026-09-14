import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getNextSortOrder } from '@/lib/sortOrder';

const makeSlug = (value = '') => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

// contentEditable editors represent an untouched field as markup such as
// `<p><br></p>` or `&nbsp;`. Store and return that state as an empty string so
// consumers can reliably omit an optional section.
const normalizeOptionalRichText = (value) => {
  if (typeof value !== 'string') return '';

  const text = value
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&[a-z]+;|&#\d+;|&#x[\da-f]+;/gi, ' ')
    .replace(/[\s\u200B-\u200D\uFEFF]/g, '');

  return text ? value.trim() : '';
};

const parseGalleryImages = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizePackageOptionalSections = (packageItem) => ({
  ...packageItem,
  additional_info: normalizeOptionalRichText(packageItem.additional_info),
  inclusives: normalizeOptionalRichText(packageItem.inclusives),
  exclusives: normalizeOptionalRichText(packageItem.exclusives),
  gallery_images: parseGalleryImages(packageItem.gallery_images),
});

let packageSchemaMigration;
const ensurePackageSchema = () => {
  if (!packageSchemaMigration) {
    packageSchemaMigration = Promise.all([
      db.query('ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false'),
      db.query('ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_spiritual BOOLEAN DEFAULT false'),
      db.query("ALTER TABLE packages ADD COLUMN IF NOT EXISTS price_usd VARCHAR(50) DEFAULT ''"),
      db.query("ALTER TABLE packages ADD COLUMN IF NOT EXISTS price_inr VARCHAR(50) DEFAULT ''"),
      db.query("ALTER TABLE packages ADD COLUMN IF NOT EXISTS price_eur VARCHAR(50) DEFAULT ''"),
      db.query('ALTER TABLE packages ADD COLUMN IF NOT EXISTS gallery_images JSONB'),
    ]).catch((error) => {
      packageSchemaMigration = null;
      throw error;
    });
  }
  return packageSchemaMigration;
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const destinationId = searchParams.get('destination_id');
    const all = searchParams.get('all') === 'true';
    const params = [];
    const conditions = [];

    // The public API only exposes published packages belonging to published
    // destinations. Admin uses ?all=true so drafts stay available to edit.
    if (!all) {
      conditions.push('p.is_active = true', 'd.is_active = true');
    }
    if (destinationId) {
      params.push(Number(destinationId));
      conditions.push(`p.destination_id = $${params.length}`);
    }

    let sql = `SELECT p.*, COALESCE(d.name, 'Unassigned') AS destination_name
               FROM packages p
               LEFT JOIN destinations d ON p.destination_id = d.id`;
    if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ' ORDER BY p.sort_order ASC, p.id DESC';

    const packages = await db.query(sql, params);

    return NextResponse.json({ packages: packages.map(normalizePackageOptionalSections) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { destination_id, title, days, meals, short_description, long_description, sub_heading, itinerary, additional_info, image_url, gallery_images, inclusives, exclusives, price, price_usd, price_inr, price_eur, sort_order = 0, is_trending = false, is_spiritual = false } = body;
    if (!destination_id || !title) {
      return NextResponse.json({ error: 'Destination and package title are required' }, { status: 400 });
    }
    if (!image_url?.trim()) {
      return NextResponse.json({ error: 'Package image is required' }, { status: 400 });
    }
    await ensurePackageSchema();

    const packageSort = Number(sort_order) > 0 ? Number(sort_order) : await getNextSortOrder('packages');

    // Prevent two active packages from sharing the same sort number.
    if (packageSort > 0) {
      const duplicates = await db.query('SELECT id FROM packages WHERE sort_order = $1 AND is_active = true', [packageSort]);
      if (duplicates.length > 0) {
        return NextResponse.json({ error: `Sort number ${packageSort} is already used by another published package. Unpublish that package or choose a different number.` }, { status: 400 });
      }
    }

    const galleryImages = Array.isArray(gallery_images)
      ? gallery_images.map(String).filter(Boolean)
      : (image_url ? [image_url] : []);

    const packageItem = await db.insert('packages', {
      destination_id: Number(destination_id), title, slug: makeSlug(title), days, meals,
      short_description, long_description, sub_heading, itinerary, additional_info, image_url,
      gallery_images: JSON.stringify(galleryImages),
      inclusives: normalizeOptionalRichText(inclusives), exclusives: normalizeOptionalRichText(exclusives), price, price_usd, price_inr, price_eur, sort_order: packageSort, is_trending: Boolean(is_trending), is_spiritual: Boolean(is_spiritual), is_active: true,
    });
    return NextResponse.json({ success: true, id: packageItem.id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      id, destination_id, title, days, meals, short_description, long_description, sub_heading, itinerary, additional_info, image_url, gallery_images, inclusives, exclusives,
      price, price_usd, price_inr, price_eur, is_active, sort_order, is_trending, is_spiritual,
    } = body;
    if (!id || !destination_id || !title) {
      return NextResponse.json({ error: 'Package ID, destination and title are required' }, { status: 400 });
    }
    // The image is compulsory: explicitly clearing it is rejected so the user
    // must upload a replacement before saving. Partial updates (e.g. publishing
    // from the list page) that omit image_url are unaffected.
    if (image_url !== undefined && !String(image_url || '').trim()) {
      return NextResponse.json({ error: 'Package image is required' }, { status: 400 });
    }
    const existing = await db.get('packages', Number(id));
    if (!existing) return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    await ensurePackageSchema();

    // Deciding whether the package is being unpublished: free its sort number so
    // another item can reuse it.
    const nextActive = body.is_active !== undefined ? Boolean(body.is_active) : Boolean(existing.is_active);
    const nextSortOrder = nextActive
      ? (sort_order !== undefined ? Number(sort_order) : Number(existing.sort_order) || 0)
      : null;

    if (nextActive && nextSortOrder > 0) {
      const duplicates = await db.query('SELECT id FROM packages WHERE sort_order = $1 AND is_active = true AND id != $2', [nextSortOrder, Number(id)]);
      if (duplicates.length > 0) {
        return NextResponse.json({ error: `Sort number ${nextSortOrder} is already used by another published package. Unpublish that package or choose a different number.` }, { status: 400 });
      }
    }

    const updatedData = {
      destination_id: destination_id !== undefined ? Number(destination_id) : existing.destination_id,
      title: title !== undefined ? title : existing.title,
      slug: makeSlug(title !== undefined ? title : existing.title),
      days: days !== undefined ? days : existing.days,
      meals: meals !== undefined ? meals : existing.meals,
      short_description: short_description !== undefined ? short_description : existing.short_description,
      long_description: long_description !== undefined ? long_description : existing.long_description,
      sub_heading: sub_heading !== undefined ? sub_heading : existing.sub_heading,
      itinerary: itinerary !== undefined ? itinerary : existing.itinerary,
      additional_info: additional_info !== undefined ? additional_info : existing.additional_info,
      image_url: image_url !== undefined ? image_url : existing.image_url,
      inclusives: inclusives !== undefined ? normalizeOptionalRichText(inclusives) : existing.inclusives,
      exclusives: exclusives !== undefined ? normalizeOptionalRichText(exclusives) : existing.exclusives,
      price: price !== undefined ? price : existing.price,
      price_usd: price_usd !== undefined ? price_usd : existing.price_usd,
      price_inr: price_inr !== undefined ? price_inr : existing.price_inr,
      price_eur: price_eur !== undefined ? price_eur : existing.price_eur,
      sort_order: nextSortOrder,
      is_trending: is_trending !== undefined ? Boolean(is_trending) : existing.is_trending,
      is_spiritual: is_spiritual !== undefined ? Boolean(is_spiritual) : existing.is_spiritual,
      is_active: nextActive,
    };

    if (gallery_images !== undefined) {
      updatedData.gallery_images = JSON.stringify(
        Array.isArray(gallery_images) ? gallery_images.map(String).filter(Boolean) : []
      );
    }

    await db.update('packages', Number(id), updatedData);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'Package ID required' }, { status: 400 });
    await db.delete('packages', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
