import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const preSignUpSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/),
  address: z.string().trim().min(5).max(300),
  age: z.number().int().min(13).max(120),
  gender: z.enum(['male', 'female', 'other']),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = preSignUpSchema.safeParse(payload);

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
