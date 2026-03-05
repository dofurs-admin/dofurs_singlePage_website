import { NextResponse } from 'next/server';
import { forbidden, requireApiRole } from '@/lib/auth/api-auth';
import {
  cancelBooking,
  cancelBookingAsProvider,
  confirmBooking,
  completeBooking,
  markNoShow,
  updateBookingStatus,
} from '@/lib/bookings/service';
import { type BookingStatus } from '@/lib/flows/contracts';
import { bookingStatusUpdateSchema } from '@/lib/flows/validation';
import { assertRoleCanSetBookingStatus, type BookingActorRole } from '@/lib/bookings/state-transition-guard';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  const { role, supabase, user } = auth.context;

  const { id } = await context.params;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = bookingStatusUpdateSchema.safeParse(payload);

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

  const effectiveRole = role as BookingActorRole;

  const nextStatus = parsed.data.status as BookingStatus;

  try {
    assertRoleCanSetBookingStatus(effectiveRole, nextStatus);

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
        const data = await cancelBookingAsProvider(
          supabase,
          user.id,
          bookingId,
          parsed.data.cancellationReason,
          parsed.data.providerNotes,
        );
        return NextResponse.json({ success: true, booking: data });
      }

      return NextResponse.json({ error: 'Providers can set only confirmed/completed/no_show/cancelled.' }, { status: 403 });
    }

    if (role === 'admin' || role === 'staff') {
      const data = await updateBookingStatus(supabase, bookingId, parsed.data.status, {
        cancellationBy: parsed.data.status === 'cancelled' ? 'admin' : undefined,
        cancellationReason: parsed.data.cancellationReason,
        actorId: user.id,
        actorRole: role,
        source: 'api/bookings/[id]/status',
      });
      return NextResponse.json({ success: true, booking: data });
    }

    return forbidden();
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to update booking');
    const message = error instanceof Error ? error.message : String(error);

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/bookings/[id]/status',
      actorId: user.id,
      actorRole: role,
      targetId: bookingId,
      message,
      metadata: {
        requestedStatus: parsed.data.status,
        responseStatus: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
