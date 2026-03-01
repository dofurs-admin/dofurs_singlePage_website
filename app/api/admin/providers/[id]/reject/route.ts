import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { logProviderAdminAuditEvent, rejectProvider } from '@/lib/provider-management/service';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { role, user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin') {
    return forbidden();
  }

  const { id } = await context.params;
  const providerId = Number(id);

  if (!Number.isFinite(providerId)) {
    return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
  }

  try {
    const provider = await rejectProvider(supabase, providerId);
    await logProviderAdminAuditEvent(supabase, user.id, providerId, 'provider.rejected');
    return NextResponse.json({ success: true, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reject provider';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
