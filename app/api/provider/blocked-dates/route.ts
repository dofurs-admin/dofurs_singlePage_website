import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';

const createSchema = z.object({
  blockedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(500).optional(),
});

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

    const { data, error } = await supabase
      .from('provider_blocked_dates')
      .select('id, provider_id, blocked_date, reason, created_at')
      .eq('provider_id', providerId)
      .order('blocked_date', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ blockedDates: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load blocked dates';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId) {
      return NextResponse.json({ error: 'Provider profile is not linked to this account.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('provider_blocked_dates')
      .insert({
        provider_id: providerId,
        blocked_date: parsed.data.blockedDate,
        reason: parsed.data.reason?.trim() || null,
      })
      .select('id, provider_id, blocked_date, reason, created_at')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, blockedDate: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create blocked date';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
