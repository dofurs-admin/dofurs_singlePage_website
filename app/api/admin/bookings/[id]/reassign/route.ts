import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { isSlotConflictMessage, logSecurityEvent } from '@/lib/monitoring/security-log';

const reassignSchema = z.object({
  providerId: z.number().int().positive(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { role, user, supabase } = auth.context;

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
    if (isSlotConflictMessage(error.message)) {
      logSecurityEvent('warn', 'booking.slot_conflict', {
        route: 'api/admin/bookings/[id]/reassign',
        actorId: user.id,
        actorRole: role,
        targetId: bookingId,
        message: error.message,
        metadata: {
          providerId: parsed.data.providerId,
        },
      });

      return NextResponse.json({ error: 'Provider is unavailable for this slot' }, { status: 409 });
    }

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/admin/bookings/[id]/reassign',
      actorId: user.id,
      actorRole: role,
      targetId: bookingId,
      message: error.message,
      metadata: {
        providerId: parsed.data.providerId,
      },
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logSecurityEvent('info', 'admin.action', {
    route: 'api/admin/bookings/[id]/reassign',
    actorId: user.id,
    actorRole: role,
    targetId: bookingId,
    metadata: {
      action: 'booking_reassigned',
      providerId: parsed.data.providerId,
    },
  });

  return NextResponse.json({ success: true, booking: data });
}
