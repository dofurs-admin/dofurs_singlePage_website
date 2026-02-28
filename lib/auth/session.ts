import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export async function requireAuthenticatedUser(redirectPath = '/auth/sign-in') {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(redirectPath);
  }

  return { supabase, user };
}

export async function getCurrentUserRole() {
  const { supabase, user } = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('users')
    .select('role_id, roles(name)')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    return null;
  }

  const roleRecord = Array.isArray(data.roles) ? data.roles[0] : data.roles;
  return roleRecord?.name ?? null;
}

export async function requireRole(allowedRoles: Array<'user' | 'provider' | 'admin'>, fallbackPath = '/dashboard') {
  const role = await getCurrentUserRole();

  if (!role || !allowedRoles.includes(role as 'user' | 'provider' | 'admin')) {
    redirect(fallbackPath);
  }

  return role;
}
