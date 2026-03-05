import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { updateBookingStatus } from '@/lib/bookings/service';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';

const payloadSchema = z.object({
  bookingIds: z.array(z.number().int().positive()).min(1).max(100),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']),
  cancellationReason: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { role, user, supabase } = auth.context;

  const payload = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const results: Array<{ bookingId: number; success: boolean; error?: string }> = [];

  // Type assertion is safe here because requireApiRole ensures admin/staff access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actorRole = (role ?? undefined) as any;

  for (const bookingId of parsed.data.bookingIds) {
    try {
      await updateBookingStatus(supabase, bookingId, parsed.data.status, {
        cancellationBy: parsed.data.status === 'cancelled' ? 'admin' : undefined,
        cancellationReason: parsed.data.cancellationReason,
        actorId: user.id,
        actorRole,
        source: 'api/admin/bookings/bulk-status',
      });
      results.push({ bookingId, success: true });
    } catch (error) {
      const mapped = toFriendlyApiError(error, 'Unable to update booking');

      logSecurityEvent('error', 'booking.failure', {
        route: 'api/admin/bookings/bulk-status',
        actorId: user.id,
        actorRole: role,
        targetId: bookingId,
        message: error instanceof Error ? error.message : String(error),
        metadata: {
          requestedStatus: parsed.data.status,
          responseStatus: mapped.status,
        },
      });

      results.push({
        bookingId,
        success: false,
        error: mapped.message,
      });
    }
  }

  logSecurityEvent('info', 'admin.action', {
    route: 'api/admin/bookings/bulk-status',
    actorId: user.id,
    actorRole: role,
    metadata: {
      action: 'bulk_booking_status_update',
      status: parsed.data.status,
      total: parsed.data.bookingIds.length,
      updated: results.filter((item) => item.success).length,
      failed: results.filter((item) => !item.success).length,
    },
  });

  return NextResponse.json({
    success: true,
    status: parsed.data.status,
    updated: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
  });
}
