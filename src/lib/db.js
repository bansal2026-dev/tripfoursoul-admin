import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Fallback to JSON file when PostgreSQL is not available
const useJsonFallback = process.env.USE_JSON_DB === 'true' || !process.env.DATABASE_URL;
let jsonData = null;

const loadJsonData = () => {
  if (!jsonData) {
    const jsonPath = path.join(process.cwd(), 'database.json');
    if (fs.existsSync(jsonPath)) {
      const data = fs.readFileSync(jsonPath, 'utf-8');
      jsonData = JSON.parse(data);
    }
  }
  return jsonData;
};

// Initialize PostgreSQL pool only if connection string is available
// Use globalThis to cache the pool across serverless invocations (Vercel)
// This prevents connection exhaustion on Aiven PostgreSQL
let pool = null;
let pgAvailable = false;

if (!useJsonFallback && process.env.DATABASE_URL) {
  try {
    // Reuse existing pool from global cache if available
    if (globalThis.__pgPool) {
      pool = globalThis.__pgPool;
      pgAvailable = true;
    } else {
      // Strip sslmode from connection string to avoid conflicts with ssl option
      let connectionString = process.env.DATABASE_URL;
      if (connectionString.includes('?sslmode=')) {
        connectionString = connectionString.split('?')[0];
      }

      const maxPoolSize = process.env.PGMAX_POOL_SIZE
        ? parseInt(process.env.PGMAX_POOL_SIZE, 10)
        : (process.env.NODE_ENV === 'production' ? 5 : 10);

      pool = new Pool({
        connectionString: connectionString,
        ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
        max: maxPoolSize,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
        query_timeout: 25000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });
      // Handle idle client errors to prevent crashes
      pool.on('error', (err) => {
        console.warn('PostgreSQL pool idle client error:', err.message);
      });
      // Cache pool globally for reuse across serverless invocations
      globalThis.__pgPool = pool;
      pgAvailable = true;
    }
  } catch (error) {
    console.warn('PostgreSQL pool creation failed, using JSON fallback:', error.message);
  }
}

// Transient connection error detector for automatic retries
const isTransientConnectionError = (error) => {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = (error.code || '').toLowerCase();
  return (
    msg.includes('query read timeout') ||
    msg.includes('timeout') ||
    msg.includes('connection terminated') ||
    msg.includes('connection closed') ||
    msg.includes('econnreset') ||
    msg.includes('client was closed') ||
    msg.includes('socket has been ended') ||
    code === '57p01' || // admin_shutdown
    code === '57p02' || // crash_shutdown
    code === '57p03'    // cannot_connect_now
  );
};

// Retry transient connection drops/timeouts with a fresh connection from the pool
const executeWithRetry = async (fn, maxRetries = 1) => {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt < maxRetries && isTransientConnectionError(error)) {
        attempt += 1;
        console.warn(`PostgreSQL transient error (${error.message}). Retrying query (attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      throw error;
    }
  }
};

// Check if PostgreSQL is actually reachable (not just configured)
const isPostgresAvailable = async () => {
  if (!pgAvailable || !pool) return false;
  try {
    await executeWithRetry(() => pool.query('SELECT 1'));
    return true;
  } catch (error) {
    console.warn('PostgreSQL connection check failed:', error.message);
    return false;
  }
};

// Convert MySQL-style ? placeholders to PostgreSQL $1, $2, ... format
const convertPlaceholders = (sql) => {
  let paramIndex = 0;
  return sql.replace(/\?/g, () => {
    paramIndex += 1;
    return `$${paramIndex}`;
  });
};

// ========== Base64 Image Helpers ==========

const isBase64Image = (url = '') => {
  return typeof url === 'string' && url.startsWith('data:image');
};

const isExternalUrl = (url = '') => {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
};

const isLocalPath = (url = '') => {
  return typeof url === 'string' && url.startsWith('/') && !isBase64Image(url);
};

const localPathToBase64 = (filePath = '') => {
  try {
    if (!filePath || !isLocalPath(filePath)) return null;
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const fullPath = path.join(process.cwd(), 'public', cleanPath);

    if (!fs.existsSync(fullPath)) return null;

    const buffer = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.warn(`Failed to convert local image to base64: ${filePath}`, error.message);
    return null;
  }
};

// Fields that may contain image URLs
const IMAGE_FIELDS = [
  'image_url', 'background_image', 'cover_image', 'image',
  'experience_image', 'why_image', 'promise_image', 'difference_image',
  'icon', 'video_url', 'influencer_video_url'
];

// Local development keeps image data self-contained as base64. In production,
// preserve stored upload paths so browsers retrieve the image file normally.
const processImageFields = (row) => {
  if (!row || typeof row !== 'object') return row;

  const processed = { ...row };
  for (const field of IMAGE_FIELDS) {
    if (process.env.NODE_ENV !== 'production' && processed[field] && typeof processed[field] === 'string' && isLocalPath(processed[field])) {
      const base64 = localPathToBase64(processed[field]);
      if (base64) {
        processed[field] = base64;
      }
    }
  }
  return processed;
};

// Process an array of row objects to convert local paths
const processRows = (rows) => {
  if (!Array.isArray(rows)) return rows;
  return rows.map(row => processImageFields(row));
};

// ========== Query Functions ==========

// Generic query function with fallback
const query = async (sql, params = []) => {
  const sqlLower = sql.toLowerCase().trim();

  // CREATE/ALTER/INSERT/UPDATE/DELETE queries - only work with PostgreSQL
  const isDDL = sqlLower.startsWith('create') || sqlLower.startsWith('alter') ||
                sqlLower.startsWith('insert') || sqlLower.startsWith('update') ||
                sqlLower.startsWith('delete') || sqlLower.startsWith('truncate') ||
                sqlLower.startsWith('drop');

  if (isDDL) {
    // These queries require PostgreSQL
    if (!pgAvailable || !pool) {
      console.warn('DDL query skipped - PostgreSQL not available:', sql);
      // Return dummy result for INSERT (to get insertId)
      if (sqlLower.startsWith('insert')) {
        return { id: Date.now() };
      }
      return [];
    }

    try {
      const pgSql = convertPlaceholders(sql);
      const result = await executeWithRetry(() => pool.query(pgSql, params));

      // For INSERT with RETURNING, return the row
      if (result.rows && result.rows.length > 0) {
        return result.rows[0];
      }

      // For INSERT without RETURNING, return insertId
      if (sqlLower.startsWith('insert')) {
        return { id: Date.now() };
      }

      return result.rows || [];
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // SELECT queries - use PostgreSQL if available, otherwise JSON fallback
  if (pgAvailable && pool) {
    try {
      const pgSql = convertPlaceholders(sql);
      const result = await executeWithRetry(() => pool.query(pgSql, params));
      return processRows(result.rows || []);
    } catch (error) {
      // If PostgreSQL is configured but query fails (e.g. table doesn't exist),
      // throw the error instead of silently falling back to JSON.
      // This ensures the setup route can properly create tables.
      console.error('PostgreSQL query error:', error.message);
      throw error;
    }
  }

  // Fallback to JSON file for SELECT queries (only when PostgreSQL is NOT available)
  const data = loadJsonData();
  if (!data) {
    throw new Error('No database available (PostgreSQL connection failed and no JSON fallback)');
  }

  // Parse SQL to determine which table to query
  const fromMatch = sqlLower.match(/from\s+(\w+)/);
  const whereMatch = sqlLower.match(/where\s+(.+?)(?:\s+order|\s+limit|\s+group|$)/i);

  if (!fromMatch) {
    throw new Error('Invalid SQL query for JSON fallback');
  }

  const tableName = fromMatch[1];
  let results = data[tableName] || [];

  // Handle WHERE conditions (simple cases only)
  if (whereMatch && results.length > 0) {
    const whereClause = whereMatch[1];

    // Handle is_active = true/false
    const isActiveMatch = whereClause.match(/is_active\s*=\s*(true|false)/i);
    if (isActiveMatch) {
      const isActiveValue = isActiveMatch[1].toLowerCase() === 'true';
      results = results.filter(item => item.is_active === (isActiveValue ? 1 : 0));
    }

    // Handle id = ?
    if (whereClause.includes('= ?') || whereClause.includes('=?')) {
      const paramValue = params[0];
      if (paramValue !== undefined) {
        // Try to match by id
        const idMatch = whereClause.match(/id\s*=\s*\?/);
        if (idMatch) {
          results = results.filter(item => item.id === paramValue);
        }
      }
    }
  }

  return processRows(results);
};

// Generic get one
const getOne = async (table, id) => {
  const results = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return results[0] || null;
};

// Generic insert
// const insert = async (table, data) => {
//   const keys = Object.keys(data);
//   const values = Object.values(data);
//   const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

//   const result = await query(
//     `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING id`,
//     values
//   );

//   return { ...data, id: result.id };
// };
const insert = async (table, data) => {
  const keys = Object.keys(data);

  const values = Object.values(data).map((value) => {
    if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
      return JSON.stringify(value);
    }

    return value;
  });

  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

  const result = await query(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING id`,
    values
  );

  return { ...data, id: result.id };
};

// Generic update
// const update = async (table, id, data) => {
//   const keys = Object.keys(data);
//   const values = Object.values(data);
//   const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

//   await query(
//     `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1}`,
//     [...values, id]
//   );

//   return { ...data, id };
// };

const update = async (table, id, data) => {
  const keys = Object.keys(data);

  const values = Object.values(data).map((value) => {
    if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
      return JSON.stringify(value);
    }

    return value;
  });

  const setClause = keys
    .map((key, i) => `${key} = $${i + 1}`)
    .join(', ');

  await query(
    `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1}`,
    [...values, id]
  );

  return { ...data, id };
};

// Generic delete
const remove = async (table, id) => {
  await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  return true;
};

// Run SQL (for compatibility)
const run = async (sql, params = []) => {
  return await query(sql, params);
};

export default {
  query,
  get: getOne,
  insert,
  update,
  delete: remove,
  run,
  // Export helpers too
  processRows,
  processImageFields,
  localPathToBase64,
  isPostgresAvailable
};
