import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';

const statusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { role, supabase, user } = await getApiAuthContext();

  if (!role || !user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, provider_id')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (role === 'user' && booking.user_id !== user.id) {
    return forbidden();
  }

  if (role === 'user' && parsed.data.status !== 'cancelled') {
    return NextResponse.json({ error: 'Users can only cancel their own bookings' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: parsed.data.status })
    .eq('id', bookingId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, booking: data });
}
