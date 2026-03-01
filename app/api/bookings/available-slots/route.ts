import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getAvailableSlots } from '@/lib/bookings/service';

const slotsSchema = z.object({
  providerId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceDurationMinutes: z.coerce.number().int().positive().optional(),
  providerServiceId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const url = new URL(request.url);

  const parsed = slotsSchema.safeParse({
    providerId: url.searchParams.get('providerId'),
    date: url.searchParams.get('date'),
    serviceDurationMinutes: url.searchParams.get('serviceDurationMinutes') ?? undefined,
    providerServiceId: url.searchParams.get('providerServiceId') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  try {
    let duration = parsed.data.serviceDurationMinutes;

    if (!duration && parsed.data.providerServiceId) {
      const { data: providerService, error: providerServiceError } = await supabase
        .from('provider_services')
        .select('id, provider_id, service_duration_minutes')
        .eq('id', parsed.data.providerServiceId)
        .eq('provider_id', parsed.data.providerId)
        .single<{ id: string; provider_id: number; service_duration_minutes: number | null }>();

      if (providerServiceError || !providerService) {
        return NextResponse.json({ error: 'Provider service not found' }, { status: 404 });
      }

      duration = providerService.service_duration_minutes ?? 30;
    }

    const slots = await getAvailableSlots(supabase, {
      providerId: parsed.data.providerId,
      bookingDate: parsed.data.date,
      serviceDurationMinutes: duration,
    });

    return NextResponse.json({ slots });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to get slots' }, { status: 500 });
  }
}
