import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookableSlot } from '../types';

function toTimeValue(value: string) {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export async function resolveAvailableSlots(
  supabase: SupabaseClient,
  input: {
    providerId: number;
    bookingDate: string;
    serviceDurationMinutes?: number;
  },
): Promise<BookableSlot[]> {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_provider_id: input.providerId,
    p_booking_date: input.bookingDate,
    p_service_duration_minutes: input.serviceDurationMinutes ?? 30,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as BookableSlot[]).map((slot) => ({
    ...slot,
    start_time: toTimeValue(slot.start_time),
    end_time: toTimeValue(slot.end_time),
  }));
}
