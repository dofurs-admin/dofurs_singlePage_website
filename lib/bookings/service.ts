import type { SupabaseClient } from '@supabase/supabase-js';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import type { BookingActorRole } from './state-transition-guard';
import { reverseDiscountRedemptionForBooking } from './discounts';
import {
  resolveAvailableSlots,
  resolveDayAvailability,
  resolveAvailableSlotsMultiDay,
} from './engines/slotEngine';
import { assertBookingStateTransition } from './state-transition-guard';
import type {
  BookingCreationResponse,
  BookingRecord,
  BookingStatus,
  CreateBookingInput,
  GetAvailableSlotsInput,
  OverrideBookingInput,
  ProviderBookingsQuery,
} from './types';

const BOOKING_SELECT =
  'id, user_id, pet_id, provider_id, provider_service_id, service_type, booking_date, start_time, end_time, booking_mode, location_address, latitude, longitude, booking_status, cancellation_reason, cancellation_by, price_at_booking, admin_price_reference, provider_notes, internal_notes, payment_mode, platform_fee, provider_payout_status, created_at, updated_at';

type BookingTransitionActorContext = {
  actorId?: string;
  actorRole?: BookingActorRole;
  source?: string;
};

type ApplyBookingStatusTransitionInput = BookingTransitionActorContext & {
  expectedUserId?: string;
  expectedProviderId?: number;
  nextStatus: BookingStatus;
  cancellationBy?: 'user' | 'provider' | 'admin';
  cancellationReason?: string | null;
  providerNotes?: string | null;
};

async function getCurrentBookingStatus(supabase: SupabaseClient, bookingId: number) {
  const { data: currentBooking, error: currentBookingError } = await supabase
    .from('bookings')
    .select('id, booking_status')
    .eq('id', bookingId)
    .single<{ id: number; booking_status: BookingStatus }>();

  if (currentBookingError || !currentBooking) {
    throw currentBookingError ?? new Error('Booking not found');
  }

  return currentBooking.booking_status;
}

async function logBookingTransitionAuditEvent(
  supabase: SupabaseClient,
  bookingId: number,
  currentStatus: BookingStatus,
  nextStatus: BookingStatus,
  context?: BookingTransitionActorContext & { cancellationBy?: 'user' | 'provider' | 'admin'; cancellationReason?: string | null },
) {
  const eventPayload = {
    booking_id: bookingId,
    actor_id: context?.actorId ?? null,
    actor_role: context?.actorRole ?? null,
    from_status: currentStatus,
    to_status: nextStatus,
    cancellation_by: context?.cancellationBy ?? null,
    reason: context?.cancellationReason ?? null,
    source: context?.source ?? 'booking_service',
    metadata: {
      event_type: 'booking_status_transition',
      from_status: currentStatus,
      to_status: nextStatus,
      actor_role: context?.actorRole ?? null,
      cancellation_by: context?.cancellationBy ?? null,
      source: context?.source ?? 'booking_service',
    },
  };

  const { error: transitionError } = await supabase.from('booking_status_transition_events').insert(eventPayload);

  if (!transitionError) {
    return;
  }

  if (transitionError.code !== '42P01') {
    if (transitionError.code === '42501') {
      return;
    }

    throw transitionError;
  }

  const { error: legacyError } = await supabase.from('booking_adjustment_events').insert({
    booking_id: bookingId,
    actor_id: context?.actorId ?? null,
    adjustment_amount: null,
    adjustment_type: 'status_transition',
    reason: context?.cancellationReason ?? null,
    metadata: {
      event_type: 'booking_status_transition',
      from_status: currentStatus,
      to_status: nextStatus,
      actor_role: context?.actorRole ?? null,
      cancellation_by: context?.cancellationBy ?? null,
      source: context?.source ?? 'booking_service',
    },
  });

  if (!legacyError) {
    return;
  }

  if (legacyError.code === '42P01' || legacyError.code === '42501') {
    return;
  }

  throw legacyError;
}

async function applyBookingStatusTransition(
  supabase: SupabaseClient,
  bookingId: number,
  input: ApplyBookingStatusTransitionInput,
) {
  let existingQuery = supabase.from('bookings').select('id, user_id, provider_id, booking_status').eq('id', bookingId);

  if (input.expectedUserId) {
    existingQuery = existingQuery.eq('user_id', input.expectedUserId);
  }

  if (input.expectedProviderId) {
    existingQuery = existingQuery.eq('provider_id', input.expectedProviderId);
  }

  const { data: existing, error: existingError } = await existingQuery.single<{
    id: number;
    user_id: string;
    provider_id: number;
    booking_status: BookingStatus;
  }>();

  if (existingError || !existing) {
    throw existingError ?? new Error('Booking not found');
  }

  assertBookingStateTransition(existing.booking_status, input.nextStatus);

  const updatePayload: {
    booking_status: BookingStatus;
    status: BookingStatus;
    cancellation_by: 'user' | 'provider' | 'admin' | null;
    cancellation_reason: string | null;
    provider_notes?: string | null;
  } = {
    booking_status: input.nextStatus,
    status: input.nextStatus,
    cancellation_by: input.nextStatus === 'cancelled' ? input.cancellationBy ?? null : null,
    cancellation_reason: input.nextStatus === 'cancelled' ? input.cancellationReason ?? null : null,
  };

  if (input.providerNotes !== undefined) {
    updatePayload.provider_notes = input.providerNotes;
  }

  let updateQuery = supabase.from('bookings').update(updatePayload).eq('id', bookingId);

  if (input.expectedUserId) {
    updateQuery = updateQuery.eq('user_id', input.expectedUserId);
  }

  if (input.expectedProviderId) {
    updateQuery = updateQuery.eq('provider_id', input.expectedProviderId);
  }

  const { data, error } = await updateQuery.select(BOOKING_SELECT).single<BookingRecord>();

  if (error) {
    throw error;
  }

  await logBookingTransitionAuditEvent(supabase, bookingId, existing.booking_status, input.nextStatus, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    source: input.source,
    cancellationBy: input.nextStatus === 'cancelled' ? input.cancellationBy : undefined,
    cancellationReason: input.nextStatus === 'cancelled' ? input.cancellationReason : undefined,
  });

  if (input.nextStatus === 'cancelled') {
    await reverseDiscountRedemptionForBooking(
      bookingId,
      input.cancellationReason ?? `${input.cancellationBy ?? 'admin'}_cancelled_booking`,
    );
  }

  return data;
}

export async function createBooking(supabase: SupabaseClient, userId: string, input: CreateBookingInput) {
  const isServiceBooking = (input.bookingType ?? 'service') === 'service';

  if (isServiceBooking) {
    return createBookingWithLegacyServiceFallback(supabase, userId, input);
  }

  const requiresLegacyServiceId = await bookingTableRequiresLegacyServiceId(supabase);

  if (requiresLegacyServiceId) {
    return createBookingWithLegacyServiceFallback(supabase, userId, input);
  }

  const { data, error } = await supabase.rpc('create_booking_atomic', {
    p_user_id: userId,
    p_pet_id: input.petId,
    p_provider_id: input.providerId,
    p_provider_service_id: input.providerServiceId ?? null,
    p_booking_type: input.bookingType ?? 'service',
    p_package_id: input.packageId ?? null,
    p_booking_date: input.bookingDate,
    p_start_time: input.startTime,
    p_booking_mode: input.bookingMode,
    p_location_address: input.locationAddress ?? null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_provider_notes: input.providerNotes ?? null,
    p_payment_mode: 'direct_to_provider',
    p_discount_code: input.discountCode ?? null,
    p_add_ons: input.addOns ?? [],
  });

  if (error) {
    const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    const shouldFallbackToLegacyCreate =
      message.includes('service_id') &&
      (message.includes('null value') || message.includes('not-null constraint') || message.includes('violates not-null'));

    if (isServiceBooking && input.providerServiceId) {
      try {
        return await createBookingWithLegacyServiceFallback(supabase, userId, input);
      } catch (fallbackError) {
        if (shouldFallbackToLegacyCreate) {
          throw fallbackError;
        }
      }
    }

    if (shouldFallbackToLegacyCreate) {
      return createBookingWithLegacyServiceFallback(supabase, userId, input);
    }

    throw error;
  }

  const response = data as BookingCreationResponse;

  if (!response.success) {
    throw new Error(`${response.error_code}:${response.error_message}`);
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('id', response.booking_id)
    .single<BookingRecord>();

  if (bookingError || !booking) {
    throw bookingError ?? new Error('Booking created but could not be retrieved');
  }

  return booking;
}

async function createBookingWithLegacyServiceFallback(supabase: SupabaseClient, userId: string, input: CreateBookingInput) {
  const providerServiceId = await resolveProviderServiceIdForLegacyCreate(supabase, input);

  const { data: providerService, error: providerServiceError } = await supabase
    .from('provider_services')
    .select('id, provider_id, service_type, service_duration_minutes, base_price, is_active')
    .eq('id', providerServiceId)
    .eq('provider_id', input.providerId)
    .eq('is_active', true)
    .maybeSingle<{
      id: string;
      provider_id: number;
      service_type: string;
      service_duration_minutes: number | null;
      base_price: number;
      is_active: boolean;
    }>();

  if (providerServiceError || !providerService) {
    throw providerServiceError ?? new Error('Service not found or is inactive.');
  }

  const { data: legacyService, error: legacyServiceError } = await supabase
    .from('services')
    .select('id, price, duration_minutes, buffer_minutes')
    .eq('provider_id', input.providerId)
    .ilike('name', providerService.service_type)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: number; price: number; duration_minutes: number; buffer_minutes: number }>();

  if (legacyServiceError) {
    throw legacyServiceError;
  }

  let resolvedLegacyService = legacyService;

  if (!resolvedLegacyService) {
    const { data: createdLegacyService, error: createLegacyServiceError } = await supabase
      .from('services')
      .insert({
        provider_id: input.providerId,
        name: providerService.service_type,
        duration_minutes: providerService.service_duration_minutes ?? 30,
        buffer_minutes: 0,
        price: providerService.base_price,
      })
      .select('id, price, duration_minutes, buffer_minutes')
      .single<{ id: number; price: number; duration_minutes: number; buffer_minutes: number }>();

    if (createLegacyServiceError || !createdLegacyService) {
      throw createLegacyServiceError ?? new Error('Unable to create legacy service mapping for booking.');
    }

    resolvedLegacyService = createdLegacyService;
  }

  const durationMinutes = Math.max(providerService.service_duration_minutes ?? resolvedLegacyService.duration_minutes ?? 30, 1);
  const bookingStart = new Date(`${input.bookingDate}T${input.startTime}:00Z`);
  const bookingEnd = new Date(bookingStart.getTime() + durationMinutes * 60 * 1000);
  const startTime = bookingStart.toISOString().slice(11, 16);
  const endTime = bookingEnd.toISOString().slice(11, 16);

  const amount = resolvedLegacyService.price ?? providerService.base_price;

  const insertPayload = {
    user_id: userId,
    pet_id: input.petId,
    provider_id: input.providerId,
    service_id: resolvedLegacyService.id,
    provider_service_id: providerServiceId,
    service_type: providerService.service_type,
    booking_date: input.bookingDate,
    start_time: startTime,
    end_time: endTime,
    booking_start: bookingStart.toISOString(),
    booking_end: bookingEnd.toISOString(),
    booking_mode: input.bookingMode,
    location_address: input.locationAddress ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    booking_status: 'pending' as const,
    status: 'pending' as const,
    price_at_booking: amount,
    admin_price_reference: amount,
    amount,
    provider_notes: input.providerNotes ?? null,
    payment_mode: 'direct_to_provider' as const,
    discount_code: input.discountCode ?? null,
  };

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert(insertPayload)
    .select(BOOKING_SELECT)
    .single<BookingRecord>();

  if (bookingError || !booking) {
    throw bookingError ?? new Error('Booking created but could not be retrieved');
  }

  return booking;
}

async function resolveProviderServiceIdForLegacyCreate(supabase: SupabaseClient, input: CreateBookingInput) {
  if (input.providerServiceId) {
    return input.providerServiceId;
  }

  if ((input.bookingType ?? 'service') === 'package' && input.packageId) {
    const { data: packageService, error: packageServiceError } = await supabase
      .from('package_services')
      .select('provider_service_id, provider_services!inner(provider_id, is_active)')
      .eq('package_id', input.packageId)
      .eq('provider_services.provider_id', input.providerId)
      .eq('provider_services.is_active', true)
      .order('sequence_order', { ascending: true })
      .limit(1)
      .maybeSingle<{ provider_service_id: string }>();

    if (packageServiceError) {
      throw packageServiceError;
    }

    if (packageService?.provider_service_id) {
      return packageService.provider_service_id;
    }
  }

  throw new Error('Service not found or is inactive.');
}

async function bookingTableRequiresLegacyServiceId(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', 'bookings')
    .eq('column_name', 'service_id')
    .limit(1)
    .maybeSingle<{ is_nullable: 'YES' | 'NO' }>();

  if (error || !data) {
    return false;
  }

  return data.is_nullable === 'NO';
}

export async function getMyBookings(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('user_id', userId)
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as BookingRecord[];
}

export async function cancelBooking(
  supabase: SupabaseClient,
  userId: string,
  bookingId: number,
  cancellationReason?: string,
  context?: BookingTransitionActorContext,
) {
  return applyBookingStatusTransition(supabase, bookingId, {
    expectedUserId: userId,
    nextStatus: 'cancelled',
    cancellationBy: 'user',
    cancellationReason,
    actorId: context?.actorId ?? userId,
    actorRole: context?.actorRole ?? 'user',
    source: context?.source ?? 'cancelBooking',
  });
}

export async function getAvailableSlots(supabase: SupabaseClient, input: GetAvailableSlotsInput) {
  return resolveAvailableSlots(supabase, input);
}

export async function getDayAvailability(
  supabase: SupabaseClient,
  providerId: number,
  bookingDate: string,
  serviceDurationMinutes?: number,
) {
  return resolveDayAvailability(supabase, providerId, bookingDate, serviceDurationMinutes);
}

export async function getAvailableSlotsMultiDay(
  supabase: SupabaseClient,
  input: {
    providerId: number;
    fromDate: string;
    toDate: string;
    serviceDurationMinutes?: number;
  },
) {
  return resolveAvailableSlotsMultiDay(supabase, input);
}

export async function getProviderBookings(supabase: SupabaseClient, providerUserId: string, query: ProviderBookingsQuery = {}) {
  const providerId = await getProviderIdByUserId(supabase, providerUserId);

  if (!providerId) {
    return [] as BookingRecord[];
  }

  let request = supabase.from('bookings').select(BOOKING_SELECT).eq('provider_id', providerId);

  if (query.status) {
    request = request.eq('booking_status', query.status);
  }

  if (query.fromDate) {
    request = request.gte('booking_date', query.fromDate);
  }

  if (query.toDate) {
    request = request.lte('booking_date', query.toDate);
  }

  request = request.order('booking_date', { ascending: true }).order('start_time', { ascending: true });

  if (query.limit && query.limit > 0) {
    request = request.limit(query.limit);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return (data ?? []) as BookingRecord[];
}

async function providerUpdateBookingStatus(
  supabase: SupabaseClient,
  providerUserId: string,
  bookingId: number,
  nextStatus: BookingStatus,
  providerNotes?: string,
) {
  const providerId = await getProviderIdByUserId(supabase, providerUserId);

  if (!providerId) {
    throw new Error('Provider profile is not linked to this account.');
  }

  return applyBookingStatusTransition(supabase, bookingId, {
    expectedProviderId: providerId,
    nextStatus,
    cancellationBy: nextStatus === 'cancelled' ? 'provider' : undefined,
    providerNotes: providerNotes ?? null,
    actorId: providerUserId,
    actorRole: 'provider',
    source: 'providerUpdateBookingStatus',
  });
}

export async function confirmBooking(supabase: SupabaseClient, providerUserId: string, bookingId: number, providerNotes?: string) {
  return providerUpdateBookingStatus(supabase, providerUserId, bookingId, 'confirmed', providerNotes);
}

export async function completeBooking(supabase: SupabaseClient, providerUserId: string, bookingId: number, providerNotes?: string) {
  return providerUpdateBookingStatus(supabase, providerUserId, bookingId, 'completed', providerNotes);
}

export async function markNoShow(supabase: SupabaseClient, providerUserId: string, bookingId: number, providerNotes?: string) {
  return providerUpdateBookingStatus(supabase, providerUserId, bookingId, 'no_show', providerNotes);
}

export async function cancelBookingAsProvider(
  supabase: SupabaseClient,
  providerUserId: string,
  bookingId: number,
  cancellationReason?: string,
  providerNotes?: string,
) {
  const providerId = await getProviderIdByUserId(supabase, providerUserId);

  if (!providerId) {
    throw new Error('Provider profile is not linked to this account.');
  }

  return applyBookingStatusTransition(supabase, bookingId, {
    expectedProviderId: providerId,
    nextStatus: 'cancelled',
    cancellationBy: 'provider',
    cancellationReason,
    providerNotes: providerNotes ?? null,
    actorId: providerUserId,
    actorRole: 'provider',
    source: 'cancelBookingAsProvider',
  });
}

export async function updateBookingStatus(
  supabase: SupabaseClient,
  bookingId: number,
  nextStatus: BookingStatus,
  options?: {
    cancellationBy?: 'user' | 'provider' | 'admin';
    cancellationReason?: string | null;
    actorId?: string;
    actorRole?: BookingActorRole;
    source?: string;
  },
) {
  return applyBookingStatusTransition(supabase, bookingId, {
    nextStatus,
    cancellationBy: nextStatus === 'cancelled' ? options?.cancellationBy ?? 'admin' : undefined,
    cancellationReason: nextStatus === 'cancelled' ? options?.cancellationReason ?? null : undefined,
    actorId: options?.actorId,
    actorRole: options?.actorRole,
    source: options?.source ?? 'updateBookingStatus',
  });
}

export async function overrideBooking(supabase: SupabaseClient, bookingId: number, patch: OverrideBookingInput) {
  if (patch.bookingStatus) {
    await applyBookingStatusTransition(supabase, bookingId, {
      nextStatus: patch.bookingStatus,
      cancellationBy: patch.bookingStatus === 'cancelled' ? patch.cancellationBy ?? 'admin' : undefined,
      cancellationReason: patch.bookingStatus === 'cancelled' ? patch.cancellationReason ?? null : undefined,
      providerNotes: patch.providerNotes,
      source: 'overrideBooking',
    });
  }

  const updatePayload = {
    booking_date: patch.bookingDate,
    start_time: patch.startTime,
    end_time: patch.endTime,
    booking_mode: patch.bookingMode,
    location_address: patch.locationAddress,
    latitude: patch.latitude,
    longitude: patch.longitude,
    provider_notes: patch.providerNotes,
    internal_notes: patch.internalNotes,
    booking_status: patch.bookingStatus,
    status: patch.bookingStatus,
    cancellation_reason: patch.cancellationReason,
    cancellation_by: patch.cancellationBy,
    price_at_booking: patch.priceAtBooking,
    admin_price_reference: patch.adminPriceReference,
  };

  const { data, error } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', bookingId)
    .select(BOOKING_SELECT)
    .single<BookingRecord>();

  if (error) {
    throw error;
  }

  return data;
}

export async function manualAssignProvider(
  supabase: SupabaseClient,
  bookingId: number,
  providerId: number,
  providerServiceId: string,
) {
  const currentStatus = await getCurrentBookingStatus(supabase, bookingId);
  assertBookingStateTransition(currentStatus, 'pending');

  const { data: providerService, error: providerServiceError } = await supabase
    .from('provider_services')
    .select('id, provider_id, service_type')
    .eq('id', providerServiceId)
    .eq('provider_id', providerId)
    .single<{ id: string; provider_id: number; service_type: string }>();

  if (providerServiceError || !providerService) {
    throw providerServiceError ?? new Error('Provider service not found');
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({
      provider_id: providerId,
      provider_service_id: providerService.id,
      service_type: providerService.service_type,
      booking_status: 'pending',
      status: 'pending',
      cancellation_reason: null,
      cancellation_by: null,
    })
    .eq('id', bookingId)
    .select(BOOKING_SELECT)
    .single<BookingRecord>();

  if (error) {
    throw error;
  }

  return data;
}

export async function processAdminCancellationAdjustment(
  supabase: SupabaseClient,
  actorId: string,
  bookingId: number,
  input?: {
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const booking = await updateBookingStatus(supabase, bookingId, 'cancelled', {
    cancellationBy: 'admin',
    cancellationReason: input?.reason ?? 'Cancelled by admin',
    actorId,
    actorRole: 'admin',
    source: 'processAdminCancellationAdjustment',
  });

  await reverseDiscountRedemptionForBooking(bookingId, input?.reason ?? 'cancelled_by_admin');

  const { error: adjustmentLogError } = await supabase.from('booking_adjustment_events').insert({
    booking_id: bookingId,
    actor_id: actorId,
    adjustment_amount: null,
    adjustment_type: 'cancellation_adjustment',
    reason: input?.reason ?? null,
    metadata: {
      payment_collection_mode: 'direct_to_provider',
      adjustment_type: 'cancellation_with_discount_reversal',
      ...(input?.metadata ?? {}),
    },
  });

  if (adjustmentLogError && adjustmentLogError.code !== '42P01') {
    throw adjustmentLogError;
  }

  return booking;
}