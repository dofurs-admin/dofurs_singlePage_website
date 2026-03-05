import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import { cancelBookingAsProvider, confirmBooking, completeBooking, markNoShow } from '@/lib/bookings/service';
import { completeProviderBookingCompletionTask } from '@/lib/bookings/completion-tasks';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';

const payloadSchema = z.object({
  status: z.enum(['confirmed', 'completed', 'no_show', 'cancelled']),
  providerNotes: z.string().trim().max(2000).optional(),
  completionFeedback: z.string().trim().max(4000).optional(),
  cancellationReason: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['provider']);

  if (auth.response) {
    return auth.response;
  }

  const { user, role, supabase } = auth.context;

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
    if (parsed.data.status === 'confirmed') {
      const booking = await confirmBooking(supabase, user.id, bookingId, parsed.data.providerNotes);
      return NextResponse.json({ success: true, booking });
    }

    if (parsed.data.status === 'completed') {
      const completionFeedback = parsed.data.completionFeedback?.trim() ?? parsed.data.providerNotes?.trim() ?? '';

      if (!completionFeedback) {
        return NextResponse.json(
          { error: 'Completion feedback is required before marking booking complete.' },
          { status: 400 },
        );
      }

      const booking = await completeBooking(supabase, user.id, bookingId, parsed.data.providerNotes);

      await completeProviderBookingCompletionTask(supabase, {
        bookingId,
        providerId: booking.provider_id,
        feedbackText: completionFeedback,
      });

      return NextResponse.json({ success: true, booking });
    }

    if (parsed.data.status === 'no_show') {
      const booking = await markNoShow(supabase, user.id, bookingId, parsed.data.providerNotes);
      return NextResponse.json({ success: true, booking });
    }

    const booking = await cancelBookingAsProvider(
      supabase,
      user.id,
      bookingId,
      parsed.data.cancellationReason,
      parsed.data.providerNotes,
    );

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to update booking status');
    const message = error instanceof Error ? error.message : String(error);

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/provider/bookings/[id]/status',
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
