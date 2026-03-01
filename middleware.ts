import { NextResponse, type NextRequest } from 'next/server';
import { INACTIVITY_COOKIE_NAME, isInactivityExpired } from '@/lib/auth/inactivity';
import { updateSession } from '@/lib/supabase/middleware';

const protectedRoutes = [
  '/dashboard',
  '/forms/customer-booking',
  '/api/bookings',
  '/api/storage',
  '/api/provider',
  '/api/admin',
  '/api/user',
];

function clearSessionCookies(request: NextRequest) {
  const response = NextResponse.next({ request });

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', {
        path: '/',
        maxAge: 0,
      });
    }
  }

  response.cookies.set(INACTIVITY_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}

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

  const lastActivityCookieValue = request.cookies.get(INACTIVITY_COOKIE_NAME)?.value;
  const lastActivityAt = Number(lastActivityCookieValue ?? '0');

  if (isInactivityExpired(lastActivityAt)) {
    if (pathname.startsWith('/api/')) {
      const expiredResponse = NextResponse.json({ error: 'Session expired due to inactivity.' }, { status: 401 });
      const cleared = clearSessionCookies(request);

      for (const cookie of cleared.cookies.getAll()) {
        expiredResponse.cookies.set(cookie);
      }

      return expiredResponse;
    }

    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/auth/sign-in';
    signInUrl.searchParams.set('next', pathname);
    signInUrl.searchParams.set('reason', 'inactive');

    const redirectResponse = NextResponse.redirect(signInUrl);
    const cleared = clearSessionCookies(request);

    for (const cookie of cleared.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    return redirectResponse;
  }

  if (!lastActivityCookieValue) {
    response.cookies.set(INACTIVITY_COOKIE_NAME, String(Date.now()), {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
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
    '/api/user/:path*',
  ],
};
