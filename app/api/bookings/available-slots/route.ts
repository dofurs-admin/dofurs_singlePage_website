import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAvailableSlots } from '@/lib/bookings/slots';

const slotsSchema = z.object({
  providerId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.coerce.number().int().positive().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);

  const parsed = slotsSchema.safeParse({
    providerId: url.searchParams.get('providerId'),
    date: url.searchParams.get('date'),
    serviceId: url.searchParams.get('serviceId') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  try {
    const slots = await getAvailableSlots(parsed.data.providerId, parsed.data.date, parsed.data.serviceId);
    return NextResponse.json({ slots });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to get slots' }, { status: 500 });
  }
}
