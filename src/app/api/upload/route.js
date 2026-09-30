import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Max file size (50 MB for videos/images)
const MAX_SIZE = 50 * 1024 * 1024;

// Allowed image types: ONLY WebP is allowed!
const ALLOWED_IMAGE_TYPES = ['image/webp'];
// Allowed video types
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-matroska',
  'video/m4v',
];

// Determine whether to return base64 Data URL (local/development) or file path (production)
function shouldUseBase64(isImage) {
  // Only images can be stored as base64; videos are always saved as files
  if (!isImage) return false;

  // 1. Explicit override via UPLOAD_STORAGE environment variable
  const storage = (process.env.UPLOAD_STORAGE || '').toLowerCase().trim();
  if (storage === 'base64') return true;
  if (storage === 'file' || storage === 'uploads') return false;

  // 2. Default based on environment: production -> file, development/local -> base64
  const isProd = process.env.NODE_ENV === 'production' || (process.env.APP_ENV || '').toLowerCase() === 'production';
  return !isProd;
}

// Sanitize filename while keeping the real human name and ensuring .webp for images
function sanitizeBaseName(rawName, isImage = false) {
  const rawExt = path.extname(rawName) || (isImage ? '.webp' : '');
  const rawBase = path.basename(rawName, rawExt);

  let cleanBase = rawBase
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

  if (!cleanBase) cleanBase = 'image';
  const ext = isImage ? '.webp' : rawExt.toLowerCase();

  return { cleanBase, ext };
}

// Save uploaded buffer to public/uploads using real filename (handling duplicates safely)
async function saveUploadWithRealName(buffer, originalFilename = 'image.webp', isImage = false) {
  const uploadsDirectory = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadsDirectory, { recursive: true });

  const { cleanBase, ext } = sanitizeBaseName(originalFilename, isImage);
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
    let contentType = 'image/webp';

    if (imageUrl) {
      if (imageUrl.startsWith('data:image/')) {
        return NextResponse.json({
          success: true,
          base64Image: imageUrl,
          contentType: imageUrl.split(';')[0].replace('data:', '') || 'image/webp',
        });
      }

      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        imageBuffer = Buffer.from(await response.arrayBuffer());
        contentType = response.headers.get('content-type') || 'image/webp';
      } else if (imageUrl.startsWith('/uploads/')) {
        const localPath = path.join(process.cwd(), 'public', imageUrl);
        imageBuffer = fs.readFileSync(localPath);
        contentType = 'image/webp';
      } else {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
      }
    } else if (imagePath) {
      const fullPath = path.join(process.cwd(), 'public', imagePath.startsWith('/') ? imagePath.slice(1) : imagePath);
      if (!fs.existsSync(fullPath)) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
      }
      imageBuffer = fs.readFileSync(fullPath);
      contentType = 'image/webp';
    }

    if (!imageBuffer) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

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

      const base64Data = base64Image.replace(/^data:image\/[\w+]+;base64,/, '');
      let buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length > MAX_SIZE) {
        return NextResponse.json({ error: 'File size too large. Maximum 50 MB allowed.' }, { status: 400 });
      }

      // Enforce WebP: convert image to WebP buffer to guarantee 100% webp
      try {
        buffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
      } catch (err) {
        return NextResponse.json({ error: 'Failed to process WebP image: ' + err.message }, { status: 400 });
      }

      const originalName = fileName || name || 'image.webp';
      const { width, height } = await getImageDimensions(buffer);

      // In development / local mode: return base64 data URL directly
      if (shouldUseBase64(true)) {
        try {
          await saveUploadWithRealName(buffer, originalName, true);
        } catch {
          // ignore local disk write errors
        }

        const dataUrl = `data:image/webp;base64,${buffer.toString('base64')}`;
        return NextResponse.json({
          success: true,
          imageUrl: dataUrl,
          fileName: originalName,
          realName: originalName,
          width,
          height,
          format: 'webp',
          size: buffer.length,
          storage: 'base64',
          message: width && height
            ? `WebP image uploaded as Base64 (${width} × ${height} px)`
            : 'WebP image uploaded as Base64',
        });
      }

      // In production mode: save to /public/uploads/
      const savedFilename = await saveUploadWithRealName(buffer, originalName, true);
      return NextResponse.json({
        success: true,
        imageUrl: `/uploads/${savedFilename}`,
        fileName: savedFilename,
        realName: originalName,
        width,
        height,
        format: 'webp',
        size: buffer.length,
        storage: 'file',
        message: width && height
          ? `WebP image uploaded successfully (${width} × ${height} px)`
          : 'WebP image uploaded successfully',
      });
    }

    // ==================== Handle multipart/form-data file upload ====================
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = (file.name || '').toLowerCase();
    const fileType = (file.type || '').toLowerCase();
    const isVideo = fileType.startsWith('video/') || /\.(mp4|webm|ogg|mov|mkv|m4v)$/i.test(fileName);
    const isImage = fileType.startsWith('image/') || /\.(webp|jpg|jpeg|png|gif|avif|bmp|svg)$/i.test(fileName) || !isVideo;

    // Reject non-webp images strictly
    if (isImage) {
      const isWebp = fileType === 'image/webp' || fileName.endsWith('.webp');
      if (!isWebp) {
        return NextResponse.json(
          { error: 'Only WebP images (.webp) are allowed! Sirf WebP format ki image upload ho sakti hai.' },
          { status: 400 }
        );
      }
    } else if (isVideo) {
      if (!ALLOWED_VIDEO_TYPES.includes(fileType) && !/\.(mp4|webm|ogg|mov|mkv|m4v)$/i.test(fileName)) {
        return NextResponse.json({ error: 'Invalid video file type.' }, { status: 400 });
      }
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size too large. Maximum 50 MB allowed.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    if (isImage) {
      // Process through sharp to ensure clean, optimized WebP format
      try {
        buffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
      } catch (err) {
        // If sharp cannot process (e.g. malformed webp), return error
        return NextResponse.json({ error: 'Invalid or corrupt WebP image file.' }, { status: 400 });
      }
    }

    const { width, height, format } = isImage ? await getImageDimensions(buffer) : { width: null, height: null, format: null };

    // In development / local mode: return base64 data URL for images
    if (shouldUseBase64(isImage)) {
      try {
        await saveUploadWithRealName(buffer, file.name || 'image.webp', isImage);
      } catch {
        // ignore local disk write errors
      }

      const dataUrl = `data:image/webp;base64,${buffer.toString('base64')}`;
      return NextResponse.json({
        success: true,
        imageUrl: dataUrl,
        fileName: file.name || 'image.webp',
        realName: file.name || 'image.webp',
        width,
        height,
        format: 'webp',
        size: buffer.length,
        storage: 'base64',
        message: width && height
          ? `WebP image uploaded as Base64 (${width} × ${height} px)`
          : 'WebP image uploaded as Base64',
      });
    }

    // In production mode (or videos): save to /public/uploads/
    const savedFilename = await saveUploadWithRealName(buffer, file.name || 'image.webp', isImage);

    return NextResponse.json({
      success: true,
      imageUrl: `/uploads/${savedFilename}`,
      fileName: savedFilename,
      realName: file.name || savedFilename,
      width,
      height,
      format: isImage ? 'webp' : format,
      size: buffer.length,
      storage: 'file',
      message: width && height
        ? `WebP image uploaded successfully (${width} × ${height} px)`
        : 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file: ' + error.message }, { status: 500 });
  }
}
