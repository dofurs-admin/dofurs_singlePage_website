/**
 * Service Catalog Utilities
 * Core business logic for service catalog operations including pricing,
 * package composition, and booking calculations.
 */

import { createClient } from "@supabase/supabase-js";
import type {
  Service,
  ServicePackage,
  PackageService,
  ServiceAddon,
  PackageComposition,
} from "./types";
import {
  calculateBookingPrice as calculateBookingPriceFromEngine,
  type BookingPriceParameters,
} from "./engines/pricing-engine";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// PRICING CALCULATIONS
// ============================================================================

/**
 * Calculate dynamic package price based on provider services and discount
 */
export async function calculatePackagePrice(
  packageId: string,
  providerId: string | bigint
): Promise<{
  basePrice: number;
  discountAmount: number;
  finalPrice: number;
  serviceCount: number;
}> {
  // Fetch package composition
  const { data: packageServices, error: psError } = await supabase
    .from("package_services")
    .select("provider_service_id")
    .eq("package_id", packageId);

  if (psError) throw psError;
  if (!packageServices || packageServices.length === 0) {
    throw new Error("Package has no services");
  }

  // Fetch provider service prices
  const { data: services, error: sError } = await supabase
    .from("provider_services")
    .select("id, base_price, surge_price")
    .eq("provider_id", providerId)
    .in(
      "id",
      packageServices.map((ps) => ps.provider_service_id)
    );

  if (sError) throw sError;
  if (!services || services.length === 0) {
    throw new Error("Provider has no services in this package");
  }

  // Calculate base price
  const basePrice = services.reduce(
    (sum, s) => sum + (Number(s.base_price) || 0),
    0
  );

  // Fetch package discount
  const { data: pkg, error: pkgError } = await supabase
    .from("service_packages")
    .select("discount_type, discount_value")
    .eq("id", packageId)
    .single();

  if (pkgError) throw pkgError;

  let discountAmount = 0;
  if (pkg?.discount_type && pkg?.discount_value) {
    if (pkg.discount_type === "percentage") {
      discountAmount = (basePrice * Number(pkg.discount_value)) / 100;
    } else if (pkg.discount_type === "fixed") {
      discountAmount = Number(pkg.discount_value);
    }
  }

  const finalPrice = Math.max(0, basePrice - discountAmount);

  return {
    basePrice,
    discountAmount,
    finalPrice,
    serviceCount: services.length,
  };
}

/**
 * Get package composition with full service details
 */
export async function getPackageComposition(
  packageId: string,
  providerId: string | bigint
): Promise<PackageComposition> {
  type PackageServiceWithProvider = {
    provider_service_id: string;
    sequence_order: number;
    is_optional: boolean;
    provider_services: Service | Service[] | null;
  };

  // Fetch package
  const { data: pkg, error: pkgError } = await supabase
    .from("service_packages")
    .select("*")
    .eq("id", packageId)
    .single();

  if (pkgError) throw new Error(`Package not found: ${pkgError.message}`);

  // Fetch package services with provider data
  const { data: packageServices, error: psError } = await supabase
    .from("package_services")
    .select(
      `
      id,
      provider_service_id,
      sequence_order,
      is_optional,
      provider_services!inner(
        id,
        provider_id,
        service_type,
        base_price,
        surge_price,
        service_duration_minutes,
        category_id,
        icon_url,
        short_description,
        is_active
      )
    `
    )
    .eq("package_id", packageId)
    .eq("provider_services.provider_id", providerId)
    .order("sequence_order", { ascending: true });

  if (psError) throw new Error(`Package composition error: ${psError.message}`);

  if (!packageServices || packageServices.length === 0) {
    throw new Error("Package has no services");
  }

  // Calculate totals
  let totalBasePrice = 0;
  const services = (packageServices as unknown as PackageServiceWithProvider[]).map((ps) => {
    const service = (Array.isArray(ps.provider_services) ? ps.provider_services[0] : ps.provider_services) as Service;
    totalBasePrice += Number(service.base_price) || 0;
    return {
      service,
      sequence_order: ps.sequence_order,
      is_optional: ps.is_optional,
    };
  });

  // Apply discount
  let totalWithDiscount = totalBasePrice;
  if (pkg?.discount_type && pkg?.discount_value) {
    if (pkg.discount_type === "percentage") {
      const discountAmount = (totalBasePrice * Number(pkg.discount_value)) / 100;
      totalWithDiscount = totalBasePrice - discountAmount;
    } else if (pkg.discount_type === "fixed") {
      totalWithDiscount = totalBasePrice - Number(pkg.discount_value);
    }
  }

  totalWithDiscount = Math.max(0, totalWithDiscount);

  return {
    package: pkg as ServicePackage,
    services,
    totalBasePrice,
    totalWithDiscount,
  };
}

// ============================================================================
// SERVICE CATALOG FETCHING
// ============================================================================

/**
 * Get all active categories
 */
export async function getActiveCategories() {
  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Get services by category and provider
 */
export async function getServicesByCategory(
  categoryId: string,
  providerId: string | bigint
) {
  const { data, error } = await supabase
    .from("provider_services")
    .select("*")
    .eq("category_id", categoryId)
    .eq("provider_id", providerId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data as Service[];
}

/**
 * Get all active packages
 */
export async function getActivePackages() {
  const { data, error } = await supabase
    .from("service_packages")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data as ServicePackage[];
}

/**
 * Get service add-ons for a service
 */
export async function getServiceAddOns(serviceId: string) {
  const { data, error } = await supabase
    .from("service_addons")
    .select("*")
    .eq("provider_service_id", serviceId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data as ServiceAddon[];
}

// ============================================================================
// PACKAGE SERVICE MANAGEMENT (ADMIN)
// ============================================================================

/**
 * Add service to package
 */
export async function addServiceToPackage(
  packageId: string,
  serviceId: string,
  sequenceOrder: number,
  isOptional: boolean = false
) {
  const { data, error } = await supabase
    .from("package_services")
    .insert({
      package_id: packageId,
      provider_service_id: serviceId,
      sequence_order: sequenceOrder,
      is_optional: isOptional,
    })
    .select()
    .single();

  if (error) throw error;
  return data as PackageService;
}

/**
 * Remove service from package
 */
export async function removeServiceFromPackage(
  packageServiceId: string
) {
  const { error } = await supabase
    .from("package_services")
    .delete()
    .eq("id", packageServiceId);

  if (error) throw error;
}

/**
 * Reorder services in package
 */
export async function reorderPackageServices(
  packageId: string,
  serviceOrdering: Array<{ id: string; sequence_order: number }>
) {
  const updates = serviceOrdering.map((item) =>
    supabase
      .from("package_services")
      .update({ sequence_order: item.sequence_order })
      .eq("id", item.id)
  );

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error);

  if (errors.length > 0) {
    throw new Error(`Failed to reorder services: ${errors[0].error?.message}`);
  }
}

// ============================================================================
// BOOKING PRICE CALCULATION
// ============================================================================

export type { BookingPriceParameters };

export async function calculateBookingPrice(params: BookingPriceParameters) {
  return calculateBookingPriceFromEngine(params);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate service exists and is active
 */
export async function validateService(serviceId: string, providerId: string | bigint) {
  const { data, error } = await supabase
    .from("provider_services")
    .select("id, is_active")
    .eq("id", serviceId)
    .eq("provider_id", providerId)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Service not found");
  if (!data.is_active) throw new Error("Service is not active");

  return true;
}

/**
 * Validate package exists and is active
 */
export async function validatePackage(packageId: string) {
  const { data, error } = await supabase
    .from("service_packages")
    .select("id, is_active")
    .eq("id", packageId)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Package not found");
  if (!data.is_active) throw new Error("Package is not active");

  return true;
}
