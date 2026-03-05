import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export type AppRole = 'user' | 'provider' | 'admin' | 'staff';

export const ADMIN_ROLES: AppRole[] = ['admin', 'staff'];
export const PROVIDER_ROLES: AppRole[] = ['provider', 'admin', 'staff'];

export async function getApiAuthContext() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      role: null,
    };
  }

  const { data: profile } = await supabase.from('users').select('roles(name)').eq('id', user.id).single();
  const roleName = (Array.isArray(profile?.roles) ? profile?.roles[0] : profile?.roles)?.name as AppRole | undefined;

  return {
    supabase,
    user,
    role: roleName ?? null,
  };
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export function isRoleAllowed(role: AppRole | null, allowedRoles: readonly AppRole[]) {
  if (!role) {
    return false;
  }

  return allowedRoles.includes(role);
}

export async function getCurrentApiRole() {
  const { role } = await getApiAuthContext();
  return role;
}

export async function requireApiRole(allowedRoles: readonly AppRole[]) {
  const context = await getApiAuthContext();

  if (!context.user) {
    return {
      context: null,
      response: unauthorized(),
    } as const;
  }

  if (!isRoleAllowed(context.role, allowedRoles)) {
    return {
      context: null,
      response: forbidden(),
    } as const;
  }

  return {
    context,
    response: null,
  } as const;
}
