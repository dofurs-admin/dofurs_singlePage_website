import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { ownerProfileSchema } from '@/lib/flows/validation';

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = ownerProfileSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid sign-up payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const normalizedPhone = parsed.data.phone.trim();

  const [emailInProfilesResult, phoneInProfilesResult] = await Promise.all([
    admin.from('users').select('id').ilike('email', normalizedEmail).limit(1).maybeSingle(),
    admin.from('users').select('id').eq('phone', normalizedPhone).limit(1).maybeSingle(),
  ]);

  if (emailInProfilesResult.error || phoneInProfilesResult.error) {
    console.error('pre-signup validation failed', {
      emailError: emailInProfilesResult.error?.message,
      phoneError: phoneInProfilesResult.error?.message,
    });
    return NextResponse.json({ error: 'Unable to validate sign-up details right now.' }, { status: 500 });
  }

  if (emailInProfilesResult.data) {
    return NextResponse.json({ error: 'This email is already registered. Please use Log in.' }, { status: 409 });
  }

  if (phoneInProfilesResult.data) {
    return NextResponse.json({ error: 'This phone number is already in use.' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
