import { getSupabaseServerClient } from '@/lib/supabase/server-client';

type TimeRange = {
  start: Date;
  end: Date;
};

function parseTimeOnDate(date: string, time: string) {
  return new Date(`${date}T${time}`);
}

function overlaps(rangeA: TimeRange, rangeB: TimeRange) {
  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
}

function normalizeDay(day: string) {
  return day.trim().toLowerCase();
}

function getDayVariants(date: Date) {
  const full = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const short = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  return [full, short];
}

export async function getAvailableSlots(providerId: number, date: string, serviceId?: number) {
  const supabase = await getSupabaseServerClient();

  const { data: provider, error: providerError } = await supabase
    .from('providers')
    .select('id, working_days, start_time, end_time')
    .eq('id', providerId)
    .single();

  if (providerError || !provider) {
    throw new Error('Provider not found');
  }

  const targetDate = new Date(`${date}T00:00:00`);
  const dayVariants = getDayVariants(targetDate);
  const workingDays = (provider.working_days ?? []).map(normalizeDay);
  const isWorkingDay = dayVariants.some((day) => workingDays.includes(day));

  if (!isWorkingDay) {
    return [] as string[];
  }

  let slotLengthMinutes = 30;

  if (serviceId) {
    const { data: service } = await supabase
      .from('services')
      .select('duration_minutes, buffer_minutes')
      .eq('id', serviceId)
      .eq('provider_id', providerId)
      .single();

    if (service) {
      slotLengthMinutes = service.duration_minutes + service.buffer_minutes;
    }
  } else {
    const { data: service } = await supabase
      .from('services')
      .select('duration_minutes, buffer_minutes')
      .eq('provider_id', providerId)
      .order('duration_minutes', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (service) {
      slotLengthMinutes = service.duration_minutes + service.buffer_minutes;
    }
  }

  const dayStart = parseTimeOnDate(date, provider.start_time);
  const dayEnd = parseTimeOnDate(date, provider.end_time);

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('booking_start, booking_end')
    .eq('provider_id', providerId)
    .in('status', ['pending', 'confirmed'])
    .lt('booking_start', dayEnd.toISOString())
    .gt('booking_end', dayStart.toISOString());

  if (bookingsError) {
    throw new Error(bookingsError.message);
  }

  const { data: providerBlocks, error: blocksError } = await supabase
    .from('provider_blocks')
    .select('block_start, block_end')
    .eq('provider_id', providerId)
    .lt('block_start', dayEnd.toISOString())
    .gt('block_end', dayStart.toISOString());

  if (blocksError) {
    throw new Error(blocksError.message);
  }

  const blockedRanges: TimeRange[] = [
    ...(bookings ?? []).map((booking) => ({
      start: new Date(booking.booking_start),
      end: new Date(booking.booking_end),
    })),
    ...(providerBlocks ?? []).map((block) => ({
      start: new Date(block.block_start),
      end: new Date(block.block_end),
    })),
  ];

  const slots: string[] = [];
  let pointer = new Date(dayStart);

  while (pointer < dayEnd) {
    const slotStart = new Date(pointer);
    const slotEnd = new Date(slotStart.getTime() + slotLengthMinutes * 60 * 1000);

    if (slotEnd > dayEnd) {
      break;
    }

    const hasOverlap = blockedRanges.some((blocked) => overlaps({ start: slotStart, end: slotEnd }, blocked));

    if (!hasOverlap) {
      slots.push(slotStart.toISOString());
    }

    pointer = new Date(pointer.getTime() + slotLengthMinutes * 60 * 1000);
  }

  return slots;
}
