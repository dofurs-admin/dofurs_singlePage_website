import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const querySchema = z.object({
  query: z.string().trim().min(2).max(120),
});

type SearchUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

export async function GET(request: Request) {
  const { user, role } = await getApiAuthContext();

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

  if (effectiveRole !== 'admin' && effectiveRole !== 'provider') {
    return forbidden();
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    query: url.searchParams.get('query') ?? '',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid search query' }, { status: 400 });
  }

  const normalizedQuery = parsed.data.query.toLowerCase();
  const queryLike = `%${parsed.data.query}%`;

  const [publicUsersResult, authUsersResult] = await Promise.all([
    adminClient
      .from('users')
      .select('id, name, email, roles(name)')
      .or(`name.ilike.${queryLike},email.ilike.${queryLike}`)
      .limit(250),
    adminClient
      .schema('auth')
      .from('users')
      .select('id, email, raw_user_meta_data, created_at')
      .ilike('email', queryLike)
      .order('created_at', { ascending: true })
      .limit(250),
  ]);

  if (publicUsersResult.error) {
    return NextResponse.json({ error: publicUsersResult.error.message }, { status: 500 });
  }

  if (authUsersResult.error) {
    return NextResponse.json({ error: authUsersResult.error.message }, { status: 500 });
  }

  const mergedById = new Map<string, SearchUser>();

  for (const row of authUsersResult.data ?? []) {
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

  for (const row of publicUsersResult.data ?? []) {
    const roleName = (Array.isArray(row.roles) ? row.roles[0] : row.roles)?.name ?? null;
    const existing = mergedById.get(row.id);

    mergedById.set(row.id, {
      id: row.id,
      name: row.name ?? existing?.name ?? null,
      email: row.email ?? existing?.email ?? null,
      role: roleName,
    });
  }

  const users = Array.from(mergedById.values())
    .filter((row) => row.role !== 'admin' && row.role !== 'provider')
    .filter((row) => {
      const name = row.name?.toLowerCase() ?? '';
      const email = row.email?.toLowerCase() ?? '';
      return name.includes(normalizedQuery) || email.includes(normalizedQuery);
    })
    .sort((left, right) => {
      const leftLabel = (left.name ?? left.email ?? left.id).toLowerCase();
      const rightLabel = (right.name ?? right.email ?? right.id).toLowerCase();
      return leftLabel.localeCompare(rightLabel);
    })
    .slice(0, 25)
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
    }));

  return NextResponse.json({ users }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}