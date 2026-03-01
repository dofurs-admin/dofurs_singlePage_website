import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBooking } from '@/lib/bookings/service';
import { getApiAuthContext, forbidden, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';

const bookingSchema = z.object({
  petId: z.number().int().positive(),
  providerId: z.number().int().positive(),
  providerServiceId: z.string().uuid(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  bookingMode: z.enum(['home_visit', 'clinic_visit', 'teleconsult']),
  locationAddress: z.string().trim().max(1000).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  providerNotes: z.string().trim().max(2000).nullable().optional(),
  bookingUserId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const { supabase, user, role } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsed = bookingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid booking payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const targetUserId = parsed.data.bookingUserId ?? user.id;

  if (targetUserId !== user.id && role !== 'admin' && role !== 'provider') {
    return forbidden();
  }

  if (role === 'provider') {
    const providerId = await getProviderIdByUserId(supabase, user.id);

    if (!providerId || providerId !== parsed.data.providerId) {
      return forbidden();
    }
  }

  try {
    const { bookingUserId: _bookingUserId, ...bookingInput } = parsed.data;
    const booking = await createBooking(supabase, targetUserId, bookingInput);
    return NextResponse.json({ success: true, booking });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Booking failed';

    if (message.includes('BOOKING_OVERLAP')) {
      return NextResponse.json({ error: 'Selected time slot is no longer available.' }, { status: 409 });
    }

    if (message.includes('PET_OWNERSHIP_INVALID')) {
      return NextResponse.json({ error: 'Pet does not belong to this user.' }, { status: 403 });
    }

    if (message.includes('HOME_VISIT_LOCATION_REQUIRED')) {
      return NextResponse.json(
        { error: 'Home visit bookings require address and geo coordinates.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
