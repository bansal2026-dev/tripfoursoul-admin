import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Max file size (50 MB for videos/images)
const MAX_SIZE = 50 * 1024 * 1024;

// Allowed image and video types
const ALLOWED_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/svg+xml',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-matroska',
  'video/m4v',
];

// Sanitize filename while keeping the real human name
function sanitizeBaseName(rawName) {
  const rawExt = path.extname(rawName) || '.webp';
  const rawBase = path.basename(rawName, rawExt);

  let cleanBase = rawBase
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

  if (!cleanBase) cleanBase = 'image';
  const ext = rawExt.toLowerCase();

  return { cleanBase, ext };
}

// Save uploaded buffer to public/uploads using real filename (handling duplicates safely)
async function saveUploadWithRealName(buffer, originalFilename = 'image.webp') {
  const uploadsDirectory = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadsDirectory, { recursive: true });

  const { cleanBase, ext } = sanitizeBaseName(originalFilename);
  let targetFilename = `${cleanBase}${ext}`;
  let counter = 1;

  while (fs.existsSync(path.join(uploadsDirectory, targetFilename))) {
    try {
      const existingBuffer = fs.readFileSync(path.join(uploadsDirectory, targetFilename));
      if (existingBuffer.equals(buffer)) {
        // Exact identical image content already exists, reuse it
        return targetFilename;
      }
    } catch {
      // Ignore read error and try next
    }
    targetFilename = `${cleanBase}-${counter}${ext}`;
    counter++;
  }

  await writeFile(path.join(uploadsDirectory, targetFilename), buffer);
  return targetFilename;
}

// Extract pixel dimensions using sharp
async function getImageDimensions(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    return {
      width: meta.width || null,
      height: meta.height || null,
      format: meta.format || null,
    };
  } catch (err) {
    console.warn('Could not read image metadata with sharp:', err.message);
    return { width: null, height: null, format: null };
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    const imagePath = searchParams.get('path');

    if (!imageUrl && !imagePath) {
      return NextResponse.json({ error: 'Image URL or path is required' }, { status: 400 });
    }

    let imageBuffer;
    let contentType = 'image/jpeg';

    if (imageUrl) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch image' }, { status: 400 });
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);

      if (imageUrl.endsWith('.png')) contentType = 'image/png';
      else if (imageUrl.endsWith('.gif')) contentType = 'image/gif';
      else if (imageUrl.endsWith('.webp')) contentType = 'image/webp';
    } else if (imagePath) {
      const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
      const fullPath = path.join(process.cwd(), 'public', cleanPath);

      if (!fs.existsSync(fullPath)) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
      }

      imageBuffer = fs.readFileSync(fullPath);

      const ext = path.extname(fullPath).toLowerCase();
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.webp') contentType = 'image/webp';
    }

    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64Image}`;

    return NextResponse.json({
      success: true,
      base64Image: dataUrl,
      contentType,
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return NextResponse.json({ error: 'Failed to convert image to base64' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const reqContentType = request.headers.get('content-type') || '';

    // ==================== Handle JSON body (base64 data URL) ====================
    if (reqContentType.includes('application/json')) {
      const body = await request.json();
      const { base64Image, fileName, name } = body;

      if (!base64Image) {
        return NextResponse.json({ error: 'No base64 image provided' }, { status: 400 });
      }

      const mimeMatch = base64Image.match(/^data:(image\/[\w+]+);base64,/);
      const detectedType = mimeMatch ? mimeMatch[1] : 'image/webp';
      const base64Data = base64Image.replace(/^data:image\/[\w+]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      if (!ALLOWED_TYPES.includes(detectedType)) {
        return NextResponse.json({ error: 'Invalid file type. Allowed: WebP, JPEG, PNG, GIF, SVG.' }, { status: 400 });
      }

      if (buffer.length > MAX_SIZE) {
        return NextResponse.json({ error: 'File size too large. Maximum 10 MB allowed.' }, { status: 400 });
      }

      const originalName = fileName || name || `image.${detectedType.split('/')[1] || 'webp'}`;
      const savedFilename = await saveUploadWithRealName(buffer, originalName);
      const { width, height, format } = await getImageDimensions(buffer);

      return NextResponse.json({
        success: true,
        imageUrl: `/uploads/${savedFilename}`,
        fileName: savedFilename,
        realName: originalName,
        width,
        height,
        format,
        size: buffer.length,
        message: width && height
          ? `Image uploaded successfully (${width} × ${height} px)`
          : 'Image uploaded successfully',
      });
    }

    // ==================== Handle multipart/form-data file upload ====================
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: WebP, JPEG, PNG, GIF, SVG.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size too large. Maximum 10 MB allowed.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save with its REAL original filename
    const savedFilename = await saveUploadWithRealName(buffer, file.name || 'image.webp');
    const { width, height, format } = await getImageDimensions(buffer);

    return NextResponse.json({
      success: true,
      imageUrl: `/uploads/${savedFilename}`,
      fileName: savedFilename,
      realName: file.name || savedFilename,
      width,
      height,
      format,
      size: buffer.length,
      message: width && height
        ? `Image uploaded successfully (${width} × ${height} px)`
        : 'Image uploaded successfully',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload image: ' + error.message }, { status: 500 });
  }
}
