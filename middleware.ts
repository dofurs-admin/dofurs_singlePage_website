import { NextResponse, type NextRequest } from 'next/server';
import { INACTIVITY_COOKIE_NAME, isInactivityExpired } from '@/lib/auth/inactivity';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';
import { type AppRole, isRoleAllowed } from '@/lib/auth/api-auth';

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

const roleGuards: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: '/dashboard/user', roles: ['user'] },
  { prefix: '/dashboard/provider', roles: ['provider'] },
  { prefix: '/dashboard/admin', roles: ['admin', 'staff'] },
  { prefix: '/api/provider', roles: ['provider', 'admin', 'staff'] },
  { prefix: '/api/admin', roles: ['admin', 'staff'] },
];

function getRequiredRoles(pathname: string) {
  const match = roleGuards.find((guard) => pathname === guard.prefix || pathname.startsWith(`${guard.prefix}/`));
  return match?.roles ?? null;
}

function resolveFallbackPath(role: AppRole | null) {
  if (role === 'admin' || role === 'staff') {
    return '/dashboard/admin';
  }

  if (role === 'provider') {
    return '/dashboard/provider';
  }

  return '/dashboard/user';
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const { response, user } = await updateSession(request);

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

  const requiredRoles = getRequiredRoles(pathname);

  if (!requiredRoles || !user) {
    return response;
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: profile } = await supabase.from('users').select('roles(name)').eq('id', user.id).single();
  const roleName = (Array.isArray(profile?.roles) ? profile?.roles[0] : profile?.roles)?.name as AppRole | undefined;

  // Check if provider account is suspended
  if (roleName === 'provider') {
    const { data: provider } = await supabase
      .from('providers')
      .select('account_status')
      .eq('user_id', user.id)
      .single();

    if (provider?.account_status === 'suspended' || provider?.account_status === 'banned') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
      }
      const suspendedUrl = request.nextUrl.clone();
      suspendedUrl.pathname = '/auth/suspended';
      return NextResponse.redirect(suspendedUrl);
    }
  }

  if (isRoleAllowed(roleName ?? null, requiredRoles)) {
    return response;
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const fallbackUrl = request.nextUrl.clone();
  fallbackUrl.pathname = resolveFallbackPath(roleName ?? null);
  return NextResponse.redirect(fallbackUrl);

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
