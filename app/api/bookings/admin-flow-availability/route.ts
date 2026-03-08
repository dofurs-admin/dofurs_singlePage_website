import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getAvailableSlots } from '@/lib/bookings/service';
import { toFriendlyApiError } from '@/lib/api/errors';

const querySchema = z.object({
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/),
  serviceType: z.string().trim().min(1).max(120).optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  limitProviders: z.coerce.number().int().min(1).max(120).optional(),
});

type ProviderServiceRow = {
  id: string;
  provider_id: number;
  service_type: string;
  service_mode: string | null;
  service_duration_minutes: number | null;
  base_price: number;
  providers: Array<{
    id: number;
    name: string;
    provider_type: string | null;
  }>;
};

type ProviderServiceCoverageRow = {
  provider_service_id: string;
  pincode: string;
  is_enabled: boolean;
};

type Slot = {
  start_time: string;
  end_time: string;
  is_available: boolean;
};

function rankSlots(left: { availableProviderCount: number; startTime: string }, right: { availableProviderCount: number; startTime: string }) {
  if (left.availableProviderCount !== right.availableProviderCount) {
    return right.availableProviderCount - left.availableProviderCount;
  }

  return left.startTime.localeCompare(right.startTime);
}

export async function GET(request: Request) {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    pincode: url.searchParams.get('pincode') ?? undefined,
    serviceType: url.searchParams.get('serviceType') ?? undefined,
    bookingDate: url.searchParams.get('bookingDate') ?? undefined,
    startTime: url.searchParams.get('startTime') ?? undefined,
    limitProviders: url.searchParams.get('limitProviders') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  const { pincode, serviceType, bookingDate, startTime } = parsed.data;
  const limitProviders = parsed.data.limitProviders ?? 60;

  try {
    let providerServicesQuery = supabase
      .from('provider_services')
      .select('id, provider_id, service_type, service_mode, service_duration_minutes, base_price, providers!inner(id, name, provider_type)')
      .eq('is_active', true)
      .order('service_type', { ascending: true })
      .limit(limitProviders * 3);

    if (serviceType) {
      providerServicesQuery = providerServicesQuery.ilike('service_type', serviceType);
    }

    const { data: providerServicesRows, error: providerServicesError } = await providerServicesQuery;

    if (providerServicesError) {
      const mapped = toFriendlyApiError(providerServicesError, 'Failed to load provider services');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    const providerServices = (providerServicesRows ?? []) as ProviderServiceRow[];

    if (providerServices.length === 0) {
      return NextResponse.json({
        services: [],
        providers: [],
        slotOptions: [],
        recommendedSlotStartTime: null,
        recommendedProviderServiceId: null,
      });
    }

    const providerServiceIds = providerServices.map((row) => row.id);

    const { data: coverageRows, error: coverageError } = await supabase
      .from('provider_service_pincodes')
      .select('provider_service_id, pincode, is_enabled')
      .in('provider_service_id', providerServiceIds);

    if (coverageError && coverageError.code !== '42P01') {
      const mapped = toFriendlyApiError(coverageError, 'Failed to load service coverage');
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    const coverageByService = new Map<string, Set<string>>();

    for (const row of ((coverageRows ?? []) as ProviderServiceCoverageRow[])) {
      if (!row.is_enabled) {
        continue;
      }

      const normalizedPincode = row.pincode.trim();
      if (!normalizedPincode) {
        continue;
      }

      const existing = coverageByService.get(row.provider_service_id) ?? new Set<string>();
      existing.add(normalizedPincode);
      coverageByService.set(row.provider_service_id, existing);
    }

    const eligibleProviderServices = providerServices.filter((row) => {
      const configuredCoverage = coverageByService.get(row.id);

      // Backward-compatible fallback: if service has no explicit pincode map yet, keep it visible.
      if (!configuredCoverage || configuredCoverage.size === 0) {
        return true;
      }

      return configuredCoverage.has(pincode);
    });

    if (eligibleProviderServices.length === 0) {
      return NextResponse.json({
        services: [],
        providers: [],
        slotOptions: [],
        recommendedSlotStartTime: null,
        recommendedProviderServiceId: null,
      });
    }

    const serviceSummaryMap = new Map<
      string,
      {
        serviceType: string;
        minBasePrice: number;
        maxBasePrice: number;
        providerCount: number;
      }
    >();

    const servicesSeenByType = new Map<string, Set<number>>();

    for (const row of eligibleProviderServices) {
      const type = row.service_type;
      const existing = serviceSummaryMap.get(type);
      const providerSet = servicesSeenByType.get(type) ?? new Set<number>();
      providerSet.add(row.provider_id);
      servicesSeenByType.set(type, providerSet);

      if (!existing) {
        serviceSummaryMap.set(type, {
          serviceType: type,
          minBasePrice: row.base_price,
          maxBasePrice: row.base_price,
          providerCount: 1,
        });
        continue;
      }

      existing.minBasePrice = Math.min(existing.minBasePrice, row.base_price);
      existing.maxBasePrice = Math.max(existing.maxBasePrice, row.base_price);
      existing.providerCount = providerSet.size;
    }

    const serviceSummaries = Array.from(serviceSummaryMap.values()).sort((left, right) =>
      left.serviceType.localeCompare(right.serviceType),
    );

    const scopedProviderServices = serviceType
      ? eligibleProviderServices.filter((row) => row.service_type.toLowerCase() === serviceType.toLowerCase())
      : eligibleProviderServices;

    if (!bookingDate || scopedProviderServices.length === 0) {
      const providerCards = scopedProviderServices.map((row) => {
        const providerProfile = row.providers?.[0];

        return {
          providerId: row.provider_id,
          providerName: providerProfile?.name ?? `Provider #${row.provider_id}`,
          providerType: providerProfile?.provider_type ?? null,
          providerServiceId: row.id,
          serviceType: row.service_type,
          serviceMode: row.service_mode,
          basePrice: row.base_price,
          serviceDurationMinutes: row.service_duration_minutes ?? 30,
          availableSlotCount: 0,
          availableForSelectedSlot: false,
          recommended: false,
        };
      });

      const recommendedProvider = [...providerCards].sort((left, right) => {
        if (left.basePrice !== right.basePrice) {
          return left.basePrice - right.basePrice;
        }

        return left.providerName.localeCompare(right.providerName);
      })[0];

      return NextResponse.json({
        services: serviceSummaries,
        providers: providerCards.map((item) => ({
          ...item,
          recommended: item.providerServiceId === recommendedProvider?.providerServiceId,
        })),
        slotOptions: [],
        recommendedSlotStartTime: null,
        recommendedProviderServiceId: recommendedProvider?.providerServiceId ?? null,
      });
    }

    const slotsByProviderServiceId = new Map<string, Slot[]>();

    await Promise.all(
      scopedProviderServices.map(async (row) => {
        const slots = await getAvailableSlots(supabase, {
          providerId: row.provider_id,
          bookingDate,
          serviceDurationMinutes: row.service_duration_minutes ?? undefined,
        });

        slotsByProviderServiceId.set(row.id, slots as Slot[]);
      }),
    );

    const slotMap = new Map<
      string,
      {
        startTime: string;
        endTime: string;
        availableProviderCount: number;
        providerServiceIds: string[];
      }
    >();

    for (const row of scopedProviderServices) {
      const slots = slotsByProviderServiceId.get(row.id) ?? [];

      for (const slot of slots) {
        if (!slot.is_available) {
          continue;
        }

        const key = `${slot.start_time}-${slot.end_time}`;
        const existing = slotMap.get(key);

        if (!existing) {
          slotMap.set(key, {
            startTime: slot.start_time,
            endTime: slot.end_time,
            availableProviderCount: 1,
            providerServiceIds: [row.id],
          });
          continue;
        }

        existing.availableProviderCount += 1;
        existing.providerServiceIds.push(row.id);
      }
    }

    const slotOptions = Array.from(slotMap.values()).sort(rankSlots);
    const recommendedSlot = slotOptions[0] ?? null;

    const selectedSlotTime = startTime ?? recommendedSlot?.startTime ?? null;

    const providers = scopedProviderServices
      .map((row) => {
        const providerProfile = row.providers?.[0];
        const slots = slotsByProviderServiceId.get(row.id) ?? [];
        const availableSlotCount = slots.filter((slot) => slot.is_available).length;
        const availableForSelectedSlot = selectedSlotTime
          ? slots.some((slot) => slot.is_available && slot.start_time === selectedSlotTime)
          : false;

        return {
          providerId: row.provider_id,
          providerName: providerProfile?.name ?? `Provider #${row.provider_id}`,
          providerType: providerProfile?.provider_type ?? null,
          providerServiceId: row.id,
          serviceType: row.service_type,
          serviceMode: row.service_mode,
          basePrice: row.base_price,
          serviceDurationMinutes: row.service_duration_minutes ?? 30,
          availableSlotCount,
          availableForSelectedSlot,
        };
      })
      .sort((left, right) => {
        if (left.availableForSelectedSlot !== right.availableForSelectedSlot) {
          return left.availableForSelectedSlot ? -1 : 1;
        }

        if (left.availableSlotCount !== right.availableSlotCount) {
          return right.availableSlotCount - left.availableSlotCount;
        }

        if (left.basePrice !== right.basePrice) {
          return left.basePrice - right.basePrice;
        }

        return left.providerName.localeCompare(right.providerName);
      });

    const recommendedProviderServiceId = providers[0]?.providerServiceId ?? null;

    return NextResponse.json({
      services: serviceSummaries,
      providers: providers.map((item) => ({
        ...item,
        recommended: item.providerServiceId === recommendedProviderServiceId,
      })),
      slotOptions: slotOptions.map((slot) => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        availableProviderCount: slot.availableProviderCount,
        recommended: slot.startTime === recommendedSlot?.startTime,
      })),
      recommendedSlotStartTime: recommendedSlot?.startTime ?? null,
      recommendedProviderServiceId,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load admin booking availability');
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
