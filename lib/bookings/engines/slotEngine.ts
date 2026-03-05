import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookableSlot } from '../types';

/**
 * Slot Engine: Reusable service for generating provider availability slots
 *
 * Features:
 * - Merges weekly recurring availability with service duration
 * - Automatically removes blocked dates (provider_blocked_dates table)
 * - Automatically removes booked slots (pending/confirmed bookings)
 * - Filters provider_blocks (timestamp-based blocks)
 * - Prevents overlapping time slots
 * - Returns normalized time slots (HH:MM format)
 *
 * No slot logic should exist in UI components. All slot generation
 * must flow through this engine via the API layer.
 *
 * Usage:
 * - Single day: resolveAvailableSlots(supabase, { providerId, bookingDate, serviceDurationMinutes })
 * - Multiple days: resolveAvailableSlotsMultiDay(supabase, { providerId, fromDate, toDate, serviceDurationMinutes })
 */

export type TimeSlot = {
  start_time: string;
  end_time: string;
  is_available: boolean;
};

export type DayAvailability = {
  date: string;
  dayOfWeek: number;
  dayName: string;
  slots: TimeSlot[];
  is_blocked: boolean;
  block_reason?: string;
};

function toTimeValue(value: string) {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function getDayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00`).getDay();
}

function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Check if a timestamp-based block overlaps with a date/time slot
 */
function isTimeWithinBlock(
  date: string,
  startTime: string,
  endTime: string,
  blockStart: string,
  blockEnd: string,
): boolean {
  const slotStart = new Date(`${date}T${startTime}:00`);
  const slotEnd = new Date(`${date}T${endTime}:00`);
  const blockStartDt = new Date(blockStart);
  const blockEndDt = new Date(blockEnd);

  return slotStart < blockEndDt && slotEnd > blockStartDt;
}

/**
 * Get available slots for a single day
 * Internally handles: blocked dates, booked slots, provider blocks, overlaps
 *
 * @param supabase - Supabase client
 * @param providerId - Provider ID
 * @param bookingDate - Date in YYYY-MM-DD format
 * @param serviceDurationMinutes - Service duration (default: 30)
 * @returns Array of available time slots
 */
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

  // Filter out slots that overlap with provider_blocks (timestamp-based blocks)
  const blocksData = await supabase
    .from('provider_blocks')
    .select('block_start, block_end')
    .eq('provider_id', input.providerId)
    .or(
      `and(block_start.lte.${new Date(input.bookingDate).toISOString()},block_end.gte.${new Date(input.bookingDate).toISOString()})`,
    );

  const blocks = blocksData.data ?? [];

  return ((data ?? []) as BookableSlot[])
    .map((slot) => ({
      ...slot,
      start_time: toTimeValue(slot.start_time),
      end_time: toTimeValue(slot.end_time),
    }))
    .filter((slot) => {
      return !blocks.some((block) =>
        isTimeWithinBlock(input.bookingDate, slot.start_time, slot.end_time, block.block_start, block.block_end),
      );
    });
}

/**
 * Get available time slots with detailed day information
 * Useful for calendar views showing blocked dates
 *
 * @param supabase - Supabase client
 * @param providerId - Provider ID
 * @param bookingDate - Date in YYYY-MM-DD format
 * @param serviceDurationMinutes - Service duration (default: 30)
 * @returns Day availability with slots and block information
 */
export async function resolveDayAvailability(
  supabase: SupabaseClient,
  providerId: number,
  bookingDate: string,
  serviceDurationMinutes?: number,
): Promise<DayAvailability> {
  const dayOfWeek = getDayOfWeek(bookingDate);
  const dayName = getDayName(dayOfWeek);

  // Check if entire day is blocked
  const { data: blockedDate } = await supabase
    .from('provider_blocked_dates')
    .select('id, reason')
    .eq('provider_id', providerId)
    .eq('blocked_date', bookingDate)
    .single();

  if (blockedDate) {
    return {
      date: bookingDate,
      dayOfWeek,
      dayName,
      slots: [],
      is_blocked: true,
      block_reason: blockedDate.reason,
    };
  }

  const slots = await resolveAvailableSlots(supabase, {
    providerId,
    bookingDate,
    serviceDurationMinutes,
  });

  return {
    date: bookingDate,
    dayOfWeek,
    dayName,
    slots,
    is_blocked: false,
  };
}

/**
 * Get available slots across multiple days
 * Useful for calendar/scheduling UI showing a week or month view
 *
 * @param supabase - Supabase client
 * @param providerId - Provider ID
 * @param fromDate - Start date (YYYY-MM-DD)
 * @param toDate - End date (YYYY-MM-DD, inclusive)
 * @param serviceDurationMinutes - Service duration (default: 30)
 * @returns Array of day availability objects
 */
export async function resolveAvailableSlotsMultiDay(
  supabase: SupabaseClient,
  input: {
    providerId: number;
    fromDate: string;
    toDate: string;
    serviceDurationMinutes?: number;
  },
): Promise<DayAvailability[]> {
  const results: DayAvailability[] = [];

  let currentDate = input.fromDate;
  const toDate = new Date(`${input.toDate}T23:59:59`);

  while (new Date(`${currentDate}T00:00:00`) <= toDate) {
    const dayAvailability = await resolveDayAvailability(
      supabase,
      input.providerId,
      currentDate,
      input.serviceDurationMinutes,
    );
    results.push(dayAvailability);

    currentDate = addDays(currentDate, 1);
  }

  return results;
}
