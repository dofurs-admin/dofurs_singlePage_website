import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, forbidden, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { toFriendlyApiError } from '@/lib/api/errors';

const querySchema = z.object({
  userId: z.string().uuid().optional(),
});

type BookableUser = {
  id: string;
  name: string | null;
  email: string | null;
  role?: string | null;
};

type AuthListUser = {
  id: string;
  email: string | null;
  raw_user_meta_data: Record<string, unknown>;
};

type CatalogDiscount = {
  id: string;
  code: string;
  title: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  max_discount_amount: number | null;
  min_booking_amount: number | null;
  applies_to_service_type: string | null;
  first_booking_only: boolean;
  valid_until: string | null;
};

type CatalogAddress = {
  id: string;
  label: 'Home' | 'Office' | 'Other' | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

async function listAuthUsers(limit: number): Promise<AuthListUser[]> {
  const adminClient = getSupabaseAdminClient();
  const output: AuthListUser[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });

    if (error) {
      return output;
    }

    const users = data?.users ?? [];
    if (users.length === 0) {
      break;
    }

    for (const row of users) {
      output.push({
        id: row.id,
        email: row.email ?? null,
        raw_user_meta_data: (row.user_metadata ?? {}) as Record<string, unknown>,
      });
    }

    if (output.length >= limit || users.length < 200) {
      break;
    }
  }

  return output.slice(0, limit);
}

export async function GET(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const adminClient = getSupabaseAdminClient();
  let effectiveRole = role;

  if (!effectiveRole) {
    const { data: roleProbe } = await adminClient.from('users').select('roles(name)').eq('id', user.id).maybeSingle();
    const probedRole = (Array.isArray(roleProbe?.roles) ? roleProbe?.roles[0] : roleProbe?.roles)?.name;
    effectiveRole = (probedRole as 'admin' | 'staff' | 'provider' | 'user' | null | undefined) ?? null;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    userId: url.searchParams.get('userId') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const canBookForUsers = effectiveRole === 'admin' || effectiveRole === 'staff' || effectiveRole === 'provider';

  if (parsed.data.userId && !canBookForUsers && parsed.data.userId !== user.id) {
    return forbidden();
  }

  let providerFilterId: number | null = null;

  if (effectiveRole === 'provider') {
    providerFilterId = await getProviderIdByUserId(supabase, user.id);

    if (!providerFilterId) {
      return NextResponse.json({ error: 'Provider profile not linked to this account.' }, { status: 404 });
    }
  }

  let bookableUsers: BookableUser[] = [];

  if (canBookForUsers) {
    const [allUsersResult, authUsers] = await Promise.all([
      adminClient
      .from('users')
      .select('id, name, email, roles(name)')
      .order('name', { ascending: true })
      .limit(1000),
      listAuthUsers(1000),
    ]);

    if (allUsersResult.error) {
      const mapped = toFriendlyApiError(allUsersResult.error, 'Failed to load booking catalog');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    const mergedById = new Map<string, BookableUser>();

    for (const row of authUsers) {
      const metadata = (row.raw_user_meta_data ?? {}) as Record<string, unknown>;
      const metadataName =
        (typeof metadata.name === 'string' ? metadata.name.trim() : '') ||
        (typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '');

      mergedById.set(row.id, {
        id: row.id,
        name: metadataName || null,
        email: row.email ?? null,
        role: null,
      });
    }

    for (const row of allUsersResult.data ?? []) {
      const roleName = (Array.isArray(row.roles) ? row.roles[0] : row.roles)?.name ?? null;
      const existing = mergedById.get(row.id);

      mergedById.set(row.id, {
        id: row.id,
        name: row.name ?? existing?.name ?? null,
        email: row.email ?? existing?.email ?? null,
        role: roleName,
      });
    }

    bookableUsers = Array.from(mergedById.values())
      .filter((row) => row.role !== 'admin' && row.role !== 'staff' && row.role !== 'provider')
      .sort((left, right) => {
        const leftLabel = (left.name ?? left.email ?? left.id).toLowerCase();
        const rightLabel = (right.name ?? right.email ?? right.id).toLowerCase();
        return leftLabel.localeCompare(rightLabel);
      });
  }

  let selectedUserId: string | null;

  if (canBookForUsers) {
    const requestedUserId = parsed.data.userId ?? null;
    selectedUserId = requestedUserId && bookableUsers.some((item) => item.id === requestedUserId) ? requestedUserId : null;
  } else {
    selectedUserId = user.id;
  }

  const providersRequest = providerFilterId
    ? supabase.from('providers').select('id, name, provider_type').eq('id', providerFilterId).order('name', { ascending: true })
    : supabase.from('providers').select('id, name, provider_type').order('name', { ascending: true });

  const providerServicesRequest = providerFilterId
    ? supabase
        .from('provider_services')
      .select('id, provider_id, service_type, service_mode, base_price, service_duration_minutes, is_active')
        .eq('provider_id', providerFilterId)
        .eq('is_active', true)
        .order('service_type', { ascending: true })
    : supabase
        .from('provider_services')
      .select('id, provider_id, service_type, service_mode, base_price, service_duration_minutes, is_active')
        .eq('is_active', true)
        .order('service_type', { ascending: true });

  const petsRequest = selectedUserId
    ? (canBookForUsers && selectedUserId !== user.id ? adminClient : supabase)
        .from('pets')
        .select('id, name')
        .eq('user_id', selectedUserId)
        .order('name', { ascending: true })
    : Promise.resolve({ data: [], error: null });

  const addressesRequest = selectedUserId
    ? (canBookForUsers && selectedUserId !== user.id ? adminClient : supabase)
        .from('user_addresses')
        .select('id, label, address_line_1, address_line_2, city, state, pincode, country, latitude, longitude, is_default')
        .eq('user_id', selectedUserId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const [providersResult, providerServicesResult, petsResult, addressesResult] = await Promise.all([
    providersRequest,
    providerServicesRequest,
    petsRequest,
    addressesRequest,
  ]);

  if (providersResult.error || providerServicesResult.error || petsResult.error || (addressesResult.error && addressesResult.error.code !== '42P01')) {
    const error = providersResult.error || providerServicesResult.error || petsResult.error || addressesResult.error;
    const mapped = toFriendlyApiError(error, 'Failed to load booking catalog');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const providerServices = providerServicesResult.data ?? [];

  const nowIso = new Date().toISOString();
  const { data: discountsData, error: discountsError } = await supabase
    .from('platform_discounts')
    .select(
      'id, code, title, discount_type, discount_value, max_discount_amount, min_booking_amount, applies_to_service_type, first_booking_only, valid_until, is_active, valid_from',
    )
    .eq('is_active', true)
    .lte('valid_from', nowIso)
    .or(`valid_until.is.null,valid_until.gt.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (discountsError && discountsError.code !== '42P01') {
    const mapped = toFriendlyApiError(discountsError, 'Failed to load discounts');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const mergedServices = [
    ...providerServices.map((item) => ({
      id: item.id,
      provider_id: item.provider_id,
      service_type: item.service_type,
      service_mode: item.service_mode ?? 'home_visit',
      service_duration_minutes: item.service_duration_minutes ?? 30,
      buffer_minutes: 0,
      base_price: item.base_price,
      source: 'provider_services' as const,
    })),
  ];

  return NextResponse.json({
    actorRole: effectiveRole,
    canBookForUsers,
    bookableUsers,
    selectedUserId,
    providers: providersResult.data ?? [],
    services: mergedServices,
    pets: petsResult.data ?? [],
    addresses: ((addressesResult.data ?? []) as CatalogAddress[]),
    discounts: ((discountsData ?? []) as Array<CatalogDiscount & { is_active: boolean; valid_from: string }>).map((item) => ({
      id: item.id,
      code: item.code,
      title: item.title,
      discount_type: item.discount_type,
      discount_value: item.discount_value,
      max_discount_amount: item.max_discount_amount,
      min_booking_amount: item.min_booking_amount,
      applies_to_service_type: item.applies_to_service_type,
      first_booking_only: item.first_booking_only,
      valid_until: item.valid_until,
    })),
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
