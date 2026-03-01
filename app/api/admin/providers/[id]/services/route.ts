import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import {
  getProviderServicesWithPincodes,
  logProviderAdminAuditEvent,
  updateProviderServiceRollout,
} from '@/lib/provider-management/service';
import { adminProviderServiceRolloutSchema } from '@/lib/provider-management/validation';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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
    const services = await getProviderServicesWithPincodes(supabase, providerId);
    return NextResponse.json({ services });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load provider services';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
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

  const payload = await request.json().catch(() => null);
  const parsed = adminProviderServiceRolloutSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const services = await updateProviderServiceRollout(supabase, providerId, parsed.data);
    await logProviderAdminAuditEvent(supabase, user.id, providerId, 'provider.services_rollout_updated', {
      updatedRows: parsed.data.length,
    });
    return NextResponse.json({ success: true, services });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update provider services';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
