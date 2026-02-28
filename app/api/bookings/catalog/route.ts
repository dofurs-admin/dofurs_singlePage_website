import { NextResponse } from 'next/server';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';

export async function GET() {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const [providersResult, servicesResult, petsResult] = await Promise.all([
    supabase.from('providers').select('id, name, type').order('name', { ascending: true }),
    supabase.from('services').select('id, provider_id, name, duration_minutes, buffer_minutes, price').order('name', { ascending: true }),
    supabase.from('pets').select('id, name').eq('user_id', user.id).order('name', { ascending: true }),
  ]);

  if (providersResult.error || servicesResult.error || petsResult.error) {
    return NextResponse.json({ error: 'Failed to load booking catalog' }, { status: 500 });
  }

  return NextResponse.json({
    providers: providersResult.data ?? [],
    services: servicesResult.data ?? [],
    pets: petsResult.data ?? [],
  });
}
