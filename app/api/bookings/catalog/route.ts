import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, forbidden, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

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
    effectiveRole = (probedRole as 'admin' | 'provider' | 'user' | null | undefined) ?? null;
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    userId: url.searchParams.get('userId') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const canBookForUsers = effectiveRole === 'admin' || effectiveRole === 'provider';

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
      return NextResponse.json({ error: allUsersResult.error.message }, { status: 500 });
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
      .filter((row) => row.role !== 'admin' && row.role !== 'provider')
      .sort((left, right) => {
        const leftLabel = (left.name ?? left.email ?? left.id).toLowerCase();
        const rightLabel = (right.name ?? right.email ?? right.id).toLowerCase();
        return leftLabel.localeCompare(rightLabel);
      });
  }

  let selectedUserId = canBookForUsers ? parsed.data.userId ?? user.id : user.id;

  if (canBookForUsers && bookableUsers.length > 0 && !bookableUsers.some((item) => item.id === selectedUserId)) {
    selectedUserId = bookableUsers[0].id;
  }

  const providersRequest = providerFilterId
    ? supabase.from('providers').select('id, name, provider_type').eq('id', providerFilterId).order('name', { ascending: true })
    : supabase.from('providers').select('id, name, provider_type').order('name', { ascending: true });

  const providerServicesRequest = providerFilterId
    ? supabase
        .from('provider_services')
        .select('id, provider_id, service_type, base_price, service_duration_minutes, is_active')
        .eq('provider_id', providerFilterId)
        .eq('is_active', true)
        .order('service_type', { ascending: true })
    : supabase
        .from('provider_services')
        .select('id, provider_id, service_type, base_price, service_duration_minutes, is_active')
        .eq('is_active', true)
        .order('service_type', { ascending: true });

  const petsClient = canBookForUsers && selectedUserId !== user.id ? adminClient : supabase;
  const petsRequest = petsClient.from('pets').select('id, name').eq('user_id', selectedUserId).order('name', { ascending: true });

  const [providersResult, providerServicesResult, petsResult] = await Promise.all([
    providersRequest,
    providerServicesRequest,
    petsRequest,
  ]);

  if (providersResult.error || providerServicesResult.error || petsResult.error) {
    return NextResponse.json({ error: 'Failed to load booking catalog' }, { status: 500 });
  }

  const providerServices = providerServicesResult.data ?? [];

  const mergedServices = [
    ...providerServices.map((item) => ({
      id: item.id,
      provider_id: item.provider_id,
      service_type: item.service_type,
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
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
