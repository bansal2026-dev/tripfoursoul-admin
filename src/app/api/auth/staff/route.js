import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { signToken } from '@/lib/auth';

const AVAILABLE_PERMISSIONS = [
  'dashboard', 'banner', 'trending', 'pricing', 'destinations', 'packages',
  'offers',
  'spiritual', 'about', 'features', 'services', 'testimonials', 'page-banners', 'gallery',
  'team-members', 'deals', 'sections', 'blog', 'staff'
];

// Parse permissions: DB stores it as a JSON string, we need an array
const parsePermissions = (perms) => {
  if (Array.isArray(perms)) return perms;
  if (typeof perms === 'string') {
    try { return JSON.parse(perms); } catch { return []; }
  }
  return [];
};

// GET - List all staff members (admin only)
export async function GET(request) {
  try {
    // Verify caller is admin
    const token = request.headers.get('cookie')?.match(/(?:^|;\s*)token=([^;]*)/)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { verifyToken } = await import('@/lib/auth');
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const admins = await db.query('SELECT * FROM admins');
    const filtered = admins.map(({ password, ...admin }) => ({
      ...admin,
      permissions: parsePermissions(admin.permissions),
    }));
    const filtered = admins.map(({ password, ...admin }) => {
      let perms = parsePermissions(admin.permissions);
      if (admin.role === 'staff' && !perms.includes('dashboard')) {
        perms.unshift('dashboard');
      }
      return {
        ...admin,
        permissions: perms,
      };
    });
    
    // Non-admin can only see themselves
    if (payload.role !== 'admin' && payload.role !== 'super_admin') {
      return NextResponse.json({ staff: filtered.filter(a => a.id === payload.id) });
    }
    
    return NextResponse.json({ staff: filtered });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create staff member (super admin only)
export async function POST(request) {
  try {
    const token = request.headers.get('cookie')?.match(/(?:^|;\s*)token=([^;]*)/)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { verifyToken } = await import('@/lib/auth');
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can create staff accounts' }, { status: 403 });
    }
    
    const body = await request.json();
    const { username, email, password, role, permissions } = body;
    
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }
    
    const existing = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const cleanPermissions = (permissions || []).filter(p => AVAILABLE_PERMISSIONS.includes(p));
    const targetRole = role || 'staff';
    if (targetRole === 'staff' && !cleanPermissions.includes('dashboard')) {
      cleanPermissions.unshift('dashboard');
    }
    
    const staff = await db.insert('admins', {
      username,
      email: email || '',
      password: hashedPassword,
      role: role || 'staff',
      permissions: cleanPermissions,
      is_active: true,
      created_at: new Date().toISOString().replace('T', ' ').split('.')[0],
    });
    
    const { password: _, ...safeStaff } = staff;
    return NextResponse.json({ success: true, staff: safeStaff });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update staff member (admin only)
export async function PUT(request) {
  try {
    const token = request.headers.get('cookie')?.match(/(?:^|;\s*)token=([^;]*)/)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { verifyToken } = await import('@/lib/auth');
    const payload = verifyToken(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Only administrators can update staff accounts' }, { status: 403 });
    }
    
    const body = await request.json();
    const { id, username, email, password, role, permissions, is_active } = body;
    
    if (!id) return NextResponse.json({ error: 'Staff ID required' }, { status: 400 });
    
    const existing = await db.query('SELECT * FROM admins WHERE id = $1', [Number(id)]);
    if (existing.length === 0) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    
    const existingStaff = existing[0];

    // Cannot modify the primary admin account
    if (existingStaff.username === 'admin' && role && role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Cannot change the primary admin role' }, { status: 403 });
    }
    
    const updateData = {};
    if (username) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (role && existingStaff.username !== 'admin') updateData.role = role;
    if (permissions !== undefined) {
      updateData.permissions = permissions.filter(p => AVAILABLE_PERMISSIONS.includes(p));
      const cleanPerms = permissions.filter(p => AVAILABLE_PERMISSIONS.includes(p));
      const targetRole = role || existingStaff.role;
      if (targetRole === 'staff' && !cleanPerms.includes('dashboard')) {
        cleanPerms.unshift('dashboard');
      }
      updateData.permissions = cleanPerms;
    }
    if (is_active !== undefined && existingStaff.username !== 'admin') updateData.is_active = is_active;
    
    const updated = await db.update('admins', Number(id), updateData);
    const { password: _, ...safeStaff } = updated;
    return NextResponse.json({ success: true, staff: safeStaff });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete staff member (super admin only)
export async function DELETE(request) {
  try {
    const token = request.headers.get('cookie')?.match(/(?:^|;\s*)token=([^;]*)/)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { verifyToken } = await import('@/lib/auth');
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can delete staff accounts' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'Staff ID required' }, { status: 400 });
    
    const existing = await db.query('SELECT * FROM admins WHERE id = $1', [id]);
    if (existing.length === 0) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    if (existing[0].username === 'admin') {
      return NextResponse.json({ error: 'Cannot delete the primary admin account' }, { status: 403 });
    }
    
    await db.delete('admins', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
