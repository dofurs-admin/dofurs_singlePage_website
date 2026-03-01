import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/dashboard';
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  const redirectUrl = new URL(next, url.origin);
  const isSignUpFlow =
    redirectUrl.pathname === '/auth/sign-up' ||
    (redirectUrl.pathname === '/auth/sign-in' && redirectUrl.searchParams.get('mode') === 'signup');
  const authPageUrl = new URL('/auth/sign-in', url.origin);

  if (isSignUpFlow) {
    authPageUrl.searchParams.set('mode', 'signup');
  }

  if (!isSignUpFlow && next) {
    authPageUrl.searchParams.set('next', next);
  }

  const supabase = await getSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      authPageUrl.searchParams.set('error_code', 'exchange_failed');
      authPageUrl.searchParams.set('error_description', error.message);
      return NextResponse.redirect(authPageUrl);
    }
  } else if (tokenHash && type === 'email') {
    const { error } = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash: tokenHash,
    });

    if (error) {
      authPageUrl.searchParams.set('error_code', 'otp_invalid');
      authPageUrl.searchParams.set('error_description', error.message);
      return NextResponse.redirect(authPageUrl);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    authPageUrl.searchParams.set('error_code', 'auth_session_missing');
    authPageUrl.searchParams.set('error_description', 'Email link is invalid or has expired. Request a new link.');
    return NextResponse.redirect(authPageUrl);
  }

  if (isSignUpFlow) {
    const signupName = (user.user_metadata?.name as string | undefined)?.trim();
    const signupPhone = (user.user_metadata?.phone as string | undefined)?.trim();
    const signupAddress = (user.user_metadata?.address as string | undefined)?.trim();
    const signupGender = user.user_metadata?.gender as 'male' | 'female' | 'other' | undefined;
    const signupAgeRaw = user.user_metadata?.age;
    const signupAge = typeof signupAgeRaw === 'number' ? signupAgeRaw : Number(signupAgeRaw);
    const signupEmail = user.email?.trim().toLowerCase();

    if (
      !signupName ||
      !signupPhone ||
      !signupAddress ||
      !signupEmail ||
      !Number.isInteger(signupAge) ||
      signupAge < 13 ||
      signupAge > 120 ||
      (signupGender !== 'male' && signupGender !== 'female' && signupGender !== 'other')
    ) {
      authPageUrl.searchParams.set('error_code', 'signup_profile_missing');
      authPageUrl.searchParams.set('error_description', 'Missing signup details. Please start signup again.');
      return NextResponse.redirect(authPageUrl);
    }

    const completeProfileResponse = await fetch(new URL('/api/auth/complete-profile', url.origin), {
      method: 'POST',
      headers: {
        cookie: request.headers.get('cookie') ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: signupName,
        email: signupEmail,
        phone: signupPhone,
        address: signupAddress,
        age: signupAge,
        gender: signupGender,
      }),
      cache: 'no-store',
    });

    if (!completeProfileResponse.ok) {
      const payload = (await completeProfileResponse.json().catch(() => ({}))) as { error?: string };
      authPageUrl.searchParams.set('error_code', 'signup_profile_failed');
      authPageUrl.searchParams.set(
        'error_description',
        payload.error || 'Could not create your profile. Please try signup again.',
      );
      return NextResponse.redirect(authPageUrl);
    }

    await supabase.auth.signOut();

    const signUpSuccessUrl = new URL('/auth/sign-in', url.origin);
    signUpSuccessUrl.searchParams.set('mode', 'signup');
    signUpSuccessUrl.searchParams.set('created', '1');
    return NextResponse.redirect(signUpSuccessUrl);
  }

  const bootstrapResponse = await fetch(new URL('/api/auth/bootstrap-profile', url.origin), {
    method: 'POST',
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
    cache: 'no-store',
  });

  if (!bootstrapResponse.ok) {
    authPageUrl.searchParams.set('error_code', 'bootstrap_failed');
    authPageUrl.searchParams.set('error_description', 'Could not initialize your profile. Please sign in again.');
    return NextResponse.redirect(authPageUrl);
  }

  return NextResponse.redirect(redirectUrl);
}
