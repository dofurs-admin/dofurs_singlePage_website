import type { SupabaseClient } from '@supabase/supabase-js';
import { applyDiscount } from './discountEngine';

export type PriceBreakdown = {
  basePrice: number;
  addOnPrice: number;
  discountAmount: number;
  finalPrice: number;
  breakdown: string[];
};

export async function calculateBookingPriceWithSupabase(
  supabase: SupabaseClient,
  params: {
    bookingType: 'service' | 'package';
    providerId: string | number | bigint;
    serviceId?: string;
    packageId?: string;
    addOns?: Array<{ id: string; quantity: number }>;
  },
): Promise<PriceBreakdown> {
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

  if (params.bookingType === 'package' && params.packageId) {
    const { data: packageServices, error: packageServicesError } = await supabase
      .from('package_services')
      .select('provider_service_id')
      .eq('package_id', params.packageId)
      .returns<Array<{ provider_service_id: string }>>();

    if (packageServicesError || !packageServices || packageServices.length === 0) {
      throw new Error('Package has no services');
    }

    const { data: services, error: servicesError } = await supabase
      .from('provider_services')
      .select('id, base_price')
      .eq('provider_id', params.providerId)
      .in(
        'id',
        packageServices.map((item) => item.provider_service_id),
      )
      .returns<Array<{ id: string; base_price: number | null }>>();

    if (servicesError || !services || services.length === 0) {
      throw new Error('Provider has no services in this package');
    }

    basePrice = services.reduce((sum, service) => sum + Number(service.base_price ?? 0), 0);

    const { data: pkg, error: pkgError } = await supabase
      .from('service_packages')
      .select('discount_type, discount_value')
      .eq('id', params.packageId)
      .single<{ discount_type: 'percentage' | 'fixed' | null; discount_value: number | null }>();

    if (pkgError) {
      throw pkgError;
    }

    if (pkg?.discount_type && pkg.discount_value) {
      discountAmount = pkg.discount_type === 'percentage' ? (basePrice * pkg.discount_value) / 100 : pkg.discount_value;
    }

    breakdown.push(`Package (${services.length} services): ₹${basePrice}`);

    if (discountAmount > 0) {
      breakdown.push(`Package discount: -₹${discountAmount.toFixed(2)}`);
    }
  }

  return {
    basePrice,
    addOnPrice,
    discountAmount,
    finalPrice: applyDiscount(basePrice + addOnPrice, discountAmount),
    breakdown,
  };
}
