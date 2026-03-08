import type { SupabaseClient } from '@supabase/supabase-js';
import type { PricingBreakdown } from '../types';
import { applyDiscount } from './discountEngine';

export type PriceBreakdown = PricingBreakdown;

export async function calculateBookingPriceWithSupabase(
  supabase: SupabaseClient,
  params: {
    bookingType: 'service';
    providerId: string | number | bigint;
    serviceId?: string;
    addOns?: Array<{ id: string; quantity: number }>;
  },
): Promise<PricingBreakdown> {
  const breakdown: string[] = [];
  let basePrice = 0;
  let addOnPrice = 0;
  let discountAmount = 0;

  if (params.bookingType === 'service' && params.serviceId) {
    const { data: service, error } = await supabase
      .from('provider_services')
      .select('base_price, service_type')
      .eq('id', params.serviceId)
      .eq('provider_id', params.providerId)
      .single<{ base_price: number | null; service_type: string }>();

    if (error || !service) {
      throw new Error('Service not found');
    }

    basePrice = Number(service.base_price ?? 0);
    breakdown.push(`${service.service_type}: ₹${basePrice}`);

    for (const addon of params.addOns ?? []) {
      const { data: addonData, error: addonError } = await supabase
        .from('service_addons')
        .select('name, price')
        .eq('id', addon.id)
        .single<{ name: string; price: number | null }>();

      if (addonError || !addonData) {
        throw new Error('Add-on not found');
      }

      const qty = Math.max(1, addon.quantity || 1);
      const addonCost = Number(addonData.price ?? 0) * qty;
      addOnPrice += addonCost;
      breakdown.push(`${addonData.name} (x${qty}): ₹${addonCost}`);
    }
  }

  return {
    base_total: basePrice,
    addon_total: addOnPrice,
    discount_amount: discountAmount,
    final_total: applyDiscount(basePrice + addOnPrice, discountAmount),
    breakdown,
  };
}
