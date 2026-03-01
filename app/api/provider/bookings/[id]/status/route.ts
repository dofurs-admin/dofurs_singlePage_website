import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { confirmBooking, completeBooking, markNoShow, updateBookingStatus } from '@/lib/bookings/service';

const payloadSchema = z.object({
  status: z.enum(['confirmed', 'completed', 'no_show', 'cancelled']),
  providerNotes: z.string().trim().max(2000).optional(),
  cancellationReason: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'provider' && role !== 'admin') {
    return forbidden();
  }

  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (role === 'provider') {
      if (parsed.data.status === 'confirmed') {
        const booking = await confirmBooking(supabase, user.id, bookingId, parsed.data.providerNotes);
        return NextResponse.json({ success: true, booking });
      }

      if (parsed.data.status === 'completed') {
        const booking = await completeBooking(supabase, user.id, bookingId, parsed.data.providerNotes);
        return NextResponse.json({ success: true, booking });
      }

      if (parsed.data.status === 'no_show') {
        const booking = await markNoShow(supabase, user.id, bookingId, parsed.data.providerNotes);
        return NextResponse.json({ success: true, booking });
      }

      const booking = await updateBookingStatus(supabase, bookingId, 'cancelled', {
        cancellationBy: 'provider',
        cancellationReason: parsed.data.cancellationReason,
      });
      return NextResponse.json({ success: true, booking });
    }

    const booking = await updateBookingStatus(supabase, bookingId, parsed.data.status, {
      cancellationBy: parsed.data.status === 'cancelled' ? 'admin' : undefined,
      cancellationReason: parsed.data.cancellationReason,
    });

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update booking status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
