import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getProviderDashboard } from '@/lib/provider-management/service';

export async function GET() {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin') {
    return forbidden();
  }

  try {
    const dashboard = await getProviderDashboard(supabase, user.id);
    return NextResponse.json({ dashboard });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load provider dashboard';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
