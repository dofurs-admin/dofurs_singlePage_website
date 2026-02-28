import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';

const reassignSchema = z.object({
  providerId: z.number().int().positive(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { role, supabase } = await getApiAuthContext();

  if (!role) {
    return unauthorized();
  }

  if (role !== 'admin') {
    return forbidden();
  }

  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = reassignSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data: provider } = await supabase.from('providers').select('id').eq('id', parsed.data.providerId).single();

  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({ provider_id: parsed.data.providerId, status: 'pending' })
    .eq('id', bookingId)
    .select('*')
    .single();

  if (error) {
    if (error.message.toLowerCase().includes('overlap')) {
      return NextResponse.json({ error: 'Provider is unavailable for this slot' }, { status: 409 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, booking: data });
}
