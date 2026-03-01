import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { getAvailability, setAvailability } from '@/lib/provider-management/service';
import { providerAvailabilitySchema } from '@/lib/provider-management/validation';

export async function GET() {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin') {
    return forbidden();
  }

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile is not linked to this account.' }, { status: 404 });
    }

    const availability = await getAvailability(supabase, providerId);
    return NextResponse.json({ availability });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load availability';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = providerAvailabilitySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile is not linked to this account.' }, { status: 404 });
    }

    const availability = await setAvailability(supabase, providerId, parsed.data);
    return NextResponse.json({ success: true, availability });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save availability';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
