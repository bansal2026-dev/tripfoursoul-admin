import { NextResponse } from 'next/server';

// Path prefix -> permission key mapping for admin pages (dashboard and profile accessible to all)
const PERMISSION_BY_PATH = [
  { prefix: '/dashboard', permission: null },
  { prefix: '/homepage', permission: 'homepage' },
  { prefix: '/offers', permission: 'offers' },
  { prefix: '/banner', permission: 'banner' },
  { prefix: '/trending', permission: 'trending' },
  { prefix: '/pricing', permission: 'pricing' },
  { prefix: '/destinations', permission: 'destinations' },
  { prefix: '/packages', permission: 'packages' },
  { prefix: '/spiritual', permission: 'spiritual' },
  { prefix: '/about', permission: 'about' },
  { prefix: '/features', permission: 'features' },
  { prefix: '/services', permission: 'services' },
  { prefix: '/testimonials', permission: 'testimonials' },
  { prefix: '/page-banners', permission: 'page-banners' },
  { prefix: '/gallery', permission: 'gallery' },
  { prefix: '/team-members', permission: 'team-members' },
  { prefix: '/deals', permission: 'deals' },
  { prefix: '/sections', permission: 'sections' },
  { prefix: '/blog', permission: 'blog' },
  { prefix: '/staff', permission: 'staff' },
  { prefix: '/profile', permission: null },
];

// API prefix -> permission key mapping
const API_PERMISSION_BY_PATH = {
  '/api/banner': 'banner',
  '/api/offers': 'offers',
  '/api/trending': 'trending',
  '/api/trending/items': 'trending',
  '/api/trending/toggle': 'trending',
  '/api/pricing': 'pricing',
  '/api/destinations': 'destinations',
  '/api/destination-packages': 'packages',
  '/api/packages': 'packages',
  '/api/about': 'about',
  '/api/features': 'features',
  '/api/services': 'services',
  '/api/testimonials': 'testimonials',
  '/api/page-banners': 'page-banners',
  '/api/gallery': 'gallery',
  '/api/team-members': 'team-members',
  '/api/deals': 'deals',
  '/api/sections': 'sections',
  '/api/blog': 'blog',
  '/api/leads': 'leads',
};

// Decode JWT payload without verification (verification happens in the route handlers)
function decodeTokenPayload(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// Routes that have been consolidated into /homepage
const REDIRECT_TO_HOMEPAGE = ['/banner', '/trending', '/features', '/testimonials', '/deals', '/sections'];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Redirect old homepage section routes to /homepage
  if (REDIRECT_TO_HOMEPAGE.includes(pathname)) {
    return NextResponse.redirect(new URL('/homepage', request.url));
  }

  // Redirect root path to /login
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Allow public GET requests to API (for frontend integration)
  if (pathname.startsWith('/api/') && method === 'GET') {
    return NextResponse.next();
  }

  // Always allow login page, API login route, setup, seed, and uploaded files
  if (
    pathname === '/login' ||
    pathname === '/api/auth/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/api/auth/forgot-password' ||
    pathname === '/api/auth/reset-password' ||
    pathname === '/api/setup' ||
    pathname === '/api/seed' ||
    pathname.startsWith('/uploads/')
  ) {
    return NextResponse.next();
  }

  // Public website enquiries authenticate with a shared internal API key,
  // rather than an admin browser session. Other lead methods continue below
  // through the regular session/permission flow.
  if (pathname === '/api/leads' && method === 'POST') {
    const expectedKey = process.env.LEADS_API_KEY;
    const requestKey = request.headers.get('x-leads-api-key');
    if (!expectedKey || requestKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Extract token from cookie
  const token = request.cookies.get('token')?.value;
  const payload = token ? decodeTokenPayload(token) : null;

  // Protect all write API routes (POST, PUT, DELETE)
  if (pathname.startsWith('/api/')) {
    // Staff management API does its own auth checks
    if (pathname === '/api/auth/staff') {
      return NextResponse.next();
    }

    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin / super_admin bypass permission checks
    if (payload.role === 'admin' || payload.role === 'super_admin') {
      return NextResponse.next();
    }

    // Staff: check permission for this API route
    if (payload.role === 'staff') {
      const apiPath = Object.keys(API_PERMISSION_BY_PATH).find((prefix) =>
        pathname.startsWith(prefix)
      );
      if (apiPath) {
        const required = API_PERMISSION_BY_PATH[apiPath];
        const userPerms = payload.permissions || [];
        if (!userPerms.includes(required)) {
          return NextResponse.json(
            { error: 'Forbidden: You do not have access to this section' },
            { status: 403 }
          );
        }
      }
    }

    return NextResponse.next();
  }

  // Protect admin page routes
  if (!pathname.startsWith('/api/') && pathname !== '/login') {
    if (!payload) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Admin / super_admin bypass permission checks
    if (payload.role === 'admin' || payload.role === 'super_admin') {
      return NextResponse.next();
    }

    // Staff: restrict pages based on permissions
    if (payload.role === 'staff') {
      // Dashboard and profile are accessible to all authenticated staff members
      if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
        return NextResponse.next();
      }

      const matched = PERMISSION_BY_PATH.find((item) =>
        pathname.startsWith(item.prefix)
      );
      if (!matched || !matched.permission) return NextResponse.next();

      let userPerms = payload.permissions || [];
      if (typeof userPerms === 'string') {
        try { userPerms = JSON.parse(userPerms); } catch { userPerms = []; }
      }
      if (!Array.isArray(userPerms) || !userPerms.includes(matched.permission)) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
