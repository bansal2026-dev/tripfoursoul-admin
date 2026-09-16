import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import db from '@/lib/db';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv', '.avi']);
const MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const typeFilter = (searchParams.get('type') || 'all').toLowerCase(); // 'all' | 'image' | 'video'

    const mediaMap = new Map(); // key: url, value: { url, name, fileName, size, width, height, mediaType, date, timestamp, source }

    // 1. Read files from public/uploads (both images and videos)
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      try {
        const fileNames = fs.readdirSync(uploadsDir);
        await Promise.all(
          fileNames.map(async (filename) => {
            if (filename.startsWith('.')) return;

            const ext = path.extname(filename).toLowerCase();
            if (!MEDIA_EXTENSIONS.has(ext)) return;

            const isVideo = VIDEO_EXTENSIONS.has(ext);
            const mediaType = isVideo ? 'video' : 'image';

            const filePath = path.join(uploadsDir, filename);
            const stats = fs.statSync(filePath);

            let width = null;
            let height = null;
            if (!isVideo) {
              try {
                const meta = await sharp(filePath).metadata();
                width = meta.width || null;
                height = meta.height || null;
              } catch {
                // Ignore metadata errors for non-standard image formats
              }
            }

            // Clean human-friendly name (strip leading timestamp prefix if present from older files)
            const cleanName = filename.replace(/^\d+[-_]/, '');

            const fileUrl = `/uploads/${filename}`;
            mediaMap.set(fileUrl, {
              url: fileUrl,
              name: cleanName || filename,
              fileName: filename,
              size: stats.size,
              width,
              height,
              mediaType,
              date: stats.mtime.toISOString(),
              timestamp: stats.mtimeMs,
              source: 'upload',
            });
          })
        );
      } catch (dirErr) {
        console.warn('Error reading public/uploads:', dirErr.message);
      }
    }

    // 2. Aggregate media URLs from database tables
    const collectDbUrls = async (queryStr, urlFields, defaultType = null) => {
      try {
        const rows = await db.query(queryStr);
        if (Array.isArray(rows)) {
          for (const row of rows) {
            for (const field of urlFields) {
              const val = row[field];
              if (val && typeof val === 'string' && (val.startsWith('/') || val.startsWith('http')) && !val.startsWith('data:')) {
                if (!mediaMap.has(val)) {
                  const ext = path.extname(val.split('?')[0]).toLowerCase();
                  const isVideo = VIDEO_EXTENSIONS.has(ext) || field.includes('video') || val.includes('youtube') || val.includes('vimeo');
                  const mediaType = defaultType || (isVideo ? 'video' : 'image');

                  const nameFromUrl = val.split('/').pop()?.split('?')[0] || (mediaType === 'video' ? 'Video' : 'Image');
                  mediaMap.set(val, {
                    url: val,
                    name: decodeURIComponent(nameFromUrl),
                    fileName: nameFromUrl,
                    size: null,
                    width: null,
                    height: null,
                    mediaType,
                    date: row.created_at || row.updated_at || new Date().toISOString(),
                    timestamp: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
                    source: 'database',
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        // Safe to ignore if table doesn't exist
      }
    };

    await Promise.all([
      collectDbUrls('SELECT background_image, updated_at FROM page_banners', ['background_image'], 'image'),
      collectDbUrls('SELECT image_url, created_at FROM banner_images', ['image_url'], 'image'),
      collectDbUrls('SELECT image_url, updated_at FROM destinations', ['image_url'], 'image'),
      collectDbUrls('SELECT image_url, updated_at FROM packages', ['image_url'], 'image'),
      collectDbUrls('SELECT image_url, video_url, created_at FROM gallery', ['image_url', 'video_url']),
      collectDbUrls('SELECT image_url, video_url, influencer_video_url, created_at FROM testimonials', ['image_url', 'video_url', 'influencer_video_url']),
    ]);

    // 3. Convert to array and sort by most recent first
    let media = Array.from(mediaMap.values());
    media.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const totalImages = media.filter((m) => m.mediaType === 'image').length;
    const totalVideos = media.filter((m) => m.mediaType === 'video').length;

    // 4. Apply type filter
    if (typeFilter === 'image' || typeFilter === 'images') {
      media = media.filter((m) => m.mediaType === 'image');
    } else if (typeFilter === 'video' || typeFilter === 'videos') {
      media = media.filter((m) => m.mediaType === 'video');
    }

    // 5. Apply search filter
    if (search) {
      media = media.filter((m) =>
        (m.name || '').toLowerCase().includes(search) ||
        (m.url || '').toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      count: media.length,
      totalImages,
      totalVideos,
      images: media, // Kept as 'images' for backwards compatibility, also contains videos
      media,
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    // SECURITY: Only Admin or Super Admin can delete media
    const token = getTokenFromCookies(request);
    const payload = verifyToken(token);

    if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
      return NextResponse.json(
        { error: 'Permission denied: Only Admin or Super Admin can delete media files' },
        { status: 403 }
      );
    }

    let urlsToDelete = [];

    // 1. Check if request body contains an array of URLs
    try {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await request.json();
        if (Array.isArray(body.urls) && body.urls.length > 0) {
          urlsToDelete = body.urls;
        } else if (body.url) {
          urlsToDelete = [body.url];
        }
      }
    } catch {
      // Body parse error, fallback to searchParams
    }

    // 2. Fallback to URL searchParams
    if (urlsToDelete.length === 0) {
      const { searchParams } = new URL(request.url);
      const filename = searchParams.get('filename') || '';
      const fileUrl = searchParams.get('url') || '';
      if (fileUrl) urlsToDelete.push(fileUrl);
      else if (filename) urlsToDelete.push(`/uploads/${filename}`);
    }

    if (urlsToDelete.length === 0) {
      return NextResponse.json({ error: 'Filename or URL is required' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    let deletedCount = 0;
    let notFoundCount = 0;

    for (const rawUrl of urlsToDelete) {
      if (!rawUrl || typeof rawUrl !== 'string') continue;

      let targetFilename = '';
      if (rawUrl.startsWith('/uploads/')) {
        targetFilename = rawUrl.replace(/^\/uploads\//, '');
      } else if (rawUrl.includes('/uploads/')) {
        const parts = rawUrl.split('/uploads/');
        targetFilename = parts[parts.length - 1].split('?')[0];
      } else if (!rawUrl.includes('/') && !rawUrl.startsWith('data:')) {
        targetFilename = rawUrl;
      }

      if (targetFilename) {
        const safeFilename = path.basename(targetFilename);
        const filePath = path.join(uploadsDir, safeFilename);

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
          } catch (unlinkErr) {
            console.error(`Failed to delete file ${filePath}:`, unlinkErr);
          }
        } else {
          notFoundCount++;
        }
      }

      // Also clean up any banner_images entry matching this URL
      try {
        await db.query('DELETE FROM banner_images WHERE image_url = $1', [rawUrl]);
      } catch {
        // Safe to ignore if table doesn't exist
      }
    }

    if (deletedCount === 0 && notFoundCount > 0 && urlsToDelete.length === 1) {
      return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} file(s).`,
      deletedCount,
      notFoundCount,
      totalRequested: urlsToDelete.length,
    });
  } catch (error) {
    console.error('Error deleting media file(s):', error);
    return NextResponse.json({ error: 'Failed to delete file(s)' }, { status: 500 });
  }
}
