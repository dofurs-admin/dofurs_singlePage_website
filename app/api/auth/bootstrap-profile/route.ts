import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export async function POST() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let { data: existingProfile, error: existingProfileError } = await supabase
    .from('users')
    .select('id, name, phone, photo_url, gender')
    .eq('id', user.id)
    .maybeSingle();

  if (existingProfileError) {
    return NextResponse.json({ error: existingProfileError.message }, { status: 500 });
  }

  if (!existingProfile) {
    const metadataName =
      (typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : null) ??
      (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null);
    const metadataPhone = typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : null;
    const metadataAddress = typeof user.user_metadata?.address === 'string' ? user.user_metadata.address : null;
    const metadataAgeRaw = user.user_metadata?.age;
    const metadataAge = typeof metadataAgeRaw === 'number' ? metadataAgeRaw : Number(metadataAgeRaw);
    const metadataGenderRaw = user.user_metadata?.gender;
    const metadataGender = metadataGenderRaw === 'male' || metadataGenderRaw === 'female' || metadataGenderRaw === 'other'
      ? metadataGenderRaw
      : null;

    const canAutoCreateProfile =
      Boolean(metadataName?.trim()) &&
      Boolean(metadataPhone?.trim()) &&
      /^\+[1-9]\d{6,14}$/.test(metadataPhone?.trim() ?? '') &&
      Boolean(metadataAddress?.trim()) &&
      Number.isInteger(metadataAge) &&
      metadataAge >= 13 &&
      metadataAge <= 120 &&
      Boolean(metadataGender);

    if (!canAutoCreateProfile) {
      return NextResponse.json(
        {
          error: 'Profile setup incomplete. Please complete sign up first.',
          requiresProfileSetup: true,
        },
        { status: 409 },
      );
    }

    const { data: userRole, error: roleError } = await supabase.from('roles').select('id').eq('name', 'user').single();

    if (roleError || !userRole) {
      return NextResponse.json({ error: 'Default role not configured' }, { status: 500 });
    }

    const { error: createProfileError } = await supabase.from('users').upsert(
      {
        id: user.id,
        name: metadataName?.trim() ?? null,
        email: user.email?.trim().toLowerCase() ?? null,
        phone: metadataPhone?.trim() ?? null,
        address: metadataAddress?.trim() ?? null,
        age: metadataAge,
        gender: metadataGender,
        role_id: userRole.id,
      },
      { onConflict: 'id' },
    );

    if (createProfileError) {
      return NextResponse.json({ error: createProfileError.message }, { status: 500 });
    }

    const reloadProfileResult = await supabase
      .from('users')
      .select('id, name, phone, photo_url, gender')
      .eq('id', user.id)
      .maybeSingle();

    if (reloadProfileResult.error) {
      return NextResponse.json({ error: reloadProfileResult.error.message }, { status: 500 });
    }

    existingProfile = reloadProfileResult.data;

    if (!existingProfile) {
      return NextResponse.json(
        {
          error: 'Profile setup incomplete. Please complete sign up first.',
          requiresProfileSetup: true,
        },
        { status: 409 },
      );
    }
  }

  const { data: existingOwnerProfile, error: existingOwnerProfileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existingOwnerProfileError) {
    return NextResponse.json({ error: existingOwnerProfileError.message }, { status: 500 });
  }

  if (!existingOwnerProfile && existingProfile.phone) {
    const fallbackName = existingProfile.name?.trim() || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Pet Owner';

    const { error: createOwnerProfileError } = await supabase.from('profiles').insert({
      id: user.id,
      full_name: fallbackName,
      phone_number: existingProfile.phone,
      profile_photo_url: existingProfile.photo_url,
      gender: existingProfile.gender,
    });

    if (createOwnerProfileError && createOwnerProfileError.code !== '23505') {
      return NextResponse.json({ error: createOwnerProfileError.message }, { status: 500 });
    }
  }

  if (existingOwnerProfile || existingProfile.phone) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    {
      error: 'Profile setup incomplete. Please complete sign up first.',
      requiresProfileSetup: true,
    },
    { status: 409 },
  );
}
