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

const normalizeRelatedPackageIds = (value) => Array.isArray(value)
  ? [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
  : [];

const replaceRelatedPackageIds = async (packageId, relatedPackageIds) => {
  await db.query('DELETE FROM package_related_packages WHERE package_id = $1', [packageId]);
  if (!relatedPackageIds.length) return;
  await db.query(
    `INSERT INTO package_related_packages (package_id, related_package_id, sort_order)
     SELECT $1, related.related_package_id, related.ordinality::integer
     FROM UNNEST($2::int[]) WITH ORDINALITY AS related(related_package_id, ordinality)
     WHERE related.related_package_id <> $1`,
    [packageId, relatedPackageIds]
  );
};

const validateRelatedPackageIds = async (relatedPackageIds, currentPackageId = null) => {
  if (currentPackageId !== null && relatedPackageIds.includes(Number(currentPackageId))) {
    return 'A package cannot be related to itself.';
  }
  if (!relatedPackageIds.length) return null;
  const matches = await db.query('SELECT id FROM packages WHERE id = ANY($1::int[])', [relatedPackageIds]);
  return matches.length === relatedPackageIds.length ? null : 'One or more related packages could not be found.';
};

const normalizePackageOptionalSections = (packageItem) => ({
  ...packageItem,
  additional_info: normalizeOptionalRichText(packageItem.additional_info),
  inclusives: normalizeOptionalRichText(packageItem.inclusives),
  exclusives: normalizeOptionalRichText(packageItem.exclusives),
  gallery_images: parseGalleryImages(packageItem.gallery_images),
  itinerary_days: parseItineraryDays(packageItem.itinerary),
  related_packages: Array.isArray(packageItem.related_packages) ? packageItem.related_packages : [],
});

const parseJsonObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
};

const parseItineraryDays = (value) => {
  const parsed = parseJsonObject(value);
  if (parsed.version === 1 && Array.isArray(parsed.days)) {
    return parsed.days.map((item, index) => ({
      day: item.day || `Day ${index + 1}`,
      title: item.title || item.location || '',
      location: item.location || item.title || '',
      description: item.description || item.content || '',
      content: item.content || item.description || '',
    }));
  }
  const legacyHtml = typeof value === 'string' ? value : '';
  return legacyHtml ? [{ day: 'Day 1', title: '', location: '', description: legacyHtml, content: legacyHtml }] : [];
};

const inferCurrency = (item) => item.price_inr ? 'INR' : item.price_eur ? 'EUR' : item.price_usd
  ? 'USD'
  : String(item.price || '').trim().startsWith('₹') ? 'INR'
    : String(item.price || '').trim().startsWith('€') ? 'EUR' : 'USD';

let packageSchemaMigration;
const ensurePackageSchema = () => {
  if (!packageSchemaMigration) {
    packageSchemaMigration = (async () => {
      // Remove the obsolete per-package service assignment relation while
      // retaining the global services catalog for its own admin pages.
      await Promise.all([
        db.query('ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false'),
        db.query('ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_spiritual BOOLEAN DEFAULT false'),
        db.query('ALTER TABLE packages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
        db.query("ALTER TABLE packages ADD COLUMN IF NOT EXISTS price_usd VARCHAR(50) DEFAULT ''"),
        db.query("ALTER TABLE packages ADD COLUMN IF NOT EXISTS price_inr VARCHAR(50) DEFAULT ''"),
        db.query("ALTER TABLE packages ADD COLUMN IF NOT EXISTS price_eur VARCHAR(50) DEFAULT ''"),
        db.query('ALTER TABLE packages ADD COLUMN IF NOT EXISTS gallery_images JSONB'),
        db.query('ALTER TABLE packages DROP COLUMN IF EXISTS landing_content'),
        db.query("ALTER TABLE packages ADD COLUMN IF NOT EXISTS quote_cta_text VARCHAR(100) DEFAULT 'Get a Quote'"),
        db.query("ALTER TABLE packages ADD COLUMN IF NOT EXISTS price_display_label VARCHAR(100) DEFAULT 'per person / twin share'"),
        db.query('DROP TABLE IF EXISTS package_services'),
        db.query(`CREATE TABLE IF NOT EXISTS package_related_packages (
          package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
          related_package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (package_id, related_package_id),
          CHECK (package_id <> related_package_id)
        )`),
      ]);
    })().catch((error) => {
      packageSchemaMigration = null;
      throw error;
    });
  }
  return packageSchemaMigration;
};

export async function GET(request) {
  try {
    await ensurePackageSchema();
    const { searchParams } = new URL(request.url);
    const destinationId = searchParams.get('destination_id');
    const packageId = searchParams.get('id');
    const packageSlug = searchParams.get('slug');
    const detail = searchParams.get('detail') === 'true';
    const publicRequest = searchParams.get('public') === 'true';
    const all = !publicRequest && searchParams.get('all') === 'true';
    const summary = !(detail || packageId || packageSlug);
    const params = [];
    const conditions = [];

    // Public visibility follows the package publish flag. A destination's
    // own visibility must not hide a package that is explicitly published.
    // Admin uses ?all=true so drafts stay available to edit.
    if (!all) {
      conditions.push('p.is_active = true');
    }
    if (destinationId) {
      params.push(Number(destinationId));
      conditions.push(`p.destination_id = $${params.length}`);
    }
    if (packageId) {
      params.push(Number(packageId));
      conditions.push(`p.id = $${params.length}`);
    }
    if (packageSlug) {
      params.push(packageSlug);
      conditions.push(`p.slug = $${params.length}`);
    }

    const columns = summary
      ? `p.id, p.destination_id, p.title, p.slug, p.days, p.meals,
         regexp_replace(COALESCE(p.short_description, ''), 'data:image/[^;]+;base64,[A-Za-z0-9+/=]+', '[embedded image]', 'g') AS short_description,
         p.image_url, p.price, p.price_usd, p.price_inr, p.price_eur,
         p.sort_order, p.is_trending, p.is_spiritual, p.is_active,
         p.quote_cta_text, p.price_display_label`
      : 'p.*';
    let sql = `SELECT ${columns}, COALESCE(d.name, 'Unassigned') AS destination_name,
               jsonb_build_object('id', d.id, 'name', d.name, 'slug', d.slug, 'image_url', d.image_url, 'region', d.region) AS destination
               FROM packages p
               LEFT JOIN destinations d ON p.destination_id = d.id`;
    if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ' ORDER BY p.sort_order ASC, p.id DESC';

    const packages = await db.query(sql, params, { processImages: false });
    const packageIds = packages.map((item) => Number(item.id)).filter(Number.isFinite);
    const relatedIdsByPackage = new Map(packageIds.map((id) => [id, []]));
    const includeRelatedIds = !publicRequest && Boolean(packageId || packageSlug);
    if (packageIds.length && includeRelatedIds) {
      const relatedLinks = await db.query(
        `SELECT package_id, related_package_id FROM package_related_packages
         WHERE package_id = ANY($1::int[]) ORDER BY sort_order ASC, related_package_id ASC`,
        [packageIds]
      );
      for (const link of relatedLinks) relatedIdsByPackage.get(Number(link.package_id))?.push(Number(link.related_package_id));
    }
    const normalized = packages.map((item) => {
      const currency = inferCurrency(item);
      const normalizedItem = normalizePackageOptionalSections({ ...item, currency });
      normalizedItem.related_package_ids = relatedIdsByPackage.get(Number(item.id)) || [];
      normalizedItem.quote_cta_text ||= 'Get a Quote';
      normalizedItem.price_display_label ||= 'per person / twin share';
      return normalizedItem;
    });

    if (detail && normalized.length === 1) {
      const current = normalized[0];
      const selectedRelated = await db.query(
        `SELECT p.id, p.destination_id, p.title, p.slug, p.days, p.image_url, p.price, p.price_usd, p.price_inr, p.price_eur, p.sort_order, p.is_active,
                COALESCE(d.name, '') AS destination_name, COALESCE(d.slug, '') AS destination_slug
         FROM package_related_packages rp INNER JOIN packages p ON p.id = rp.related_package_id
         LEFT JOIN destinations d ON d.id = p.destination_id
         WHERE rp.package_id = $1 AND p.is_active = true
         ORDER BY rp.sort_order ASC, p.id ASC LIMIT 2`,
        [current.id]
      );
      current.related_packages = selectedRelated.map((item) => ({
        ...item,
        currency: inferCurrency(item),
        destination: { id: item.destination_id, name: item.destination_name, slug: item.destination_slug },
      }));
    }

    return NextResponse.json({ packages: normalized });
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
    const relatedPackageIds = normalizeRelatedPackageIds(body.related_package_ids);
    if (relatedPackageIds.length > 2) {
      return NextResponse.json({ error: 'Choose no more than 2 related packages.' }, { status: 400 });
    }
    await ensurePackageSchema();
    const relatedPackageError = await validateRelatedPackageIds(relatedPackageIds);
    if (relatedPackageError) return NextResponse.json({ error: relatedPackageError }, { status: 400 });

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
      quote_cta_text: String(body.quote_cta_text || 'Get a Quote').trim(),
      price_display_label: String(body.price_display_label || 'per person / twin share').trim(),
      inclusives: normalizeOptionalRichText(inclusives), exclusives: normalizeOptionalRichText(exclusives), price, price_usd, price_inr, price_eur, sort_order: packageSort, is_trending: Boolean(is_trending), is_spiritual: Boolean(is_spiritual), is_active: true,
    });
    await replaceRelatedPackageIds(packageItem.id, relatedPackageIds);
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
    const relatedPackageIds = body.related_package_ids !== undefined
      ? normalizeRelatedPackageIds(body.related_package_ids)
      : null;
    if (relatedPackageIds && relatedPackageIds.length > 2) {
      return NextResponse.json({ error: 'Choose no more than 2 related packages.' }, { status: 400 });
    }
    if (relatedPackageIds) {
      const relatedPackageError = await validateRelatedPackageIds(relatedPackageIds, Number(id));
      if (relatedPackageError) return NextResponse.json({ error: relatedPackageError }, { status: 400 });
    }

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
      quote_cta_text: body.quote_cta_text !== undefined ? String(body.quote_cta_text || '').trim() : (existing.quote_cta_text || 'Get a Quote'),
      price_display_label: body.price_display_label !== undefined ? String(body.price_display_label || '').trim() : (existing.price_display_label || 'per person / twin share'),
      sort_order: nextSortOrder,
      is_trending: is_trending !== undefined ? Boolean(is_trending) : existing.is_trending,
      is_spiritual: is_spiritual !== undefined ? Boolean(is_spiritual) : existing.is_spiritual,
      is_active: nextActive,
      updated_at: new Date().toISOString(),
    };

    if (gallery_images !== undefined) {
      updatedData.gallery_images = JSON.stringify(
        Array.isArray(gallery_images) ? gallery_images.map(String).filter(Boolean) : []
      );
    }

    await db.update('packages', Number(id), updatedData);
    if (relatedPackageIds) await replaceRelatedPackageIds(Number(id), relatedPackageIds);
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
