import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { updateBookingStatus } from '@/lib/bookings/service';

const payloadSchema = z.object({
  bookingIds: z.array(z.number().int().positive()).min(1).max(100),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']),
  cancellationReason: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: Request) {
  const { role, user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const results: Array<{ bookingId: number; success: boolean; error?: string }> = [];

  for (const bookingId of parsed.data.bookingIds) {
    try {
      await updateBookingStatus(supabase, bookingId, parsed.data.status, {
        cancellationBy: parsed.data.status === 'cancelled' ? 'admin' : undefined,
        cancellationReason: parsed.data.cancellationReason,
      });
      results.push({ bookingId, success: true });
    } catch (error) {
      results.push({
        bookingId,
        success: false,
        error: error instanceof Error ? error.message : 'Unable to update booking',
      });
    }
  }

  return NextResponse.json({
    success: true,
    status: parsed.data.status,
    updated: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
  });
}
