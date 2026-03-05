import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { ownerProfileSchema } from '@/lib/flows/validation';
import { toFriendlyApiError } from '@/lib/api/errors';

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = ownerProfileSchema.safeParse(payload);

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
      const mapped = toFriendlyApiError(existingEmailProfileError, 'Unable to verify email');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
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
    const mapped = toFriendlyApiError(existingPhoneProfileError, 'Unable to verify phone number');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  if (existingPhoneProfile) {
    return NextResponse.json({ error: 'This phone number is already in use.' }, { status: 409 });
  }

  const { data: userRole, error: roleError } = await supabase.from('roles').select('id').eq('name', 'user').single();

  if (roleError || !userRole) {
    return NextResponse.json({ error: 'Default role not configured' }, { status: 500 });
  }

  const { data: existingProfileRole, error: existingProfileRoleError } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', user.id)
    .maybeSingle();

  if (existingProfileRoleError) {
    const mapped = toFriendlyApiError(existingProfileRoleError, 'Unable to complete profile');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const resolvedRoleId = existingProfileRole?.role_id ?? userRole.id;

  const { error: upsertError } = await supabase.from('users').upsert(
    {
      id: user.id,
      phone: normalizedPhone,
      name: parsed.data.name,
      email: normalizedEmail || null,
      address: normalizedAddress,
      age: normalizedAge,
      gender: normalizedGender,
      role_id: resolvedRoleId,
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

    const mapped = toFriendlyApiError(upsertError, 'Unable to complete profile');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const { error: ownerProfileUpsertError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      full_name: parsed.data.name,
      phone_number: normalizedPhone,
      gender: normalizedGender,
    },
    { onConflict: 'id' },
  );

  if (ownerProfileUpsertError) {
    const mapped = toFriendlyApiError(ownerProfileUpsertError, 'Unable to complete profile');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  return NextResponse.json({ success: true });
}
