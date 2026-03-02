import { NextResponse } from 'next/server';
import { createBooking } from '@/lib/bookings/service';
import { getApiAuthContext, forbidden, unauthorized } from '@/lib/auth/api-auth';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import { bookingCreateSchema } from '@/lib/flows/validation';
import { toFriendlyApiError } from '@/lib/api/errors';
import { assertRoleCanCreateBookingForUser } from '@/lib/bookings/state-transition-guard';

export async function POST(request: Request) {
  const { supabase, user, role } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

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
    const bookingInput = {
      petId: parsed.data.petId,
      providerId: parsed.data.providerId,
      providerServiceId: parsed.data.bookingType === 'service' ? parsed.data.providerServiceId : undefined,
      bookingDate: parsed.data.bookingDate,
      startTime: parsed.data.startTime,
      bookingMode: parsed.data.bookingMode,
      locationAddress: parsed.data.locationAddress,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      providerNotes: parsed.data.providerNotes,
      bookingType: parsed.data.bookingType ?? 'service',
      packageId: parsed.data.bookingType === 'package' ? parsed.data.packageId : undefined,
      discountCode: parsed.data.discountCode,
      discountAmount: parsed.data.bookingType === 'package' ? parsed.data.discountAmount : undefined,
      finalPrice: parsed.data.bookingType === 'package' ? parsed.data.finalPrice : undefined,
      addOns: parsed.data.addOns,
    };

    const booking = await createBooking(supabase, targetUserId, bookingInput);

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Booking failed');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
