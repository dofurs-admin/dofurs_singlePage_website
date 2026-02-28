import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export type AppRole = 'user' | 'provider' | 'admin';

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
