import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';

const PROTECTED_ROUTES = ['/habits', '/sessions', '/rankings', '/timer', '/account'];
const AUTH_ROUTES = ['/login'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('session')?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Redirect unauthenticated users to /login
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Redirect authenticated users away from /login and /
  if (session && (AUTH_ROUTES.includes(pathname) || pathname === '/')) {
    return NextResponse.redirect(new URL('/habits', request.url));
  }

  // Redirect / to /login for unauthenticated
  if (pathname === '/' && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/habits/:path*', '/sessions/:path*', '/rankings/:path*', '/timer/:path*', '/account/:path*'],
};
