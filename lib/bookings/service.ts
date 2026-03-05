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
    p_discount_amount: input.discountAmount ?? null,
    p_final_price: input.finalPrice ?? null,
    p_add_ons: input.addOns ?? [],
  });

  if (error) {
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