import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import db from '@/lib/db';

export async function GET(request) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    let account = null;
    try {
      const admins = await db.query('SELECT id, username, email, role, permissions, is_active, created_at FROM admins WHERE id = $1', [payload.id]);
      account = admins[0] || null;
    } catch {
      // The signed token remains sufficient if the database is temporarily unavailable.
    }

    const userRole = account?.role || payload.role || 'admin';
    let userPermissions = account?.permissions ?? payload.permissions ?? null;
    if (typeof userPermissions === 'string') {
      try { userPermissions = JSON.parse(userPermissions); } catch { userPermissions = []; }
    }
    if (userRole === 'staff') {
      if (!Array.isArray(userPermissions)) userPermissions = [];
      if (!userPermissions.includes('dashboard')) userPermissions.unshift('dashboard');
    } else if (userRole === 'admin' || userRole === 'super_admin') {
      userPermissions = null;
    }

    return NextResponse.json({
      user: {
        id: account?.id || payload.id,
        username: account?.username || payload.username,
        email: account?.email || '',
        role: account?.role || payload.role || 'admin',
        permissions: account?.permissions || payload.permissions || null,
        role: userRole,
        permissions: userPermissions,
        is_active: account?.is_active ?? true,
        created_at: account?.created_at || null,
      }
    });
  } catch (error) {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}