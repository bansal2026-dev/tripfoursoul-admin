import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { signToken } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

// Fallback login using JSON file
const loginWithJson = async (identifier, password) => {
  try {
    const jsonPath = path.join(process.cwd(), 'database.json');
    if (!fs.existsSync(jsonPath)) {
      return null;
    }
    
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const admins = data.admins || [];
    
    // Find admin by username or email
    const normalizedIdentifier = String(identifier).trim();
    const admin = admins.find(a => a.username === normalizedIdentifier || String(a.email || '').toLowerCase() === normalizedIdentifier.toLowerCase());
    if (!admin) {
      return null;
    }
    
    // Check password
    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      return null;
    }
    
    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role || 'admin',
      permissions: admin.permissions || (admin.username === 'admin' ? null : []),
    };
  } catch (error) {
    console.error('JSON login error:', error);
    return null;
  }
};

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    const identifier = String(username || '').trim();

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Username/email and password required' }, { status: 400 });
    }

    let admin = null;
    
    // Try PostgreSQL first
    try {
      const admins = await db.query(
        `SELECT * FROM admins 
         WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) OR (LOWER(email) = 'bhskrbnsl@gmail.com' AND LOWER($1) IN ('bhaskar', 'bhaskarbansal')))
           AND (is_active IS NOT FALSE)`,
        [identifier]
      );
      if (admins.length > 0) {
        const adminData = admins[0];
        const isValid = await bcrypt.compare(password, adminData.password);
        if (isValid) {
          admin = {
            id: adminData.id,
            username: adminData.username,
            email: adminData.email,
            role: adminData.role || 'admin',
            permissions: adminData.permissions || (adminData.username === 'admin' ? null : []),
          };

          // Sync password hash to database.json in background so JSON fallback stays in sync
          try {
            const jsonPath = path.join(process.cwd(), 'database.json');
            if (fs.existsSync(jsonPath)) {
              const fileData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
              let modified = false;
              if (Array.isArray(fileData.admins)) {
                fileData.admins = fileData.admins.map((a) => {
                  if (
                    String(a.email || '').toLowerCase() === String(adminData.email || '').toLowerCase() ||
                    String(a.username || '').toLowerCase() === String(adminData.username || '').toLowerCase()
                  ) {
                    modified = true;
                    return { ...a, password: adminData.password };
                  }
                  return a;
                });
                if (modified) {
                  fs.writeFileSync(jsonPath, JSON.stringify(fileData, null, 2));
                }
              }
            }
          } catch (syncErr) {
            // Non-critical, ignore sync error
          }
        }
      }
    } catch (pgError) {
      console.warn('PostgreSQL login failed, trying JSON fallback:', pgError.message);
    }
    
    // Fallback to JSON if PostgreSQL failed or did not match
    if (!admin) {
      admin = await loginWithJson(identifier, password);
    }

    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({
      id: admin.id,
      username: admin.username,
      role: admin.role || 'admin',
      permissions: admin.permissions || (admin.username === 'admin' ? null : []),
    });

    const response = NextResponse.json({ success: true, token });
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 86400,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
