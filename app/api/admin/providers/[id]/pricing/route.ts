import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { logProviderAdminAuditEvent, updateProviderPricing } from '@/lib/provider-management/service';
import { providerPricingSchema } from '@/lib/provider-management/validation';

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
  const parsed = providerPricingSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const pricing = await updateProviderPricing(supabase, providerId, parsed.data);
    await logProviderAdminAuditEvent(supabase, user.id, providerId, 'provider.pricing_updated', {
      updatedRows: parsed.data.length,
    });
    return NextResponse.json({ success: true, pricing });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update provider pricing';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
