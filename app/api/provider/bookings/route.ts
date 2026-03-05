import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getProviderBookings } from '@/lib/bookings/service';
import {
  ensureProviderCompletionTasks,
  getCompletionTaskMapForBookings,
} from '@/lib/bookings/completion-tasks';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getProviderIdByUserId } from '@/lib/provider-management/api';

const querySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiRole(['provider']);

  if (auth.response) {
    return auth.response;
  }

  const { user, role, supabase } = auth.context;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    status: searchParams.get('status') ?? undefined,
    fromDate: searchParams.get('fromDate') ?? undefined,
    toDate: searchParams.get('toDate') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (providerId) {
      await ensureProviderCompletionTasks(supabase, providerId);
    }

    const bookings = await getProviderBookings(supabase, user.id, parsed.data);
    const taskMap = await getCompletionTaskMapForBookings(
      supabase,
      bookings.map((booking) => booking.id),
    );

    const bookingsWithTasks = bookings.map((booking) => {
      const task = taskMap.get(booking.id);

      return {
        ...booking,
        completion_task_status: task?.task_status ?? null,
        completion_due_at: task?.due_at ?? null,
        completion_completed_at: task?.completed_at ?? null,
        completion_feedback_text: task?.feedback_text ?? null,
        requires_completion_feedback: booking.booking_status === 'confirmed' && task?.task_status === 'pending',
      };
    });

    return NextResponse.json({ bookings: bookingsWithTasks });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load provider bookings');

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/provider/bookings',
      actorId: user.id,
      actorRole: role,
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        status: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
