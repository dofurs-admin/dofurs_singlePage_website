import { NextResponse } from 'next/server';
import { createBooking } from '@/lib/bookings/service';
import { forbidden, requireApiRole } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { bookingCreateSchema } from '@/lib/flows/validation';
import { toFriendlyApiError } from '@/lib/api/errors';
import { assertRoleCanCreateBookingForUser } from '@/lib/bookings/state-transition-guard';
import { isSlotConflictMessage, logSecurityEvent } from '@/lib/monitoring/security-log';

export async function POST(request: Request) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  const { supabase, user, role } = auth.context;

  const body = await request.json().catch(() => null);
  const parsed = bookingCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid booking payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const targetUserId = parsed.data.bookingUserId ?? user.id;

  try {
    assertRoleCanCreateBookingForUser(role as 'user' | 'provider' | 'admin' | 'staff', user.id, targetUserId);
  } catch {
    return forbidden();
  }

  if (role === 'provider') {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId || providerId !== parsed.data.providerId) {
      return forbidden();
    }
  }

  try {
    const effectiveBookingType = parsed.data.bookingType ?? 'service';

    // Security: Never trust client-provided finalPrice or discountAmount
    // All pricing calculated server-side in DB RPC
    const bookingInput = {
      petId: parsed.data.petId,
      providerId: parsed.data.providerId,
      providerServiceId: effectiveBookingType === 'service' ? parsed.data.providerServiceId : undefined,
      bookingDate: parsed.data.bookingDate,
      startTime: parsed.data.startTime,
      bookingMode: parsed.data.bookingMode,
      locationAddress: parsed.data.locationAddress,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      providerNotes: parsed.data.providerNotes,
      bookingType: effectiveBookingType,
      packageId: effectiveBookingType === 'package' ? parsed.data.packageId : undefined,
      discountCode: parsed.data.discountCode,
      // Client pricing removed - calculated server-side only
      addOns: parsed.data.addOns,
    };

    const booking = await createBooking(supabase, targetUserId, bookingInput);

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Booking failed');

    const rawMessage =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
          ? ((error as { message: string }).message ?? '').trim()
          : '';
    const message = rawMessage || mapped.message;
    if (mapped.status === 409 || isSlotConflictMessage(message)) {
      logSecurityEvent('warn', 'booking.slot_conflict', {
        route: 'api/bookings/create',
        actorId: user.id,
        actorRole: role,
        targetId: parsed.data.providerId,
        message,
        metadata: {
          bookingDate: parsed.data.bookingDate,
          startTime: parsed.data.startTime,
          bookingMode: parsed.data.bookingMode,
        },
      });
    }

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/bookings/create',
      actorId: user.id,
      actorRole: role,
      targetId: parsed.data.providerId,
      message,
      metadata: {
        status: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
