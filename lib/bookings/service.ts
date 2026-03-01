import type { SupabaseClient } from '@supabase/supabase-js';
import { getProviderIdByUserId } from '@/lib/provider-management/api';
import type {
  BookingRecord,
  BookingStatus,
  BookableSlot,
  CreateBookingInput,
  GetAvailableSlotsInput,
  OverrideBookingInput,
  ProviderBookingsQuery,
} from './types';

const BOOKING_SELECT =
  'id, user_id, pet_id, provider_id, provider_service_id, service_type, booking_date, start_time, end_time, booking_mode, location_address, latitude, longitude, booking_status, cancellation_reason, cancellation_by, price_at_booking, admin_price_reference, provider_notes, internal_notes, payment_mode, platform_fee, provider_payout_status, created_at, updated_at';

const PROVIDER_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

function assertProviderTransition(current: BookingStatus, next: BookingStatus) {
  if (!PROVIDER_STATUS_TRANSITIONS[current].includes(next)) {
    throw new Error(`Invalid status transition: ${current} -> ${next}`);
  }
}

function toTimeValue(value: string) {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export async function createBooking(supabase: SupabaseClient, userId: string, input: CreateBookingInput) {
  const { data, error } = await supabase.rpc('create_booking_v2', {
    p_user_id: userId,
    p_pet_id: input.petId,
    p_provider_id: input.providerId,
    p_provider_service_id: input.providerServiceId,
    p_booking_date: input.bookingDate,
    p_start_time: input.startTime,
    p_booking_mode: input.bookingMode,
    p_location_address: input.locationAddress ?? null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_provider_notes: input.providerNotes ?? null,
    p_payment_mode: 'direct_to_provider',
  });

  if (error) {
    throw error;
  }

  return data as BookingRecord;
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

export async function cancelBooking(supabase: SupabaseClient, userId: string, bookingId: number, cancellationReason?: string) {
  const { data, error } = await supabase
    .from('bookings')
    .update({
      booking_status: 'cancelled',
      status: 'cancelled',
      cancellation_by: 'user',
      cancellation_reason: cancellationReason ?? null,
    })
    .eq('id', bookingId)
    .eq('user_id', userId)
    .select(BOOKING_SELECT)
    .single<BookingRecord>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getAvailableSlots(supabase: SupabaseClient, input: GetAvailableSlotsInput) {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_provider_id: input.providerId,
    p_booking_date: input.bookingDate,
    p_service_duration_minutes: input.serviceDurationMinutes ?? 30,
  });

  if (error) {
    throw error;
  }

  const slots = ((data ?? []) as BookableSlot[]).map((slot) => ({
    ...slot,
    start_time: toTimeValue(slot.start_time),
    end_time: toTimeValue(slot.end_time),
  }));

  return slots;
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

  const { data: existing, error: existingError } = await supabase
    .from('bookings')
    .select('id, provider_id, booking_status')
    .eq('id', bookingId)
    .eq('provider_id', providerId)
    .single<{ id: number; provider_id: number; booking_status: BookingStatus }>();

  if (existingError || !existing) {
    throw existingError ?? new Error('Booking not found');
  }

  assertProviderTransition(existing.booking_status, nextStatus);

  const { data, error } = await supabase
    .from('bookings')
    .update({
      booking_status: nextStatus,
      status: nextStatus,
      cancellation_by: nextStatus === 'cancelled' ? 'provider' : null,
      provider_notes: providerNotes ?? null,
    })
    .eq('id', bookingId)
    .eq('provider_id', providerId)
    .select(BOOKING_SELECT)
    .single<BookingRecord>();

  if (error) {
    throw error;
  }

  return data;
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

export async function updateBookingStatus(
  supabase: SupabaseClient,
  bookingId: number,
  nextStatus: BookingStatus,
  options?: { cancellationBy?: 'user' | 'provider' | 'admin'; cancellationReason?: string | null },
) {
  const { data, error } = await supabase
    .from('bookings')
    .update({
      booking_status: nextStatus,
      status: nextStatus,
      cancellation_by: nextStatus === 'cancelled' ? options?.cancellationBy ?? 'admin' : null,
      cancellation_reason: nextStatus === 'cancelled' ? options?.cancellationReason ?? null : null,
    })
    .eq('id', bookingId)
    .select(BOOKING_SELECT)
    .single<BookingRecord>();

  if (error) {
    throw error;
  }

  return data;
}

export async function overrideBooking(supabase: SupabaseClient, bookingId: number, patch: OverrideBookingInput) {
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