import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

const bookingSchema = z.object({
  petId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  bookingStart: z.string().datetime({ offset: true }),
  paymentMode: z.string().min(1).max(50),
  amount: z.number().nonnegative(),
});

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bookingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid booking payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('create_booking', {
    p_user_id: user.id,
    p_pet_id: parsed.data.petId,
    p_service_id: parsed.data.serviceId,
    p_booking_start: parsed.data.bookingStart,
    p_payment_mode: parsed.data.paymentMode,
    p_amount: parsed.data.amount,
  });

  if (error) {
    if (error.message.includes('BOOKING_OVERLAP')) {
      return NextResponse.json({ error: 'Selected time slot is no longer available.' }, { status: 409 });
    }

    if (error.message.includes('PET_OWNERSHIP_INVALID')) {
      return NextResponse.json({ error: 'Pet does not belong to this user.' }, { status: 403 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, booking: data });
}
