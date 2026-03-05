import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { createProvider } from '@/lib/provider-management/service';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { PROVIDER_TYPES } from '@/lib/provider-management/types';
import type { CreateProviderInput, ProviderType } from '@/lib/provider-management/types';

const EMPTY_TO_UNDEFINED = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const providerOnboardingSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
    phone: z.string().trim().min(10).max(20),
    profile_photo_url: z.preprocess(EMPTY_TO_UNDEFINED, z.string().trim().max(2000).optional()),
    provider_type: z.union([z.enum(PROVIDER_TYPES), z.literal('other')]),
    custom_provider_type: z.preprocess(EMPTY_TO_UNDEFINED, z.string().trim().max(64).optional()),
    business_name: z.preprocess(EMPTY_TO_UNDEFINED, z.string().trim().max(255).optional()),
    business_registration_number: z.preprocess(EMPTY_TO_UNDEFINED, z.string().trim().max(120).optional()),
    address: z.string().trim().min(5).max(500),
    city: z.string().trim().min(2).max(120),
    state: z.string().trim().min(2).max(120),
    pincode: z.string().trim().regex(/^\d{6}$/),
    latitude: z.preprocess(EMPTY_TO_UNDEFINED, z.coerce.number().min(-90).max(90).optional()),
    longitude: z.preprocess(EMPTY_TO_UNDEFINED, z.coerce.number().min(-180).max(180).optional()),
    service_radius_km: z.preprocess(EMPTY_TO_UNDEFINED, z.coerce.number().min(0).max(500).optional()),
    specialization: z.preprocess(EMPTY_TO_UNDEFINED, z.string().trim().max(255).optional()),
    years_of_experience: z.coerce.number().min(0).max(80),
    qualification: z.string().trim().min(2).max(255),
    compensation_type: z.enum(['salary', 'commission', 'both']),
    salary_amount: z.preprocess(EMPTY_TO_UNDEFINED, z.coerce.number().positive().optional()),
    commission_percentage: z.coerce.number().min(0).max(100),
    service_pincodes: z.preprocess(EMPTY_TO_UNDEFINED, z.string().trim().max(1000).optional()),
  })
  .superRefine((payload, context) => {
    if (payload.provider_type === 'other' && !payload.custom_provider_type?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['custom_provider_type'],
        message: 'custom_provider_type is required when provider_type is other',
      });
    }

    if ((payload.compensation_type === 'salary' || payload.compensation_type === 'both') && !payload.salary_amount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['salary_amount'],
        message: 'salary_amount is required for salary and both compensation types',
      });
    }
  });

type ProviderOnboardingPayload = z.infer<typeof providerOnboardingSchema>;

const PROVIDER_ONBOARD_IDEMPOTENCY_ENDPOINT = 'admin/providers/onboard';

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const candidates = [record.message, record.error_description, record.error, record.details, record.hint];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
  }

  return 'Failed to create provider record';
}

function getProviderCreationFriendlyMessage(rawMessage: string) {
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('provider_type_enum') ||
    normalized.includes('invalid input value for enum') ||
    normalized.includes('providers_provider_type_check')
  ) {
    return 'Provider type is not allowed by current database schema. Apply migration 017_allow_custom_provider_types.sql, then retry onboarding.';
  }

  return rawMessage;
}

function getUserProfileCreationFriendlyMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const code = typeof record.code === 'string' ? record.code : '';
    const message = typeof record.message === 'string' ? record.message : '';

    if (code === '23505' && message.includes('users_phone_key')) {
      return 'A user with this phone number already exists. Use a different phone number or promote the existing account.';
    }

    if (code === '23505' && message.includes('users_email_key')) {
      return 'A user with this email already exists. Use promote instead of onboarding.';
    }
  }

  return extractErrorMessage(error);
}

function isAuthUserNotFoundError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : '';
  const name = typeof record.name === 'string' ? record.name.toLowerCase() : '';
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';

  return code === 'user_not_found' || name.includes('usernotfound') || message.includes('user not found');
}

export async function POST(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { role, user, supabase } = auth.context;

  try {
    const idempotencyKey = request.headers.get('x-idempotency-key')?.trim() ?? '';

    if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 120)) {
      return NextResponse.json(
        { error: 'x-idempotency-key must be between 8 and 120 characters when provided' },
        { status: 400 },
      );
    }

    const payloadCandidate = (await request.json().catch(() => null)) as unknown;
    const parsedPayload = providerOnboardingSchema.safeParse(payloadCandidate);

    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parsedPayload.error.flatten() },
        { status: 400 },
      );
    }

    const payload: ProviderOnboardingPayload = parsedPayload.data;
    const adminClient = getSupabaseAdminClient();

    if (idempotencyKey) {
      const { data: existingIdempotentResponse, error: idempotencyReadError } = await adminClient
        .from('admin_idempotency_keys')
        .select('status_code, response_body')
        .eq('endpoint', PROVIDER_ONBOARD_IDEMPOTENCY_ENDPOINT)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (idempotencyReadError) {
        return NextResponse.json({ error: `Failed to check idempotency key: ${idempotencyReadError.message}` }, { status: 500 });
      }

      if (existingIdempotentResponse) {
        return NextResponse.json(existingIdempotentResponse.response_body, {
          status: existingIdempotentResponse.status_code,
        });
      }
    }

    // Determine provider type: use custom type if "other" is selected, otherwise use predefined type
    let resolvedProviderType: string;
    if (payload.provider_type === 'other' && payload.custom_provider_type?.trim()) {
      // Allow any custom provider type name - normalize it for storage
      resolvedProviderType = payload.custom_provider_type
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]/g, ''); // Remove special characters
    } else {
      resolvedProviderType = payload.provider_type as string;
    }

    if (!resolvedProviderType) {
      return NextResponse.json({ error: 'Provider type is required.' }, { status: 400 });
    }

    // Get provider role ID
    const { data: providerRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'provider')
      .single();

    if (roleError || !providerRole) {
      return NextResponse.json({ error: 'Provider role is not configured' }, { status: 500 });
    }

    // Check if user with email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .ilike('email', payload.email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists. Use the promote function instead.' },
        { status: 409 }
      );
    }

    // Check if user with phone already exists
    const normalizedPhone = payload.phone.trim();
    const { data: existingPhoneUser, error: existingPhoneUserError } = await supabase
      .from('users')
      .select('id, phone, role_id')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existingPhoneUserError) {
      return NextResponse.json({ error: `Failed to validate phone uniqueness: ${existingPhoneUserError.message}` }, { status: 500 });
    }

    if (existingPhoneUser) {
      const { data: linkedProvider, error: linkedProviderError } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', existingPhoneUser.id)
        .maybeSingle();

      if (linkedProviderError) {
        return NextResponse.json({ error: `Failed to validate provider ownership for phone: ${linkedProviderError.message}` }, { status: 500 });
      }

      const isStaleDeletedProviderUser = existingPhoneUser.role_id === providerRole.id && !linkedProvider;

      if (!isStaleDeletedProviderUser) {
        return NextResponse.json(
          { error: 'A user with this phone number already exists. Use the promote function or enter a different phone number.' },
          { status: 409 }
        );
      }

      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(existingPhoneUser.id);

      if (authDeleteError && !isAuthUserNotFoundError(authDeleteError)) {
        return NextResponse.json(
          { error: `Failed to remove stale provider account for this phone: ${authDeleteError.message}` },
          { status: 500 }
        );
      }

      const { error: staleUserDeleteError } = await adminClient.from('users').delete().eq('id', existingPhoneUser.id);

      if (staleUserDeleteError) {
        return NextResponse.json(
          { error: `Failed to clear stale phone record. Please retry: ${staleUserDeleteError.message}` },
          { status: 500 }
        );
      }
    }


    const inviteRedirectTo = new URL('/auth/callback?next=/dashboard/provider', request.url).toString();

    // Create auth user and send invite email using Supabase Admin API
    const { data: authUser, error: authError } = await adminClient.auth.admin.inviteUserByEmail(payload.email, {
      data: {
        name: payload.name.trim(),
        phone: payload.phone.trim(),
        onboarding_role: 'provider',
      },
      redirectTo: inviteRedirectTo,
    });

    if (authError || !authUser.user) {
      logSecurityEvent('error', 'admin.action', {
        route: 'api/admin/providers/onboard',
        actorId: user.id,
        actorRole: role,
        message: authError?.message || 'Failed to invite auth user',
        metadata: { email: payload.email },
      });

      return NextResponse.json(
          { error: authError?.message || 'Failed to send provider invite email' },
        { status: 500 }
      );
    }

    // Create user profile with provider role
    const { error: userProfileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email: payload.email,
        name: payload.name.trim(),
        phone: normalizedPhone,
        address: payload.address.trim(),
        role_id: providerRole.id,
      });

    if (userProfileError) {
      // Cleanup: Delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(authUser.user.id);

      const friendlyProfileError = getUserProfileCreationFriendlyMessage(userProfileError);
      
      logSecurityEvent('error', 'admin.action', {
        route: 'api/admin/providers/onboard',
        actorId: user.id,
        actorRole: role,
        message: friendlyProfileError,
        metadata: { email: payload.email },
      });

      return NextResponse.json(
        { error: 'Failed to create provider account profile: ' + friendlyProfileError },
        { status: 409 }
      );
    }

    // Parse numeric fields
    const yearsOfExperience = payload.years_of_experience;
    const latitude = payload.latitude ?? null;
    const longitude = payload.longitude ?? null;
    const serviceRadiusKm = payload.service_radius_km ?? null;

    // Prepare provider input
    // Note: Custom provider types are accepted here. If the database has enum constraints,
    // they will need to be removed/updated to allow arbitrary text values or a migration
    // to add custom provider types to the enum.
    const providerInput: CreateProviderInput = {
      provider_type: resolvedProviderType as ProviderType,
      is_individual: resolvedProviderType !== 'clinic',
      address: payload.address.trim(),
      business_name: payload.business_name?.trim() || payload.name.trim(),
      profile_photo_url: payload.profile_photo_url?.trim() || null,
      phone_number: payload.phone.trim(),
      email: payload.email,
      years_of_experience: Number.isFinite(yearsOfExperience) ? yearsOfExperience : null,
      service_radius_km: Number.isFinite(serviceRadiusKm) ? serviceRadiusKm : null,
    };

    // Add professional details if provided
    if (payload.qualification || payload.specialization) {
      providerInput.professional_details = {
        license_number: payload.qualification?.trim() || null,
        specialization: payload.specialization?.trim() || null,
        teleconsult_enabled: false,
        emergency_service_enabled: false,
        equipment_details: null,
        insurance_document_url: null,
        license_verified: false,
      };
    }

    // Add clinic details with address if it's a clinic/center
    if (resolvedProviderType === 'clinic') {
      providerInput.clinic_details = {
        registration_number: payload.business_registration_number?.trim() || null,
        gst_number: null,
        address: payload.address.trim(),
        city: payload.city.trim(),
        state: payload.state.trim(),
        pincode: payload.pincode.trim(),
        latitude: latitude && Number.isFinite(latitude) ? latitude : null,
        longitude: longitude && Number.isFinite(longitude) ? longitude : null,
        operating_hours: null,
        number_of_doctors: null,
        hospitalization_available: false,
        emergency_services_available: false,
        registration_verified: false,
      };
    }

    let provider: Awaited<ReturnType<typeof createProvider>>;

    try {
      // Create provider record
      provider = await createProvider(supabase, authUser.user.id, providerInput);

      // Update provider status fields (these aren't in CreateProviderInput)
      await supabase
        .from('providers')
        .update({
          admin_approval_status: 'pending',
          verification_status: 'pending',
          account_status: 'active',
        })
        .eq('id', provider.id);
    } catch (providerCreationError) {
      await supabase.from('users').delete().eq('id', authUser.user.id);
      await adminClient.auth.admin.deleteUser(authUser.user.id);

      const providerErrorMessage = getProviderCreationFriendlyMessage(extractErrorMessage(providerCreationError));

      logSecurityEvent('error', 'admin.action', {
        route: 'api/admin/providers/onboard',
        actorId: user.id,
        actorRole: role,
        message: providerErrorMessage,
        metadata: { email: payload.email },
      });

      return NextResponse.json({ error: providerErrorMessage }, { status: 500 });
    }

    // If service pincodes are provided for home visit professionals, create them
    if (payload.service_pincodes?.trim() && resolvedProviderType !== 'clinic') {
      const pincodes = payload.service_pincodes
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length === 6);

      if (pincodes.length > 0) {
        // Note: Service pincodes will be added when the provider sets up their services
        // For now, just log this information
        logSecurityEvent('info', 'admin.action', {
          route: 'api/admin/providers/onboard',
          actorId: user.id,
          actorRole: role,
          message: 'Provider onboarded with service pincodes',
          metadata: {
            providerId: provider.id,
            pincodeCount: pincodes.length,
          },
        });
      }
    }

    logSecurityEvent('info', 'admin.action', {
      route: 'api/admin/providers/onboard',
      actorId: user.id,
      actorRole: role,
      targetId: provider.id,
      message: 'Provider successfully onboarded',
      metadata: {
        providerName: payload.name,
        providerType: provider.provider_type,
        email: provider.email,
      },
    });

    const responseBody = {
      success: true,
      provider: {
        id: provider.id,
        business_name: provider.business_name,
        email: provider.email,
        provider_type: provider.provider_type,
      },
      message: 'Provider successfully onboarded. An email invitation will be sent.',
    };

    if (idempotencyKey) {
      await adminClient.from('admin_idempotency_keys').upsert(
        {
          endpoint: PROVIDER_ONBOARD_IDEMPOTENCY_ENDPOINT,
          idempotency_key: idempotencyKey,
          actor_user_id: user.id,
          request_payload: payload,
          status_code: 200,
          response_body: responseBody,
        },
        { onConflict: 'endpoint,idempotency_key' },
      );
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to onboard provider';

    logSecurityEvent('error', 'admin.action', {
      route: 'api/admin/providers/onboard',
      actorId: user.id,
      actorRole: role,
      message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
