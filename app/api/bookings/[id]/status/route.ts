import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { cancelBooking, confirmBooking, completeBooking, markNoShow, updateBookingStatus } from '@/lib/bookings/service';

const statusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']),
  providerNotes: z.string().trim().max(2000).optional(),
  cancellationReason: z.string().trim().max(2000).optional(),
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
    .select('id, user_id, provider_id, booking_status')
    .eq('id', bookingId)
    .single<{ id: number; user_id: string; provider_id: number; booking_status: string }>();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (role === 'user' && booking.user_id !== user.id) {
    return forbidden();
  }

  try {
    if (role === 'user') {
      if (parsed.data.status !== 'cancelled') {
        return NextResponse.json({ error: 'Users can only cancel their own bookings' }, { status: 403 });
      }

      const data = await cancelBooking(supabase, user.id, bookingId, parsed.data.cancellationReason);
      return NextResponse.json({ success: true, booking: data });
    }

    if (role === 'provider') {
      if (parsed.data.status === 'confirmed') {
        const data = await confirmBooking(supabase, user.id, bookingId, parsed.data.providerNotes);
        return NextResponse.json({ success: true, booking: data });
      }

      if (parsed.data.status === 'completed') {
        const data = await completeBooking(supabase, user.id, bookingId, parsed.data.providerNotes);
        return NextResponse.json({ success: true, booking: data });
      }

      if (parsed.data.status === 'no_show') {
        const data = await markNoShow(supabase, user.id, bookingId, parsed.data.providerNotes);
        return NextResponse.json({ success: true, booking: data });
      }

      if (parsed.data.status === 'cancelled') {
        const data = await updateBookingStatus(supabase, bookingId, 'cancelled', {
          cancellationBy: 'provider',
          cancellationReason: parsed.data.cancellationReason,
        });
        return NextResponse.json({ success: true, booking: data });
      }

      return NextResponse.json({ error: 'Providers can set only confirmed/completed/no_show/cancelled.' }, { status: 403 });
    }

    if (role === 'admin') {
      const data = await updateBookingStatus(supabase, bookingId, parsed.data.status, {
        cancellationBy: parsed.data.status === 'cancelled' ? 'admin' : undefined,
        cancellationReason: parsed.data.cancellationReason,
      });
      return NextResponse.json({ success: true, booking: data });
    }

    return forbidden();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update booking';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
