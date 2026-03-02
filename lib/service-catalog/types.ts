/**
 * Service Catalog System Types
 * Defines all TypeScript interfaces for the service management system including
 * categories, services, packages, add-ons, and media.
 */

// ============================================================================
// SERVICE CATEGORIES
// ============================================================================

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon_url?: string | null;
  banner_image_url?: string | null;
  display_order: number;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ServiceCategoryInput = Pick<
  ServiceCategory,
  | "name"
  | "slug"
  | "description"
  | "icon_url"
  | "banner_image_url"
  | "display_order"
  | "is_featured"
  | "is_active"
>;

// ============================================================================
// SERVICES (PROVIDER_SERVICES EXTENDED)
// ============================================================================

export type ServiceMode = "home_visit" | "clinic_visit" | "teleconsult";

export interface Service {
  id: string;
  provider_id: string | bigint;
  category_id?: string | null;
  service_type: string;
  slug?: string | null;
  short_description?: string | null;
  full_description?: string | null;
  service_mode: ServiceMode;
  icon_url?: string | null;
  banner_image_url?: string | null;
  base_price: number;
  surge_price?: number | null;
  commission_percentage?: number | null;
  service_duration_minutes?: number | null;
  display_order: number;
  is_featured: boolean;
  is_active: boolean;
  requires_pet_details: boolean;
  requires_location: boolean;
  created_at: string;
  updated_at: string;
}

export type ServiceInput = Omit<Service, "id" | "created_at" | "updated_at">;

export type ServiceUpdate = Partial<ServiceInput>;

// ============================================================================
// SERVICE PACKAGES
// ============================================================================

export type DiscountType = "percentage" | "fixed";

export interface ServicePackage {
  id: string;
  category_id?: string | null;
  name: string;
  slug: string;
  short_description?: string | null;
  full_description?: string | null;
  banner_image_url?: string | null;
  icon_url?: string | null;
  discount_type?: DiscountType | null;
  discount_value?: number | null;
  display_order: number;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ServicePackageInput = Omit<
  ServicePackage,
  "id" | "created_at" | "updated_at"
>;

export interface PackageService {
  id: string;
  package_id: string;
  provider_service_id: string;
  sequence_order: number;
  is_optional: boolean;
  created_at: string;
}

export type PackageServiceInput = Omit<PackageService, "id" | "created_at">;

/**
 * Package composition with full service details
 * Used for displaying package contents and calculating prices
 */
export interface PackageComposition {
  package: ServicePackage;
  services: Array<{
    service: Service;
    sequence_order: number;
    is_optional: boolean;
  }>;
  totalBasePrice: number; // sum of base_price for all services
  totalWithDiscount: number; // after applying package discount
}

// ============================================================================
// SERVICE ADD-ONS
// ============================================================================

export interface ServiceAddon {
  id: string;
  provider_service_id: string;
  name: string;
  description?: string | null;
  price: number;
  duration_minutes?: number | null;
  icon_url?: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ServiceAddonInput = Omit<
  ServiceAddon,
  "id" | "created_at" | "updated_at"
>;

// ============================================================================
// BOOKING EXTENSIONS
// ============================================================================

/**
 * Extended booking with package and pricing details
 * When booking_type = 'service', use service pricing from provider_services.
 * When booking_type = 'package', use dynamic pricing from package composition.
 */
export interface BookingWithPackaging {
  // Existing booking fields
  id: string;
  provider_id: string | bigint;
  user_id: string;
  service_id?: string | null;
  booking_type: "service" | "package";
  status: string;
  booking_date: string;
  booking_time: string;

  // New package fields
  package_id?: string | null;
  discount_amount?: number | null;
  final_price?: number | null;

  // Legacy pricing (kept for backward compatibility)
  price?: number | null;
  surge_price?: number | null;
  discount?: number | null;

  created_at: string;
  updated_at: string;
}

export type BookingPricingInput = {
  booking_type: "service" | "package";
  service_id?: string;
  package_id?: string;
  base_price?: number;
  surge_price?: number;
  discount_amount?: number;
  final_price?: number;
};

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// ADMIN DASHBOARD CONTEXTS
// ============================================================================

/**
 * Admin service management context
 * Provides data for admin dashboard service/category/package/addon management
 */
export interface AdminServiceContext {
  categories: ServiceCategory[];
  services: Service[];
  packages: ServicePackage[];
  selectedCategory?: ServiceCategory | null;
  selectedService?: Service | null;
  selectedPackage?: ServicePackage | null;
}

/**
 * Service moderation queue for admin operations
 */
export interface ServiceModerationItem {
  id: string;
  type: "service" | "category" | "package" | "addon";
  status: "pending_approval" | "approved" | "rejected";
  created_at: string;
  submitted_by: string;
  data: ServiceCategory | Service | ServicePackage | ServiceAddon;
}
