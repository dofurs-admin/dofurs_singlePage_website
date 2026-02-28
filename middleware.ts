import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const protectedRoutes = ['/dashboard', '/forms/customer-booking', '/api/bookings', '/api/storage', '/api/provider', '/api/admin'];

function isProtectedPath(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  if (!isProtectedPath(pathname)) {
    return response;
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));

  if (!hasAuthCookie) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/auth/sign-in';
    signInUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/forms/customer-booking/:path*',
    '/api/bookings/:path*',
    '/api/storage/:path*',
    '/api/provider/:path*',
    '/api/admin/:path*',
  ],
};
