import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { calculateBookingPriceWithSupabase } from '@/lib/bookings/engines/pricingEngine';
import type { PricingBreakdown } from '@/lib/bookings/types';

export type BookingPriceParameters = {
  bookingType: 'service' | 'package';
  serviceId?: string;
  packageId?: string;
  providerId: string | number | bigint;
  quantity?: number;
  addOns?: Array<{ id: string; quantity: number }>;
};

export async function calculateBookingPrice(params: BookingPriceParameters): Promise<PricingBreakdown> {
  const supabase = getSupabaseAdminClient();

  return calculateBookingPriceWithSupabase(supabase, {
    bookingType: params.bookingType,
    serviceId: params.serviceId,
    packageId: params.packageId,
    providerId: params.providerId,
    addOns: params.addOns,
  });
}
