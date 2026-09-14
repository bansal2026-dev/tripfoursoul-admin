import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import db from '@/lib/db';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif']);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    const imageMap = new Map(); // key: url, value: { url, name, size, date, source }

    // 1. Read files from public/uploads
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      try {
        const fileNames = fs.readdirSync(uploadsDir);
        for (const filename of fileNames) {
          if (filename.startsWith('.')) continue;

          const ext = path.extname(filename).toLowerCase();
          if (!IMAGE_EXTENSIONS.has(ext)) continue;

          const filePath = path.join(uploadsDir, filename);
          const stats = fs.statSync(filePath);

          // Clean human-friendly name (strip leading timestamp prefix if present)
          const cleanName = filename.replace(/^\d+[-_]?/, '');

          const fileUrl = `/uploads/${filename}`;
          imageMap.set(fileUrl, {
            url: fileUrl,
            name: cleanName || filename,
            fileName: filename,
            size: stats.size,
            date: stats.mtime.toISOString(),
            timestamp: stats.mtimeMs,
            source: 'upload',
          });
        }
      } catch (dirErr) {
        console.warn('Error reading public/uploads:', dirErr.message);
      }
    }

    // 2. Aggregate image URLs from database tables (page_banners, banner_images, destinations, packages, gallery)
    const collectDbUrls = async (queryStr, urlFields) => {
      try {
        const rows = await db.query(queryStr);
        if (Array.isArray(rows)) {
          for (const row of rows) {
            for (const field of urlFields) {
              const val = row[field];
              if (val && typeof val === 'string' && (val.startsWith('/') || val.startsWith('http')) && !val.startsWith('data:')) {
                if (!imageMap.has(val)) {
                  const nameFromUrl = val.split('/').pop()?.split('?')[0] || 'Image';
                  imageMap.set(val, {
                    url: val,
                    name: decodeURIComponent(nameFromUrl),
                    fileName: nameFromUrl,
                    size: null,
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
        // Table might not exist or be empty, safely ignore
      }
    };

    await Promise.all([
      collectDbUrls('SELECT background_image, updated_at FROM page_banners', ['background_image']),
      collectDbUrls('SELECT image_url, created_at FROM banner_images', ['image_url']),
      collectDbUrls('SELECT image_url, updated_at FROM destinations', ['image_url']),
      collectDbUrls('SELECT image_url, updated_at FROM packages', ['image_url']),
      collectDbUrls('SELECT image_url, created_at FROM gallery', ['image_url']),
    ]);

    // 3. Convert to array and sort by most recent first
    let images = Array.from(imageMap.values());
    images.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // 4. Apply search filter if present
    if (search) {
      images = images.filter((img) =>
        (img.name || '').toLowerCase().includes(search) ||
        (img.url || '').toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      count: images.length,
      images,
    });
  } catch (error) {
    console.error('Error fetching media images:', error);
    return NextResponse.json({ error: 'Failed to fetch media images' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename') || '';
    const fileUrl = searchParams.get('url') || '';

    let targetFilename = filename;
    if (!targetFilename && fileUrl.startsWith('/uploads/')) {
      targetFilename = fileUrl.replace(/^\/uploads\//, '');
    }

    if (!targetFilename) {
      return NextResponse.json({ error: 'Filename or URL is required' }, { status: 400 });
    }

    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(targetFilename);
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const filePath = path.join(uploadsDir, safeFilename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ success: true, message: 'Image deleted successfully' });
    }

    return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
  } catch (error) {
    console.error('Error deleting media file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}

