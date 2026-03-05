import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { toFriendlyApiError } from '@/lib/api/errors';

export async function POST() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: existingProfileData, error: existingProfileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  let existingProfile = existingProfileData;

  if (existingProfileError) {
    const mapped = toFriendlyApiError(existingProfileError, 'Unable to bootstrap profile');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
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
      const mapped = toFriendlyApiError(createProfileError, 'Unable to bootstrap profile');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    const reloadProfileResult = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (reloadProfileResult.error) {
      const mapped = toFriendlyApiError(reloadProfileResult.error, 'Unable to bootstrap profile');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
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
    const mapped = toFriendlyApiError(existingOwnerProfileError, 'Unable to bootstrap profile');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const profilePhone = typeof existingProfile?.phone === 'string' ? existingProfile.phone : null;
  const profileName = typeof existingProfile?.name === 'string' ? existingProfile.name : null;
  const profilePhotoUrl = typeof existingProfile?.photo_url === 'string' ? existingProfile.photo_url : null;
  const profileGender =
    existingProfile?.gender === 'male' || existingProfile?.gender === 'female' || existingProfile?.gender === 'other'
      ? existingProfile.gender
      : null;

  if (!existingOwnerProfile && profilePhone) {
    const fallbackName = profileName?.trim() || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Pet Owner';

    const { error: createOwnerProfileError } = await supabase.from('profiles').insert({
      id: user.id,
      full_name: fallbackName,
      phone_number: profilePhone,
      profile_photo_url: profilePhotoUrl,
      gender: profileGender,
    });

    if (createOwnerProfileError && createOwnerProfileError.code !== '23505') {
      const mapped = toFriendlyApiError(createOwnerProfileError, 'Unable to bootstrap profile');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
  }

  if (existingOwnerProfile || profilePhone) {
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
