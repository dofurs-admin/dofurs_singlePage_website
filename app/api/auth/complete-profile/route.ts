import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/),
  email: z.string().trim().email().max(200).optional(),
  address: z.string().trim().min(5).max(300),
  age: z.number().int().min(13).max(120),
  gender: z.enum(['male', 'female', 'other']),
});

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid profile payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedEmail = (parsed.data.email ?? user.email ?? '').trim().toLowerCase();
  const normalizedPhone = parsed.data.phone.trim();
  const normalizedAddress = parsed.data.address.trim();
  const normalizedGender = parsed.data.gender;
  const normalizedAge = parsed.data.age;

  if (normalizedEmail) {
    const { data: existingEmailProfile, error: existingEmailProfileError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', normalizedEmail)
      .neq('id', user.id)
      .maybeSingle();

    if (existingEmailProfileError) {
      return NextResponse.json({ error: existingEmailProfileError.message }, { status: 500 });
    }

    if (existingEmailProfile) {
      return NextResponse.json({ error: 'This email is already registered. Please use Log in.' }, { status: 409 });
    }
  }

  const { data: existingPhoneProfile, error: existingPhoneProfileError } = await supabase
    .from('users')
    .select('id')
    .eq('phone', normalizedPhone)
    .neq('id', user.id)
    .maybeSingle();

  if (existingPhoneProfileError) {
    return NextResponse.json({ error: existingPhoneProfileError.message }, { status: 500 });
  }

  if (existingPhoneProfile) {
    return NextResponse.json({ error: 'This phone number is already in use.' }, { status: 409 });
  }

  const { data: userRole, error: roleError } = await supabase.from('roles').select('id').eq('name', 'user').single();

  if (roleError || !userRole) {
    return NextResponse.json({ error: 'Default role not configured' }, { status: 500 });
  }

  const { error: upsertError } = await supabase.from('users').upsert(
    {
      id: user.id,
      phone: normalizedPhone,
      name: parsed.data.name,
      email: normalizedEmail || null,
      address: normalizedAddress,
      age: normalizedAge,
      gender: normalizedGender,
      role_id: userRole.id,
    },
    { onConflict: 'id' },
  );

  if (upsertError) {
    const message = upsertError.message.toLowerCase();

    if (message.includes('users_phone_key')) {
      return NextResponse.json({ error: 'This phone number is already in use.' }, { status: 409 });
    }

    if (message.includes('users_email_unique_ci_idx') || message.includes('email')) {
      return NextResponse.json({ error: 'This email is already registered. Please use Log in.' }, { status: 409 });
    }

    if (message.includes('duplicate key') || message.includes('unique')) {
      return NextResponse.json({ error: 'A duplicate profile value exists. Please verify email and phone.' }, { status: 409 });
    }

    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
