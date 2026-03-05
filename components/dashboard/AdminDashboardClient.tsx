'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useToast } from '@/components/ui/ToastProvider';
import { bookingTimelineLabel } from '@/lib/bookings/timeline';
import type {
  AdminProviderModerationItem,
  AdminServiceModerationSummaryItem,
  PlatformDiscount,
  PlatformDiscountAnalyticsSummary,
} from '@/lib/provider-management/types';
import type { ServiceCategory, ServicePackage, Service } from '@/lib/service-catalog/types';
import ServiceCategoriesManager from './admin/ServiceCategoriesManager';
import ServiceBuilder from './admin/ServiceBuilder';
import PackageBuilder from './admin/PackageBuilder';
import ProviderOnboardingModal from './admin/ProviderOnboardingModal';
import ImageUploadField from '@/components/ui/ImageUploadField';
import StorageBackedImage from '@/components/ui/StorageBackedImage';
import { useAdminBookingRealtime, useAdminProviderApprovalRealtime, useOptimisticUpdate } from '@/lib/hooks/useRealtime';

// Premium Components
import DashboardPageLayout from './premium/DashboardPageLayout';
import StatCard from './premium/StatCard';
import StatusBadge from './premium/StatusBadge';

// UI Components
import { Button, Input, Card, Alert, Badge } from '@/components/ui';
import { cn } from '@/lib/design-system';

type AdminBooking = {
  id: number;
  user_id?: string;
  provider_id: number;
  booking_start: string;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_mode?: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  provider_name?: string | null;
  completion_task_status?: 'pending' | 'completed' | null;
  completion_due_at?: string | null;
  completion_completed_at?: string | null;
};

type Provider = {
  id: number;
  name: string;
};

type AdminProviderCalendarResponse = {
  provider: {
    id: number;
    name: string;
  };
  fromDate: string;
  toDate: string;
  days: Array<{
    date: string;
    day_of_week: number;
    availability: Array<{
      id: string;
      start_time: string;
      end_time: string;
      is_available: boolean;
    }>;
    bookings: Array<{
      id: number;
      start_time: string | null;
      end_time: string | null;
      status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
      booking_mode: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
      service_type: string | null;
      completion_task_status: 'pending' | 'completed' | null;
    }>;
  }>;
};

type AdminProviderAvailability = {
  id: string;
  provider_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  slot_duration_minutes?: number;
  buffer_time_minutes?: number;
};

type AdminProviderService = {
  id: string;
  provider_id: number;
  service_type: string;
  base_price: number;
  surge_price: number | null;
  commission_percentage: number | null;
  service_duration_minutes: number | null;
  is_active: boolean;
};

type AdminServicePincode = {
  provider_service_id: string;
  pincode: string;
  is_enabled: boolean;
};

type ServiceRolloutDraft = {
  id?: string;
  service_pincodes: string;
};

type GlobalServiceRolloutDraft = {
  service_type: string;
  base_price: string;
  surge_price: string;
  commission_percentage: string;
  service_duration_minutes: string;
  is_active: boolean;
  service_pincodes: string;
  provider_ids: string;
  overwrite_existing: boolean;
};

type DiscountDraft = {
  id?: string;
  code: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'flat';
  discount_value: string;
  max_discount_amount: string;
  min_booking_amount: string;
  applies_to_service_type: string;
  valid_from: string;
  valid_until: string;
  usage_limit_total: string;
  usage_limit_per_user: string;
  first_booking_only: boolean;
  is_active: boolean;
};

type LocationDraft = {
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
  service_radius_km: string;
};

type ProviderProfileDraft = {
  name: string;
  email: string;
  provider_type: string;
  business_name: string;
  profile_photo_url: string;
  service_radius_km: string;
};

type AdminDashboardView = 'overview' | 'bookings' | 'users' | 'providers' | 'services' | 'access' | 'health';

type AdminUserSearchPet = {
  id: string;
  name: string;
  breed: string | null;
  age: number | null;
  gender: string | null;
  color: string | null;
  size_category: string | null;
  energy_level: string | null;
  created_at: string;
};

type AdminUserSearchResult = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  age: number | null;
  gender: string | null;
  photo_url: string | null;
  created_at: string;
  role: string | null;
  profile_type: 'admin' | 'staff' | 'provider' | 'customer';
  pets: AdminUserSearchPet[];
};

type SchemaSyncCheck = {
  key: string;
  ok: boolean;
  expected: boolean;
  actual: boolean;
};

type SchemaSyncHealthResponse = {
  healthy: boolean;
  domain: 'schema-contract';
  checks: SchemaSyncCheck[];
  failed_checks: SchemaSyncCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  generated_at: string;
  error?: string;
};

type FunctionalHealthCheck = {
  key: string;
  label: string;
  endpoint: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  durationMs: number | null;
  lastRunAt: string | null;
  error: string | null;
};

type SchemaFixGuide = {
  migration: string;
  note: string;
};

const SCHEMA_FIX_GUIDES: Record<string, SchemaFixGuide> = {
  'users.address.nullable': {
    migration: '037_users_profile_requirements_by_role.sql',
    note: 'Users profile fields must be nullable at column level and enforced by role-aware trigger.',
  },
  'users.age.nullable': {
    migration: '037_users_profile_requirements_by_role.sql',
    note: 'Users profile fields must be nullable at column level and enforced by role-aware trigger.',
  },
  'users.gender.nullable': {
    migration: '037_users_profile_requirements_by_role.sql',
    note: 'Users profile fields must be nullable at column level and enforced by role-aware trigger.',
  },
  'users.role_profile.trigger.exists': {
    migration: '037_users_profile_requirements_by_role.sql',
    note: 'Create role-aware trigger to enforce profile completeness only for role=user.',
  },
  'users.role_profile.trigger.enabled': {
    migration: '037_users_profile_requirements_by_role.sql',
    note: 'Ensure role-aware users trigger is enabled.',
  },
  'users.role_profile.function.exists': {
    migration: '037_users_profile_requirements_by_role.sql',
    note: 'Function backing role-aware users profile enforcement is missing.',
  },
  'providers.provider_type.is_text': {
    migration: '017_allow_custom_provider_types.sql',
    note: 'Provider type must be text to support custom provider categories.',
  },
  'admin.idempotency.table.exists': {
    migration: '039_admin_idempotency_keys.sql',
    note: 'Create idempotency storage for safe retry of admin onboarding requests.',
  },
};

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

function weekdayLabel(dayOfWeek: number) {
  return WEEKDAY_OPTIONS.find((option) => option.value === dayOfWeek)?.label ?? `Day ${dayOfWeek}`;
}

function getDefaultAvailabilityDraft() {
  return {
    selected_days: [1],
    start_time: '09:00',
    end_time: '17:00',
  };
}

function formatSchemaHealthTimestamp(value: string | null) {
  if (!value) {
    return 'Not run yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function groupAvailabilityByProvider(rows: AdminProviderAvailability[]) {
  return rows.reduce<Record<number, AdminProviderAvailability[]>>((accumulator, row) => {
    const current = accumulator[row.provider_id] ?? [];
    current.push(row);
    accumulator[row.provider_id] = current;
    return accumulator;
  }, {});
}

function groupServicesByProvider(rows: AdminProviderService[]) {
  return rows.reduce<Record<number, AdminProviderService[]>>((accumulator, row) => {
    const current = accumulator[row.provider_id] ?? [];
    current.push(row);
    accumulator[row.provider_id] = current;
    return accumulator;
  }, {});
}

function groupPincodesByService(rows: AdminServicePincode[]) {
  return rows.reduce<Record<string, string[]>>((accumulator, row) => {
    if (!row.is_enabled) {
      return accumulator;
    }

    const current = accumulator[row.provider_service_id] ?? [];
    current.push(row.pincode);
    accumulator[row.provider_service_id] = current;
    return accumulator;
  }, {});
}

function locationWarningSuggestion(warning: string) {
  const normalized = warning.toLowerCase();

  if (normalized.includes('pincode and service radius are both missing') || normalized.includes('pincode and service radius are missing')) {
    return 'Add clinic pincode first, then set a realistic service radius baseline.';
  }

  if (normalized.includes('radius is 0 km')) {
    return 'Either increase service radius above 0 km or keep rollout limited to clinic pincode.';
  }

  if (normalized.includes('very small for the current pincode rollout footprint')) {
    return 'Increase service radius or trim non-clinic rollout pincodes.';
  }

  if (normalized.includes('without a service radius baseline')) {
    return 'Set service radius to align with current pincode coverage area.';
  }

  return 'Review location fields and align service radius with rollout pincodes.';
}

function locationWarningActionLabel(warning: string) {
  const normalized = warning.toLowerCase();

  if (normalized.includes('radius is 0 km') || normalized.includes('very small for the current pincode rollout footprint')) {
    return 'Apply safer radius';
  }

  if (normalized.includes('without a service radius baseline') || normalized.includes('pincode and service radius are')) {
    return 'Set baseline values';
  }

  return 'Auto-fix draft';
}

const adminRawFieldClass =
  'rounded-xl border border-neutral-200/60 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-1';

const adminToggleFieldClass =
  'inline-flex items-center gap-2 rounded-xl border border-neutral-200/60 px-3 py-2 text-xs';

function buildLocalCoverageWarnings(provider: AdminProviderModerationItem, coveragePincodes: string[]) {
  const localCoverageWarnings: string[] = [];

  if (coveragePincodes.length > 0) {
    const clinicPincode = provider.pincode?.trim() ?? null;
    const serviceRadius = provider.service_radius_km;
    const nonClinicCoverageCount = clinicPincode
      ? coveragePincodes.filter((item) => item !== clinicPincode).length
      : coveragePincodes.length;

    if (!clinicPincode && serviceRadius === null) {
      localCoverageWarnings.push('Service pincodes are configured, but clinic pincode and service radius are missing.');
    }

    if (clinicPincode && serviceRadius !== null && serviceRadius <= 0 && nonClinicCoverageCount > 0) {
      localCoverageWarnings.push('Service radius is 0 km, but enabled service pincodes extend beyond clinic pincode.');
    }

    if (serviceRadius !== null && serviceRadius <= 2 && nonClinicCoverageCount >= 3) {
      localCoverageWarnings.push('Service radius is very small for the current pincode rollout footprint.');
    }

    if (serviceRadius === null && coveragePincodes.length >= 10) {
      localCoverageWarnings.push('Large pincode rollout is configured without a service radius baseline.');
    }
  }

  return localCoverageWarnings;
}

function applyLocationWarningToDraft(draft: LocationDraft, warningText: string, coveragePincodes: string[]) {
  const normalized = warningText.toLowerCase();
  const next = { ...draft };
  const firstCoveragePincode = coveragePincodes[0] ?? '';

  if (normalized.includes('pincode and service radius are both missing') || normalized.includes('pincode and service radius are missing')) {
    if (!next.pincode.trim() && firstCoveragePincode) {
      next.pincode = firstCoveragePincode;
    }

    if (!next.service_radius_km.trim()) {
      next.service_radius_km = '3';
    }
  }

  if (normalized.includes('radius is 0 km')) {
    next.service_radius_km = '3';
  }

  if (normalized.includes('very small for the current pincode rollout footprint')) {
    const currentRadius = next.service_radius_km.trim() ? Number(next.service_radius_km) : 0;
    next.service_radius_km = String(Number.isFinite(currentRadius) ? Math.max(currentRadius, 5) : 5);
  }

  if (normalized.includes('without a service radius baseline')) {
    if (!next.service_radius_km.trim()) {
      next.service_radius_km = '5';
    }
  }

  return next;
}

function buildLocationChangeSummary(before: LocationDraft, after: LocationDraft) {
  const trackedFields: Array<keyof LocationDraft> = [
    'address',
    'city',
    'state',
    'pincode',
    'latitude',
    'longitude',
    'service_radius_km',
  ];
  const changedFields = trackedFields.filter((field) => before[field] !== after[field]);

  let summary = changedFields
    .slice(0, 3)
    .map((field) => `${field}: "${before[field] || '—'}" → "${after[field] || '—'}"`)
    .join(' | ');

  if (changedFields.length > 3) {
    summary = `${summary} | +${changedFields.length - 3} more`;
  }

  return summary;
}

function getUserProfileBadge(profileType: AdminUserSearchResult['profile_type']) {
  switch (profileType) {
    case 'admin':
      return {
        label: 'Admin',
        className: 'border-violet-200 bg-violet-50 text-violet-700',
      };
    case 'staff':
      return {
        label: 'Staff',
        className: 'border-blue-200 bg-blue-50 text-blue-700',
      };
    case 'provider':
      return {
        label: 'Provider',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    default:
      return {
        label: 'Customer',
        className: 'border-neutral-200 bg-neutral-100 text-neutral-700',
      };
  }
}

export default function AdminDashboardClient({
  canManageUserAccess = true,
  view = 'overview',
  initialBookings,
  providers,
  moderationProviders,
  initialAvailability,
  initialServices,
  initialServicePincodes,
  initialServiceSummary,
  initialDiscounts,
  initialDiscountAnalytics,
  initialServiceCategories = [],
  initialServicePackages = [],
  initialCatalogServices = [],
}: {
  canManageUserAccess?: boolean;
  view?: AdminDashboardView;
  initialBookings: AdminBooking[];
  providers: Provider[];
  moderationProviders: AdminProviderModerationItem[];
  initialAvailability: AdminProviderAvailability[];
  initialServices: AdminProviderService[];
  initialServicePincodes: AdminServicePincode[];
  initialServiceSummary: AdminServiceModerationSummaryItem[];
  initialDiscounts: PlatformDiscount[];
  initialDiscountAnalytics: PlatformDiscountAnalyticsSummary;
  initialServiceCategories?: ServiceCategory[];
  initialServicePackages?: ServicePackage[];
  initialCatalogServices?: Service[];
}) {
  const providerFallbackRows: AdminProviderModerationItem[] = providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    email: null,
    profile_photo_url: null,
    provider_type: 'clinic',
    business_name: provider.name,
    admin_approval_status: 'pending',
    verification_status: 'pending',
    account_status: 'active',
    average_rating: 0,
    total_bookings: 0,
    address: null,
    city: null,
    state: null,
    pincode: null,
    latitude: null,
    longitude: null,
    service_radius_km: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    documentCounts: {
      pending: 0,
      approved: 0,
      rejected: 0,
    },
  }));

  const [bookings, setBookings] = useState(initialBookings);
  const [providerRows, setProviderRows] = useState(
    moderationProviders.length > 0 ? moderationProviders : providerFallbackRows,
  );
  const [deletingProviderId, setDeletingProviderId] = useState<number | null>(null);
  const { performUpdate: performBookingUpdate } = useOptimisticUpdate(bookings, setBookings);
  const { performUpdate: performProviderUpdate } = useOptimisticUpdate(providerRows, setProviderRows);
  const [availabilityByProvider, setAvailabilityByProvider] = useState<Record<number, AdminProviderAvailability[]>>(
    () => groupAvailabilityByProvider(initialAvailability),
  );
  const [servicesByProvider, setServicesByProvider] = useState<Record<number, AdminProviderService[]>>(() =>
    groupServicesByProvider(initialServices),
  );
  const [pincodesByService, setPincodesByService] = useState<Record<string, string[]>>(() =>
    groupPincodesByService(initialServicePincodes),
  );
  const [expandedProviderIds, setExpandedProviderIds] = useState<number[]>([]);
  const [providerDetailsLoadingById, setProviderDetailsLoadingById] = useState<Record<number, boolean>>({});
  const [providerDetailsLoadedById, setProviderDetailsLoadedById] = useState<Record<number, boolean>>(() => {
    const preloadedServiceProviderIds = new Set(initialServices.map((row) => row.provider_id));
    const preloadedAvailabilityProviderIds = new Set(initialAvailability.map((row) => row.provider_id));
    const merged = new Set<number>([...preloadedServiceProviderIds, ...preloadedAvailabilityProviderIds]);

    return Array.from(merged).reduce<Record<number, boolean>>((accumulator, providerId) => {
      accumulator[providerId] = true;
      return accumulator;
    }, {});
  });
  const [bookingFilter, setBookingFilter] = useState<'all' | 'sla' | 'high-risk'>('all');
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [bookingSearchDebounced, setBookingSearchDebounced] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchDebounced, setUserSearchDebounced] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<AdminUserSearchResult[]>([]);
  const [isUserSearchLoading, setIsUserSearchLoading] = useState(false);
  const [calendarProviderId, setCalendarProviderId] = useState<number | ''>('');
  const [calendarFromDate, setCalendarFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [calendarDays, setCalendarDays] = useState<7 | 14>(7);
  const [providerCalendar, setProviderCalendar] = useState<AdminProviderCalendarResponse | null>(null);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [selectedBookingIds, setSelectedBookingIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<'confirmed' | 'completed' | 'cancelled' | 'no_show'>('confirmed');
  const [promoteEmail, setPromoteEmail] = useState('');
  const [serviceDraft, setServiceDraft] = useState<Record<number, ServiceRolloutDraft>>({});
  const [selectedServiceTypesByProvider, setSelectedServiceTypesByProvider] = useState<Record<number, string[]>>({});
  const [serviceSummary, setServiceSummary] = useState(initialServiceSummary);
  const [globalServiceDraft, setGlobalServiceDraft] = useState<GlobalServiceRolloutDraft>({
    service_type: '',
    base_price: '0',
    surge_price: '',
    commission_percentage: '',
    service_duration_minutes: '60',
    is_active: true,
    service_pincodes: '',
    provider_ids: '',
    overwrite_existing: false,
  });
  const [discounts, setDiscounts] = useState<PlatformDiscount[]>(initialDiscounts);
  const [discountAnalytics, setDiscountAnalytics] = useState<PlatformDiscountAnalyticsSummary>(initialDiscountAnalytics);
  const [locationDraft, setLocationDraft] = useState<Record<number, LocationDraft>>({});
  const [providerProfileDraft, setProviderProfileDraft] = useState<Record<number, ProviderProfileDraft>>({});
  const [locationCoverageWarnings, setLocationCoverageWarnings] = useState<Record<number, string[]>>({});
  const [locationLastAutoFixNote, setLocationLastAutoFixNote] = useState<Record<number, string>>({});
  const [discountDraft, setDiscountDraft] = useState<DiscountDraft>({
    code: '',
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    max_discount_amount: '',
    min_booking_amount: '',
    applies_to_service_type: '',
    valid_from: new Date().toISOString().slice(0, 16),
    valid_until: '',
    usage_limit_total: '',
    usage_limit_per_user: '',
    first_booking_only: false,
    is_active: true,
  });
  const [availabilityDraft, setAvailabilityDraft] = useState<Record<number, { selected_days: number[]; start_time: string; end_time: string }>>({});
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [providerTypeFilter, setProviderTypeFilter] = useState<'all' | 'clinic' | 'home_visit'>('all');
  const [providerStatusFilter, setProviderStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'suspended'>('all');
  const [schemaSyncHealth, setSchemaSyncHealth] = useState<SchemaSyncHealthResponse | null>(null);
  const [schemaSyncDurationMs, setSchemaSyncDurationMs] = useState<number | null>(null);
  const [isSchemaSyncChecking, setIsSchemaSyncChecking] = useState(false);
  const [hasAutoRunSchemaHealth, setHasAutoRunSchemaHealth] = useState(false);
  const [functionalHealthChecks, setFunctionalHealthChecks] = useState<FunctionalHealthCheck[]>([
    {
      key: 'admin.providers.read',
      label: 'Providers API',
      endpoint: '/api/admin/providers',
      status: 'unknown',
      durationMs: null,
      lastRunAt: null,
      error: null,
    },
    {
      key: 'admin.bookings.read',
      label: 'Bookings API',
      endpoint: '/api/admin/bookings',
      status: 'unknown',
      durationMs: null,
      lastRunAt: null,
      error: null,
    },
    {
      key: 'admin.services.read',
      label: 'Services API',
      endpoint: '/api/admin/services',
      status: 'unknown',
      durationMs: null,
      lastRunAt: null,
      error: null,
    },
  ]);
  const [isFunctionalHealthChecking, setIsFunctionalHealthChecking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const providerCardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const availableServiceTypes = useMemo(() => {
    const catalogServiceTypes = initialCatalogServices
      .map((service) => service.service_type)
      .filter((value) => value?.trim());
    const summaryServiceTypes = serviceSummary
      .map((service) => service.service_type)
      .filter((value) => value?.trim());

    return Array.from(new Set([...catalogServiceTypes, ...summaryServiceTypes])).sort();
  }, [initialCatalogServices, serviceSummary]);
  const defaultServiceType = availableServiceTypes[0] ?? 'grooming_session';

  // Realtime subscriptions for bookings and provider approvals
  const refreshBookings = useCallback(async (searchQuery?: string) => {
    try {
      const params = new URLSearchParams();
      const normalizedSearch = (searchQuery ?? '').trim();

      if (normalizedSearch) {
        params.set('q', normalizedSearch);
      }

      params.set('limit', '300');

      const response = await fetch(`/api/admin/bookings?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings ?? []);
      }
    } catch (error) {
      console.error('Failed to refresh bookings:', error);
    }
  }, []);

  const refreshProviders = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/providers');
      if (response.ok) {
        const data = await response.json();
        setProviderRows(data.providers ?? []);
      }
    } catch (error) {
      console.error('Failed to refresh providers:', error);
    }
  }, []);

  useAdminBookingRealtime(refreshBookings);
  useAdminProviderApprovalRealtime(refreshProviders);

  const visibleBookings = useMemo(() => {
    const normalizedSearch = bookingSearchDebounced.trim().toLowerCase();

    let filtered = bookings;

    if (normalizedSearch) {
      filtered = filtered.filter((booking) => {
        const status = (booking.booking_status ?? booking.status ?? '').replace('_', ' ');
        return [
          booking.id.toString(),
          booking.user_id ?? '',
          booking.provider_id.toString(),
          booking.customer_name ?? '',
          booking.customer_email ?? '',
          booking.customer_phone ?? '',
          booking.provider_name ?? '',
          booking.service_type ?? '',
          status,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      });
    }

    if (bookingFilter === 'all') {
      return filtered;
    }

    if (bookingFilter === 'sla') {
      return filtered.filter((booking) => (booking.booking_status ?? booking.status) === 'pending');
    }

    return filtered.filter((booking) => {
      const status = booking.booking_status ?? booking.status;
      return status === 'no_show' || status === 'cancelled';
    });
  }, [bookings, bookingFilter, bookingSearchDebounced]);

  const bookingRiskSummary = useMemo(() => {
    return {
      inProgress: bookings.filter((booking) => {
        const status = booking.booking_status ?? booking.status;
        return status === 'pending' || status === 'confirmed';
      }).length,
      completed: bookings.filter((booking) => (booking.booking_status ?? booking.status) === 'completed').length,
      pending: bookings.filter((booking) => (booking.booking_status ?? booking.status) === 'pending').length,
      noShow: bookings.filter((booking) => (booking.booking_status ?? booking.status) === 'no_show').length,
      cancelled: bookings.filter((booking) => (booking.booking_status ?? booking.status) === 'cancelled').length,
    };
  }, [bookings]);

  const totalCustomers = useMemo(() => {
    const customerKeys = new Set<string>();

    for (const booking of bookings) {
      const stableKey = booking.user_id ?? booking.customer_email ?? booking.customer_phone;

      if (stableKey) {
        customerKeys.add(stableKey.toLowerCase());
      }
    }

    return customerKeys.size;
  }, [bookings]);

  const isOverviewView = view === 'overview';
  const isBookingsView = view === 'bookings';
  const isUsersView = view === 'users';
  const isAccessView = view === 'access';
  const isProvidersView = view === 'providers';
  const isServicesView = view === 'services';
  const isHealthView = view === 'health';

  const hasFunctionalRuns = functionalHealthChecks.some((check) => check.status !== 'unknown');
  const functionalHealthIsHealthy = hasFunctionalRuns && functionalHealthChecks.every((check) => check.status === 'healthy');

  const schemaHealthBadgeLabel = schemaSyncHealth?.healthy
    ? 'Schema Healthy'
    : schemaSyncHealth
    ? 'Schema Unhealthy'
    : 'Schema Not Checked';
  const schemaHealthBadgeClass = schemaSyncHealth?.healthy
    ? 'border-green-300 bg-green-100 text-green-700'
    : schemaSyncHealth
    ? 'border-red-300 bg-red-100 text-red-700'
    : 'border-neutral-300 bg-neutral-100 text-neutral-700';

  const functionalHealthBadgeLabel = hasFunctionalRuns
    ? functionalHealthIsHealthy
      ? 'Functions Healthy'
      : 'Functions Unhealthy'
    : 'Functions Not Checked';
  const functionalHealthBadgeClass = hasFunctionalRuns
    ? functionalHealthIsHealthy
      ? 'border-green-300 bg-green-100 text-green-700'
      : 'border-red-300 bg-red-100 text-red-700'
    : 'border-neutral-300 bg-neutral-100 text-neutral-700';

  // Filter providers based on search and filters
  const filteredProviders = useMemo(() => {
    return providerRows.filter((provider) => {
      // Search filter
      if (providerSearchQuery.trim()) {
        const query = providerSearchQuery.toLowerCase();
        const matchesSearch =
          provider.name.toLowerCase().includes(query) ||
          (provider.email?.toLowerCase() || '').includes(query) ||
          (provider.business_name?.toLowerCase() || '').includes(query) ||
          provider.id.toString().includes(query) ||
          (provider.city?.toLowerCase() || '').includes(query);
        
        if (!matchesSearch) return false;
      }

      // Type filter
      if (providerTypeFilter !== 'all') {
        if (providerTypeFilter === 'clinic' && provider.provider_type !== 'clinic') return false;
        if (providerTypeFilter === 'home_visit' && provider.provider_type === 'clinic') return false;
      }

      // Status filter
      if (providerStatusFilter !== 'all') {
        if (providerStatusFilter === 'pending' && provider.admin_approval_status !== 'pending') return false;
        if (providerStatusFilter === 'approved' && provider.admin_approval_status !== 'approved') return false;
        if (providerStatusFilter === 'rejected' && provider.admin_approval_status !== 'rejected') return false;
        if (providerStatusFilter === 'suspended' && provider.account_status !== 'suspended') return false;
      }

      return true;
    });
  }, [providerRows, providerSearchQuery, providerTypeFilter, providerStatusFilter]);

  const calendarSelectableProviders = filteredProviders.length > 0 ? filteredProviders : providerRows;
  const selectedCalendarProviderName = calendarProviderId
    ? calendarSelectableProviders.find((provider) => provider.id === calendarProviderId)?.name ?? `Provider #${calendarProviderId}`
    : null;
  const isCalendarStale = Boolean(
    calendarProviderId && providerCalendar && providerCalendar.provider.id !== calendarProviderId,
  );
  const calendarSkeletonCardCount = calendarDays === 14 ? 8 : 4;

  async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? 'Request failed');
    }

    return payload as T;
  }

  const fetchProviderCalendar = useCallback(async () => {
    if (!calendarProviderId) {
      setProviderCalendar(null);
      return;
    }

    setIsCalendarLoading(true);

    try {
      const params = new URLSearchParams();
      params.set('providerId', String(calendarProviderId));
      params.set('fromDate', calendarFromDate);
      params.set('days', String(calendarDays));

      const request = await fetch(`/api/admin/providers/calendar?${params.toString()}`);
      const payload = (await request.json().catch(() => null)) as
        | AdminProviderCalendarResponse
        | { error?: string }
        | null;

      if (!request.ok) {
        throw new Error((payload as { error?: string } | null)?.error ?? 'Unable to load provider calendar.');
      }

      const response = payload as AdminProviderCalendarResponse;
      setProviderCalendar(response);
    } catch (error) {
      setProviderCalendar(null);
      showToast(error instanceof Error ? error.message : 'Unable to load provider calendar.', 'error');
    } finally {
      setIsCalendarLoading(false);
    }
  }, [calendarDays, calendarFromDate, calendarProviderId, showToast]);

  const fetchAdminUsers = useCallback(async () => {
    if (!isUsersView) {
      return;
    }

    if (!userSearchDebounced) {
      setUserSearchResults([]);
      setIsUserSearchLoading(false);
      return;
    }

    setIsUserSearchLoading(true);

    try {
      const params = new URLSearchParams();
      if (userSearchDebounced) {
        params.set('q', userSearchDebounced);
      }
      params.set('limit', '25');

      const response = await fetch(`/api/admin/users/search?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | { users?: AdminUserSearchResult[]; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to load users.');
      }

      setUserSearchResults(payload?.users ?? []);
    } catch (error) {
      setUserSearchResults([]);
      showToast(error instanceof Error ? error.message : 'Unable to load users.', 'error');
    } finally {
      setIsUserSearchLoading(false);
    }
  }, [isUsersView, showToast, userSearchDebounced]);

  useEffect(() => {
    if (!isProvidersView) {
      return;
    }

    if (calendarProviderId) {
      const stillVisible = calendarSelectableProviders.some((provider) => provider.id === calendarProviderId);

      if (!stillVisible) {
        setCalendarProviderId('');
        setProviderCalendar(null);
      }

      return;
    }

    if (providerSearchQuery.trim() && calendarSelectableProviders.length === 1) {
      setCalendarProviderId(calendarSelectableProviders[0].id);
      return;
    }

    if (!providerSearchQuery.trim() && !calendarProviderId) {
      setProviderCalendar(null);
    }
  }, [
    isProvidersView,
    calendarProviderId,
    calendarSelectableProviders,
    providerSearchQuery,
  ]);

  useEffect(() => {
    if (!isProvidersView || !calendarProviderId) {
      return;
    }

    void fetchProviderCalendar();
  }, [isProvidersView, calendarProviderId, calendarFromDate, calendarDays, fetchProviderCalendar]);

  function overrideStatus(bookingId: number, status: AdminBooking['status']) {
    performBookingUpdate(
      (current) => current.map((booking) => (booking.id === bookingId ? { ...booking, status } : booking)),
      async () => {
        const response = await fetch(`/api/bookings/${bookingId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          throw new Error('Override failed');
        }
      },
      () => showToast('Status overridden.', 'success'),
      () => showToast('Override failed.', 'error'),
    );
  }

  function toggleBookingSelection(bookingId: number) {
    setSelectedBookingIds((current) =>
      current.includes(bookingId) ? current.filter((id) => id !== bookingId) : [...current, bookingId],
    );
  }

  function applyBulkStatus() {
    if (selectedBookingIds.length === 0) {
      showToast('Select at least one booking first.', 'error');
      return;
    }

    const previous = bookings;
    setBookings((current) =>
      current.map((booking) =>
        selectedBookingIds.includes(booking.id)
          ? {
              ...booking,
              status: bulkStatus,
            }
          : booking,
      ),
    );

    startTransition(async () => {
      try {
        await adminRequest('/api/admin/bookings/bulk-status', {
          method: 'PATCH',
          body: JSON.stringify({
            bookingIds: selectedBookingIds,
            status: bulkStatus,
          }),
        });
        setSelectedBookingIds([]);
        showToast('Bulk status update applied.', 'success');
      } catch (error) {
        setBookings(previous);
        showToast(error instanceof Error ? error.message : 'Bulk update failed.', 'error');
      }
    });
  }

  function promoteUserToRole(role: 'admin' | 'provider' | 'staff') {
    const normalizedEmail = promoteEmail.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showToast('Enter a valid email address.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        await adminRequest<{ success: true; user: { id: string; email: string | null; role: 'admin' | 'provider' | 'staff' } }>(
          '/api/admin/users/promote',
          {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail, role }),
          },
        );
        setPromoteEmail('');
        showToast(`User promoted to ${role}.`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : `Unable to promote user to ${role}.`, 'error');
      }
    });
  }

  function reassignProvider(bookingId: number, providerId: number) {
    const previous = bookings;
    setBookings((current) =>
      current.map((booking) => (booking.id === bookingId ? { ...booking, provider_id: providerId, status: 'pending' } : booking)),
    );

    startTransition(async () => {
      const response = await fetch(`/api/admin/bookings/${bookingId}/reassign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerId }),
      });

      if (!response.ok) {
        setBookings(previous);
        showToast('Reassign failed.', 'error');
        return;
      }

      showToast('Provider reassigned.', 'success');
    });
  }

  function applyBookingAdjustment(bookingId: number) {
    const reason =
      window.prompt('Optional adjustment note', 'Booking cancelled by admin (direct provider payment model)') ??
      'Booking cancelled by admin (direct provider payment model)';

    startTransition(async () => {
      try {
        await adminRequest<{ success: true; booking: AdminBooking }>(`/api/admin/bookings/${bookingId}/adjustment`, {
          method: 'POST',
          body: JSON.stringify({
            reason,
          }),
        });

        setBookings((current) =>
          current.map((booking) => (booking.id === bookingId ? { ...booking, status: 'cancelled', booking_status: 'cancelled' } : booking)),
        );
        showToast('Booking adjustment applied and status set to cancelled.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to apply booking adjustment.', 'error');
      }
    });
  }

  function moderateProvider(providerId: number, action: 'enable' | 'disable') {
    performProviderUpdate(
      (current) => current.map((row) => {
        if (row.id !== providerId) {
          return row;
        }
        if (action === 'enable') {
          return {
            ...row,
            account_status: 'active',
          };
        }

        return {
          ...row,
          account_status: 'suspended',
        };
      }),
      async () => {
        const routeAction = action === 'disable' ? 'suspend' : 'enable';
        const response = await fetch(`/api/admin/providers/${providerId}/${routeAction}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Unable to ${action} provider`);
        }
      },
      () => showToast(`Provider ${action}d successfully.`, 'success'),
      (error) => showToast(error.message, 'error'),
    );
  }

  function removeProvider(providerId: number) {
    if (deletingProviderId === providerId) {
      return;
    }

    if (!window.confirm('Delete this provider permanently?')) {
      return;
    }

    const typedConfirmation = window.prompt('Type DELETE to confirm provider deletion.');

    if (typedConfirmation !== 'DELETE') {
      showToast('Provider deletion cancelled.', 'warning');
      return;
    }

    const previousRows = providerRows;
    setDeletingProviderId(providerId);

    setProviderRows((current) => current.filter((row) => row.id !== providerId));

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/providers/${providerId}/delete`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          let message = 'Unable to delete provider';

          try {
            const payload = await response.json();
            if (payload && typeof payload.error === 'string' && payload.error.trim()) {
              message = payload.error;
            }
          } catch {
            // Ignore JSON parse errors and keep default message
          }

          throw new Error(message);
        }

        showToast('Provider deleted successfully.', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to delete provider.';
        const normalized = message.toLowerCase();

        if (normalized.includes('already deleted') || normalized.includes('provider not found')) {
          showToast('Provider was already deleted. Refreshing list.', 'success');
          void refreshProviders();
        } else {
          setProviderRows(previousRows);
          showToast(message, 'error');
        }
      } finally {
        setDeletingProviderId(null);
      }
    });
  }

  function toggleProviderServices(providerId: number, enable: boolean) {
    const previousServices = servicesByProvider[providerId] || [];
    const action = enable ? 'enable' : 'disable';

    // Optimistically update UI
    setServicesByProvider((current) => ({
      ...current,
      [providerId]: previousServices.map((service) => ({
        ...service,
        is_active: enable,
      })),
    }));

    startTransition(async () => {
      try {
        await adminRequest(`/api/admin/providers/${providerId}/services/toggle`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: enable }),
        });
        showToast(`Provider services ${action}d successfully.`, 'success');
      } catch (error) {
        // Revert on error
        setServicesByProvider((current) => ({
          ...current,
          [providerId]: previousServices,
        }));
        showToast(error instanceof Error ? error.message : `Unable to ${action} provider services.`, 'error');
      }
    });
  }

  function handleOnboardingSuccess(onboardedEmail: string) {
    // Refresh provider list
    refreshProviders();
    showToast(`Provider onboarded and invite email sent to ${onboardedEmail}.`, 'success');
  }

  async function loadProviderOperationalData(providerId: number) {
    if (providerDetailsLoadingById[providerId] || providerDetailsLoadedById[providerId]) {
      return;
    }

    setProviderDetailsLoadingById((current) => ({
      ...current,
      [providerId]: true,
    }));

    try {
      const [availabilityResponse, servicesResponse] = await Promise.all([
        adminRequest<{ availability: AdminProviderAvailability[] }>(`/api/admin/providers/${providerId}/availability`, {
          method: 'GET',
        }),
        adminRequest<{ services: Array<AdminProviderService & { service_pincodes?: string[] }> }>(
          `/api/admin/providers/${providerId}/services`,
          {
            method: 'GET',
          },
        ),
      ]);

      setAvailabilityByProvider((current) => ({
        ...current,
        [providerId]: availabilityResponse.availability,
      }));

      setServicesByProvider((current) => ({
        ...current,
        [providerId]: servicesResponse.services,
      }));

      setPincodesByService((current) => {
        const next = { ...current };

        for (const service of servicesResponse.services) {
          next[service.id] = service.service_pincodes ?? [];
        }

        return next;
      });

      setProviderDetailsLoadedById((current) => ({
        ...current,
        [providerId]: true,
      }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load provider details.', 'error');
    } finally {
      setProviderDetailsLoadingById((current) => ({
        ...current,
        [providerId]: false,
      }));
    }
  }

  function toggleProviderCard(providerId: number) {
    const isExpanded = expandedProviderIds.includes(providerId);

    if (isExpanded) {
      setExpandedProviderIds((current) => current.filter((id) => id !== providerId));
      return;
    }

    setExpandedProviderIds((current) => [...current, providerId]);
    void loadProviderOperationalData(providerId);
  }

  function focusProviderCard(providerId: number) {
    const isExpanded = expandedProviderIds.includes(providerId);

    if (!isExpanded) {
      setExpandedProviderIds((current) => [...current, providerId]);
      void loadProviderOperationalData(providerId);
    }

    window.setTimeout(() => {
      const target = providerCardRefs.current[providerId];
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, isExpanded ? 20 : 140);
  }

  function runSchemaSyncHealthCheck() {
    setIsSchemaSyncChecking(true);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/health/schema-sync', {
          method: 'GET',
          cache: 'no-store',
        });

        const payload = (await response.json().catch(() => null)) as SchemaSyncHealthResponse | { error?: string } | null;

        if (!response.ok) {
          const errorMessage = payload && 'error' in payload && payload.error ? payload.error : 'Schema health check failed';
          throw new Error(errorMessage);
        }

        const health = payload as SchemaSyncHealthResponse;
        setSchemaSyncHealth(health);
        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setSchemaSyncDurationMs(Math.round(finishedAt - startedAt));

        if (health.healthy) {
          showToast('Schema sync check passed.', 'success');
          return;
        }

        showToast(`Schema sync check found ${health.summary.failed} issue(s).`, 'error');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Schema health check failed';
        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setSchemaSyncDurationMs(Math.round(finishedAt - startedAt));
        setSchemaSyncHealth({
          healthy: false,
          domain: 'schema-contract',
          checks: [],
          failed_checks: [],
          summary: {
            total: 0,
            passed: 0,
            failed: 0,
          },
          generated_at: new Date().toISOString(),
          error: message,
        });
        showToast(message, 'error');
      } finally {
        setIsSchemaSyncChecking(false);
      }
    });
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setBookingSearchDebounced(bookingSearchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [bookingSearchQuery]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setUserSearchDebounced(userSearchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [userSearchQuery]);

  useEffect(() => {
    if (!isBookingsView) {
      return;
    }

    refreshBookings(bookingSearchDebounced);
  }, [bookingSearchDebounced, isBookingsView, refreshBookings]);

  useEffect(() => {
    if (!isUsersView) {
      return;
    }

    void fetchAdminUsers();
  }, [fetchAdminUsers, isUsersView]);

  useEffect(() => {
    if (!isHealthView || hasAutoRunSchemaHealth || isSchemaSyncChecking) {
      return;
    }

    setHasAutoRunSchemaHealth(true);
    runSchemaSyncHealthCheck();
    runFunctionalHealthChecks();
  }, [hasAutoRunSchemaHealth, isHealthView, isSchemaSyncChecking]);

  function downloadSchemaHealthReport() {
    if (!schemaSyncHealth || typeof window === 'undefined') {
      return;
    }

    const reportPayload = {
      ...schemaSyncHealth,
      duration_ms: schemaSyncDurationMs,
      downloaded_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(reportPayload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `schema-health-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  function runFunctionalHealthChecks() {
    setIsFunctionalHealthChecking(true);

    startTransition(async () => {
      try {
        const nextChecks = await Promise.all(
          functionalHealthChecks.map(async (check) => {
            const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

            try {
              const response = await fetch(check.endpoint, {
                method: 'GET',
                cache: 'no-store',
              });

              const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
              const durationMs = Math.round(finishedAt - startedAt);

              if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                return {
                  ...check,
                  status: 'unhealthy' as const,
                  durationMs,
                  lastRunAt: new Date().toISOString(),
                  error: payload?.error ?? `HTTP ${response.status}`,
                };
              }

              return {
                ...check,
                status: 'healthy' as const,
                durationMs,
                lastRunAt: new Date().toISOString(),
                error: null,
              };
            } catch (error) {
              const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
              const durationMs = Math.round(finishedAt - startedAt);

              return {
                ...check,
                status: 'unhealthy' as const,
                durationMs,
                lastRunAt: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Request failed',
              };
            }
          }),
        );

        setFunctionalHealthChecks(nextChecks);

        const unhealthyCount = nextChecks.filter((check) => check.status === 'unhealthy').length;
        if (unhealthyCount === 0) {
          showToast('All functional health checks passed.', 'success');
        } else {
          showToast(`${unhealthyCount} functional check(s) failed.`, 'error');
        }
      } finally {
        setIsFunctionalHealthChecking(false);
      }
    });
  }

  function setServiceDraftField(providerId: number, field: keyof ServiceRolloutDraft, value: string | boolean) {
    setServiceDraft((current) => ({
      ...current,
      [providerId]: {
        id: current[providerId]?.id,
        service_pincodes: current[providerId]?.service_pincodes ?? '',
        [field]: value,
      },
    }));
  }

  function copyServiceIntoDraft(providerId: number, serviceId: string) {
    const service = (servicesByProvider[providerId] ?? []).find((item) => item.id === serviceId);

    if (!service) {
      return;
    }

    setServiceDraft((current) => ({
      ...current,
      [providerId]: {
        id: service.id,
        service_pincodes: (pincodesByService[service.id] ?? []).join(', '),
      },
    }));
  }

  function toggleProviderServiceSelection(
    providerId: number,
    serviceType: string,
    isChecked: boolean,
    providerServiceTypeOptions: string[],
    providerServicesRows: AdminProviderService[],
  ) {
    setSelectedServiceTypesByProvider((current) => {
      const fallbackSelection = providerServicesRows.map((service) => service.service_type);
      const currentSelection = current[providerId] ?? fallbackSelection;
      const normalizedCurrent = new Set(currentSelection.map((value) => value.trim()).filter((value) => value.length > 0));
      const normalizedServiceType = serviceType.trim();

      if (!normalizedServiceType) {
        return current;
      }

      if (isChecked) {
        normalizedCurrent.add(normalizedServiceType);
      } else {
        normalizedCurrent.delete(normalizedServiceType);
      }

      const nextSelection = providerServiceTypeOptions.filter((value) => normalizedCurrent.has(value.trim()));

      return {
        ...current,
        [providerId]: nextSelection,
      };
    });
  }

  function setAllProviderServiceSelections(
    providerId: number,
    providerServiceTypeOptions: string[],
    isSelected: boolean,
  ) {
    setSelectedServiceTypesByProvider((current) => ({
      ...current,
      [providerId]: isSelected ? [...providerServiceTypeOptions] : [],
    }));
  }

  function submitServiceRollout(
    providerId: number,
    providerServiceTypeOptions: string[],
    providerServicesRows: AdminProviderService[],
  ) {
    const draft = serviceDraft[providerId];
    const selectedServiceTypes = selectedServiceTypesByProvider[providerId] ?? providerServicesRows.map((service) => service.service_type);

    const normalizedSelectedServiceTypes = Array.from(
      new Set(selectedServiceTypes.map((value) => value.trim()).filter((value) => value.length > 0)),
    ).filter((value) => providerServiceTypeOptions.includes(value));

    if (normalizedSelectedServiceTypes.length === 0) {
      showToast('Select at least one service to apply rollout.', 'error');
      return;
    }

    if (!draft) {
      showToast('Provide service configuration before saving.', 'error');
      return;
    }

    const existingServiceByType = new Map<string, AdminProviderService>();
    for (const service of providerServicesRows) {
      existingServiceByType.set(service.service_type.trim().toLowerCase(), service);
    }

    const servicePincodes = draft.service_pincodes
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    startTransition(async () => {
      try {
        const rolloutPayload = normalizedSelectedServiceTypes.map((serviceType) => {
          const existingService = existingServiceByType.get(serviceType.toLowerCase());
          const existingPincodes = existingService ? pincodesByService[existingService.id] ?? [] : [];

          return {
            id: existingService?.id,
            service_type: serviceType,
            is_active: true,
            service_pincodes: servicePincodes.length > 0 ? servicePincodes : existingPincodes,
          };
        });

        const response = await adminRequest<{ services: Array<AdminProviderService & { service_pincodes?: string[] }> }>(
          `/api/admin/providers/${providerId}/services`,
          {
            method: 'PUT',
            body: JSON.stringify(rolloutPayload),
          },
        );

        setServicesByProvider((current) => ({ ...current, [providerId]: response.services }));
        setPincodesByService((current) => {
          const next = { ...current };
          for (const service of response.services) {
            next[service.id] = service.service_pincodes ?? [];
          }
          return next;
        });

        showToast('Service rollout updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update service rollout.', 'error');
      }
    });
  }

  function setGlobalServiceDraftField(field: keyof GlobalServiceRolloutDraft, value: string | boolean) {
    setGlobalServiceDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function setServiceActivation(serviceType: string, isActive: boolean) {
    startTransition(async () => {
      try {
        const response = await adminRequest<{ summary: AdminServiceModerationSummaryItem[] }>(
          '/api/admin/services/moderation',
          {
            method: 'PATCH',
            body: JSON.stringify({
              service_type: serviceType,
              is_active: isActive,
            }),
          },
        );
        setServiceSummary(response.summary);
        showToast(`Service ${serviceType} ${isActive ? 'enabled' : 'disabled'} globally.`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update service activation.', 'error');
      }
    });
  }

  function rolloutGlobalService() {
    if (!globalServiceDraft.service_type.trim()) {
      showToast('Service type is required.', 'error');
      return;
    }

    const selectedServiceType = globalServiceDraft.service_type.trim();

    if (!selectedServiceType) {
      showToast('Service type is required.', 'error');
      return;
    }

    const basePrice = Number(globalServiceDraft.base_price);
    const surgePrice = globalServiceDraft.surge_price.trim() ? Number(globalServiceDraft.surge_price) : null;
    const commission = globalServiceDraft.commission_percentage.trim()
      ? Number(globalServiceDraft.commission_percentage)
      : null;
    const serviceDuration = globalServiceDraft.service_duration_minutes.trim()
      ? Number(globalServiceDraft.service_duration_minutes)
      : null;

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      showToast('Base price must be a valid non-negative number.', 'error');
      return;
    }

    if (surgePrice !== null && (!Number.isFinite(surgePrice) || surgePrice < 0)) {
      showToast('Surge price must be a valid non-negative number.', 'error');
      return;
    }

    if (commission !== null && (!Number.isFinite(commission) || commission < 0 || commission > 100)) {
      showToast('Commission must be between 0 and 100.', 'error');
      return;
    }

    if (serviceDuration !== null && (!Number.isFinite(serviceDuration) || serviceDuration <= 0)) {
      showToast('Duration must be a positive number.', 'error');
      return;
    }

    const servicePincodes = globalServiceDraft.service_pincodes
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const providerIds = globalServiceDraft.provider_ids
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    startTransition(async () => {
      try {
        const response = await adminRequest<{ summary: AdminServiceModerationSummaryItem[] }>(
          '/api/admin/services/moderation',
          {
            method: 'POST',
            body: JSON.stringify({
              service_type: selectedServiceType,
              base_price: basePrice,
              surge_price: surgePrice,
              commission_percentage: commission,
              service_duration_minutes: serviceDuration,
              is_active: true,
              service_pincodes: servicePincodes,
              provider_ids: providerIds.length > 0 ? providerIds : undefined,
              overwrite_existing: globalServiceDraft.overwrite_existing,
            }),
          },
        );

        setServiceSummary(response.summary);
        showToast('Global service rollout completed.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to rollout service globally.', 'error');
      }
    });
  }

  function setDiscountDraftField(field: keyof DiscountDraft, value: string | boolean) {
    setDiscountDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function refreshDiscountModeration() {
    const response = await adminRequest<{ discounts: PlatformDiscount[]; analytics: PlatformDiscountAnalyticsSummary }>(
      '/api/admin/discounts',
      {
        method: 'GET',
      },
    );

    setDiscounts(response.discounts);
    setDiscountAnalytics(response.analytics);
  }

  function loadDiscountInDraft(discount: PlatformDiscount) {
    setDiscountDraft({
      id: discount.id,
      code: discount.code,
      title: discount.title,
      description: discount.description ?? '',
      discount_type: discount.discount_type,
      discount_value: String(discount.discount_value),
      max_discount_amount: discount.max_discount_amount === null ? '' : String(discount.max_discount_amount),
      min_booking_amount: discount.min_booking_amount === null ? '' : String(discount.min_booking_amount),
      applies_to_service_type: discount.applies_to_service_type ?? '',
      valid_from: discount.valid_from.slice(0, 16),
      valid_until: discount.valid_until ? discount.valid_until.slice(0, 16) : '',
      usage_limit_total: discount.usage_limit_total === null ? '' : String(discount.usage_limit_total),
      usage_limit_per_user: discount.usage_limit_per_user === null ? '' : String(discount.usage_limit_per_user),
      first_booking_only: discount.first_booking_only,
      is_active: discount.is_active,
    });
  }

  function resetDiscountDraft() {
    setDiscountDraft({
      code: '',
      title: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      max_discount_amount: '',
      min_booking_amount: '',
      applies_to_service_type: '',
      valid_from: new Date().toISOString().slice(0, 16),
      valid_until: '',
      usage_limit_total: '',
      usage_limit_per_user: '',
      first_booking_only: false,
      is_active: true,
    });
  }

  function saveDiscount() {
    if (!discountDraft.code.trim() || !discountDraft.title.trim()) {
      showToast('Discount code and title are required.', 'error');
      return;
    }

    const discountValue = Number(discountDraft.discount_value);

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      showToast('Discount value must be a positive number.', 'error');
      return;
    }

    const maxDiscountAmount = discountDraft.max_discount_amount.trim() ? Number(discountDraft.max_discount_amount) : null;
    const minBookingAmount = discountDraft.min_booking_amount.trim() ? Number(discountDraft.min_booking_amount) : null;
    const usageLimitTotal = discountDraft.usage_limit_total.trim() ? Number(discountDraft.usage_limit_total) : null;
    const usageLimitPerUser = discountDraft.usage_limit_per_user.trim() ? Number(discountDraft.usage_limit_per_user) : null;

    const validFromDate = new Date(discountDraft.valid_from);
    const validUntilDate = discountDraft.valid_until.trim() ? new Date(discountDraft.valid_until) : null;

    if (!discountDraft.valid_from || Number.isNaN(validFromDate.getTime())) {
      showToast('Provide a valid start date and time.', 'error');
      return;
    }

    if (validUntilDate && Number.isNaN(validUntilDate.getTime())) {
      showToast('Provide a valid end date and time.', 'error');
      return;
    }

    const validFromIso = validFromDate.toISOString();
    const validUntilIso = validUntilDate ? validUntilDate.toISOString() : null;

    startTransition(async () => {
      try {
        const response = await adminRequest<{ discount: PlatformDiscount }>('/api/admin/discounts', {
          method: 'POST',
          body: JSON.stringify({
            id: discountDraft.id,
            code: discountDraft.code.trim().toUpperCase(),
            title: discountDraft.title.trim(),
            description: discountDraft.description.trim() || null,
            discount_type: discountDraft.discount_type,
            discount_value: discountValue,
            max_discount_amount: maxDiscountAmount,
            min_booking_amount: minBookingAmount,
            applies_to_service_type: discountDraft.applies_to_service_type.trim() || null,
            valid_from: validFromIso,
            valid_until: validUntilIso,
            usage_limit_total: usageLimitTotal,
            usage_limit_per_user: usageLimitPerUser,
            first_booking_only: discountDraft.first_booking_only,
            is_active: discountDraft.is_active,
          }),
        });

        setDiscounts((current) => {
          const existingIndex = current.findIndex((discount) => discount.id === response.discount.id);

          if (existingIndex === -1) {
            return [response.discount, ...current];
          }

          const next = [...current];
          next[existingIndex] = response.discount;
          return next;
        });
        await refreshDiscountModeration();

        resetDiscountDraft();
        showToast('Discount saved.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to save discount.', 'error');
      }
    });
  }

  function toggleDiscount(discountId: string, isActive: boolean) {
    startTransition(async () => {
      try {
        const response = await adminRequest<{ discount: PlatformDiscount }>(`/api/admin/discounts/${discountId}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_active: isActive }),
        });

        setDiscounts((current) => current.map((item) => (item.id === discountId ? response.discount : item)));
        await refreshDiscountModeration();
        showToast(`Discount ${isActive ? 'enabled' : 'disabled'}.`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update discount.', 'error');
      }
    });
  }

  function removeDiscount(discountId: string) {
    startTransition(async () => {
      try {
        await adminRequest<{ success: true }>(`/api/admin/discounts/${discountId}`, {
          method: 'DELETE',
        });

        setDiscounts((current) => current.filter((item) => item.id !== discountId));
        if (discountDraft.id === discountId) {
          resetDiscountDraft();
        }
        await refreshDiscountModeration();
        showToast('Discount deleted.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to delete discount.', 'error');
      }
    });
  }

  function setLocationDraftField(providerId: number, field: keyof LocationDraft, value: string) {
    setLocationDraft((current) => ({
      ...current,
      [providerId]: {
        address: current[providerId]?.address ?? '',
        city: current[providerId]?.city ?? '',
        state: current[providerId]?.state ?? '',
        pincode: current[providerId]?.pincode ?? '',
        latitude: current[providerId]?.latitude ?? '',
        longitude: current[providerId]?.longitude ?? '',
        service_radius_km: current[providerId]?.service_radius_km ?? '',
        [field]: value,
      },
    }));
  }

  function copyLocationIntoDraft(provider: AdminProviderModerationItem) {
    setLocationDraft((current) => ({
      ...current,
      [provider.id]: {
        address: provider.address ?? '',
        city: provider.city ?? '',
        state: provider.state ?? '',
        pincode: provider.pincode ?? '',
        latitude: provider.latitude === null ? '' : String(provider.latitude),
        longitude: provider.longitude === null ? '' : String(provider.longitude),
        service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
      },
    }));
  }

  function cancelLocationEdit(providerId: number) {
    setLocationDraft((current) => {
      if (!current[providerId]) {
        return current;
      }

      const next = { ...current };
      delete next[providerId];
      return next;
    });
  }

  function getLocationDraftForProvider(provider: AdminProviderModerationItem, current: Record<number, LocationDraft>) {
    return current[provider.id] ?? {
      address: provider.address ?? '',
      city: provider.city ?? '',
      state: provider.state ?? '',
      pincode: provider.pincode ?? '',
      latitude: provider.latitude === null ? '' : String(provider.latitude),
      longitude: provider.longitude === null ? '' : String(provider.longitude),
      service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
    };
  }

  function applyLocationWarningSuggestion(
    provider: AdminProviderModerationItem,
    warning: string,
    coveragePincodes: string[],
  ) {
    let changeSummary = '';

    setLocationDraft((current) => {
      const existing = getLocationDraftForProvider(provider, current);
      const next = applyLocationWarningToDraft(existing, warning, coveragePincodes);
      changeSummary = buildLocationChangeSummary(existing, next);

      return {
        ...current,
        [provider.id]: next,
      };
    });

    showToast(
      changeSummary
        ? `Suggestion applied: ${changeSummary}`
        : 'Suggestion applied (no field changes were required).',
      'success',
    );
    setLocationLastAutoFixNote((current) => ({
      ...current,
      [provider.id]: changeSummary
        ? `Last auto-fix: ${changeSummary}`
        : 'Last auto-fix: No field changes were required.',
    }));
  }

  function dismissLocationAutoFixNote(providerId: number) {
    setLocationLastAutoFixNote((current) => {
      if (!current[providerId]) {
        return current;
      }

      const next = { ...current };
      delete next[providerId];
      return next;
    });
  }

  function copyProviderProfileIntoDraft(provider: AdminProviderModerationItem) {
    setProviderProfileDraft((current) => ({
      ...current,
      [provider.id]: {
        name: provider.name ?? '',
        email: provider.email ?? '',
        provider_type: provider.provider_type ?? '',
        business_name: provider.business_name ?? '',
        profile_photo_url: provider.profile_photo_url ?? '',
        service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
      },
    }));
  }

  function setProviderProfileDraftField(
    providerId: number,
    field: keyof ProviderProfileDraft,
    value: string,
  ) {
    setProviderProfileDraft((current) => ({
      ...current,
      [providerId]: {
        name: current[providerId]?.name ?? '',
        email: current[providerId]?.email ?? '',
        provider_type: current[providerId]?.provider_type ?? '',
        business_name: current[providerId]?.business_name ?? '',
        profile_photo_url: current[providerId]?.profile_photo_url ?? '',
        service_radius_km: current[providerId]?.service_radius_km ?? '',
        [field]: value,
      },
    }));
  }

  function cancelProviderProfileEdit(providerId: number) {
    setProviderProfileDraft((current) => {
      if (!current[providerId]) {
        return current;
      }

      const next = { ...current };
      delete next[providerId];
      return next;
    });
  }

  function saveProviderProfile(providerId: number) {
    const provider = providerRows.find((row) => row.id === providerId);

    if (!provider) {
      showToast('Provider not found.', 'error');
      return;
    }

    const draft = providerProfileDraft[providerId];

    if (!draft) {
      showToast('No profile changes to save.', 'error');
      return;
    }

    const name = draft.name.trim();
    const email = draft.email.trim().toLowerCase();
    const providerType = draft.provider_type.trim();
    const serviceRadiusKm = draft.service_radius_km.trim() ? Number(draft.service_radius_km) : null;

    if (!name) {
      showToast('Provider name is required.', 'error');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Provide a valid email address.', 'error');
      return;
    }

    if (!providerType) {
      showToast('Provider type is required.', 'error');
      return;
    }

    if (serviceRadiusKm !== null && (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm < 0)) {
      showToast('Service radius must be a valid non-negative number.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        const response = await adminRequest<{
          provider: {
            id: number;
            name: string;
            email: string | null;
            profile_photo_url: string | null;
            provider_type: string;
            business_name: string | null;
            service_radius_km: number | null;
            updated_at: string;
          };
        }>(`/api/admin/providers/${providerId}/profile`, {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            email: email || null,
            provider_type: providerType,
            business_name: draft.business_name.trim() || null,
            profile_photo_url: draft.profile_photo_url.trim() || null,
            service_radius_km: serviceRadiusKm,
          }),
        });

        setProviderRows((current) =>
          current.map((row) =>
            row.id === providerId
              ? {
                  ...row,
                  name: response.provider.name,
                  email: response.provider.email,
                  profile_photo_url: response.provider.profile_photo_url,
                  provider_type: response.provider.provider_type as AdminProviderModerationItem['provider_type'],
                  business_name: response.provider.business_name,
                  service_radius_km: response.provider.service_radius_km,
                  updated_at: response.provider.updated_at,
                }
              : row,
          ),
        );

        cancelProviderProfileEdit(providerId);
        showToast('Provider profile updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update provider profile.', 'error');
      }
    });
  }

  function saveProviderLocation(providerId: number) {
    const provider = providerRows.find((row) => row.id === providerId);

    if (!provider) {
      showToast('Provider not found.', 'error');
      return;
    }

    const draft = locationDraft[providerId] ?? {
      address: provider.address ?? '',
      city: provider.city ?? '',
      state: provider.state ?? '',
      pincode: provider.pincode ?? '',
      latitude: provider.latitude === null ? '' : String(provider.latitude),
      longitude: provider.longitude === null ? '' : String(provider.longitude),
      service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
    };

    const latitude = draft.latitude.trim() ? Number(draft.latitude) : null;
    const longitude = draft.longitude.trim() ? Number(draft.longitude) : null;
    const serviceRadiusKm = draft.service_radius_km.trim() ? Number(draft.service_radius_km) : null;

    if ((latitude === null) !== (longitude === null)) {
      showToast('Latitude and longitude should be provided together.', 'error');
      return;
    }

    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
      showToast('Latitude must be between -90 and 90.', 'error');
      return;
    }

    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
      showToast('Longitude must be between -180 and 180.', 'error');
      return;
    }

    if (serviceRadiusKm !== null && (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm < 0)) {
      showToast('Service radius must be a valid non-negative number.', 'error');
      return;
    }

    const pincode = draft.pincode.trim();
    const address = draft.address.trim();
    const city = draft.city.trim();
    const state = draft.state.trim();

    if (pincode && !/^[1-9]\d{5}$/.test(pincode)) {
      showToast('Pincode should be a valid 6-digit Indian pincode.', 'error');
      return;
    }

    if (latitude !== null && longitude !== null && (!address || !city || !state || !pincode)) {
      showToast('Address, city, state and pincode are required when coordinates are provided.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        const response = await adminRequest<{
          location: {
            provider_id: number;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            service_radius_km: number | null;
          };
          coverageWarnings?: string[];
        }>(`/api/admin/providers/${providerId}/location`, {
          method: 'PATCH',
          body: JSON.stringify({
            address: address || null,
            city: city || null,
            state: state || null,
            pincode: pincode || null,
            latitude,
            longitude,
            service_radius_km: serviceRadiusKm,
          }),
        });

        setProviderRows((current) =>
          current.map((row) =>
            row.id === providerId
              ? {
                  ...row,
                  address: response.location.address,
                  city: response.location.city,
                  state: response.location.state,
                  pincode: response.location.pincode,
                  latitude: response.location.latitude,
                  longitude: response.location.longitude,
                  service_radius_km: response.location.service_radius_km,
                }
              : row,
          ),
        );
        setLocationCoverageWarnings((current) => ({
          ...current,
          [providerId]: response.coverageWarnings ?? [],
        }));
        setLocationDraft((current) => {
          if (!current[providerId]) {
            return current;
          }

          const next = { ...current };
          delete next[providerId];
          return next;
        });
        setLocationLastAutoFixNote((current) => {
          const next = { ...current };
          delete next[providerId];
          return next;
        });

        showToast('Location moderation updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update location moderation.', 'error');
      }
    });
  }

  function setAvailabilityDraftField(
    providerId: number,
    field: 'start_time' | 'end_time',
    value: string,
  ) {
    setAvailabilityDraft((current) => ({
      ...current,
      [providerId]: {
        selected_days: current[providerId]?.selected_days ?? [1],
        start_time: current[providerId]?.start_time ?? '09:00',
        end_time: current[providerId]?.end_time ?? '17:00',
        [field]: value,
      },
    }));
  }

  function toggleAvailabilityDraftWeekday(providerId: number, dayOfWeek: number, checked: boolean) {
    setAvailabilityDraft((current) => {
      const draft = current[providerId] ?? getDefaultAvailabilityDraft();
      const selectedDays = checked
        ? Array.from(new Set([...draft.selected_days, dayOfWeek])).sort((a, b) => a - b)
        : draft.selected_days.filter((day) => day !== dayOfWeek);

      return {
        ...current,
        [providerId]: {
          ...draft,
          selected_days: selectedDays,
        },
      };
    });
  }

  function saveAvailability(providerId: number, nextRows: AdminProviderAvailability[]) {
    setAvailabilityByProvider((current) => ({ ...current, [providerId]: nextRows }));

    startTransition(async () => {
      try {
        const response = await adminRequest<{ availability: AdminProviderAvailability[] }>(
          `/api/admin/providers/${providerId}/availability`,
          {
            method: 'PUT',
            body: JSON.stringify(
              nextRows.map((row) => ({
                id: row.id,
                day_of_week: row.day_of_week,
                start_time: row.start_time,
                end_time: row.end_time,
                is_available: row.is_available,
              })),
            ),
          },
        );

        setAvailabilityByProvider((current) => ({ ...current, [providerId]: response.availability }));
        showToast('Availability updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update availability.', 'error');
      }
    });
  }

  function appendAvailabilitySlot(providerId: number) {
    const draft = availabilityDraft[providerId] ?? getDefaultAvailabilityDraft();

    const selectedDays = draft.selected_days.filter(
      (dayOfWeek) => Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6,
    );

    if (selectedDays.length === 0) {
      showToast('Please select a valid weekday.', 'error');
      return;
    }

    if (!draft.start_time || !draft.end_time || draft.start_time >= draft.end_time) {
      showToast('Provide a valid availability window.', 'error');
      return;
    }

    const current = availabilityByProvider[providerId] ?? [];

    const nextSlots: AdminProviderAvailability[] = selectedDays.map((dayOfWeek) => ({
      id: crypto.randomUUID(),
      provider_id: providerId,
      day_of_week: dayOfWeek,
      start_time: draft.start_time,
      end_time: draft.end_time,
      is_available: true,
    }));

    saveAvailability(providerId, [
      ...current,
      ...nextSlots,
    ]);
  }

  function toggleAvailabilitySlot(providerId: number, slotId: string, isAvailable: boolean) {
    const current = availabilityByProvider[providerId] ?? [];
    const nextRows = current.map((row) => (row.id === slotId ? { ...row, is_available: isAvailable } : row));
    saveAvailability(providerId, nextRows);
  }

  return (
    <DashboardPageLayout
      title="Admin Operation Dashboard"
      description="Centralized platform control for providers, services, and access management."
      tabs={[
        { id: 'overview', label: 'Overview', href: '/dashboard/admin' },
        { id: 'bookings', label: 'Bookings', href: '/dashboard/admin?view=bookings' },
        { id: 'users', label: 'Users', href: '/dashboard/admin?view=users' },
        { id: 'providers', label: 'Providers', href: '/dashboard/admin?view=providers' },
        { id: 'services', label: 'Services', href: '/dashboard/admin?view=services' },
        { id: 'access', label: 'Access', href: '/dashboard/admin?view=access' },
        { id: 'health', label: 'Health', href: '/dashboard/admin?view=health' },
      ]}
      activeTab={view}
    >
      <div className="space-y-8">
      {/* Content sections below */}

      {isOverviewView ? (
        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-section-title">Business Statistics</h2>
            <p className="text-muted">Track platform supply, customer footprint, and growth levers from one control panel</p>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            <StatCard
              label="All Bookings"
              value={bookings.length}
              icon="calendar"
              description="Live pipeline volume"
            />
            <StatCard
              label="Bookings in Progress"
              value={bookingRiskSummary.inProgress}
              icon="trending-up"
              description="Pending and confirmed bookings"
            />
            <StatCard
              label="Completed Bookings"
              value={bookingRiskSummary.completed}
              icon="award"
              description="Successfully fulfilled bookings"
            />
            <StatCard
              label="No-show Bookings"
              value={bookingRiskSummary.noShow}
              icon="x-circle"
              description="Provider or customer no-show"
            />
            <StatCard
              label="Cancelled Bookings"
              value={bookingRiskSummary.cancelled}
              icon="x"
              description="Cancelled from pipeline"
            />
            <StatCard
              label="Total Providers"
              value={providerRows.length}
              icon="users"
              description="Onboarded provider base"
            />
            <StatCard
              label="Total Services"
              value={initialCatalogServices.length}
              icon="star"
              description="Services in catalog"
            />
            <StatCard
              label="Total Customers"
              value={totalCustomers}
              icon="users"
              description="Unique customers from bookings"
            />
            <StatCard
              label="Live Discounts"
              value={discountAnalytics.total_active_discounts}
              icon="tag"
              description="Currently active campaigns"
            />
          </div>
        </section>
      ) : null}

      {isBookingsView ? (
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Booking Operations</h2>
          <p className="text-muted">Monitor booking pipeline, SLA risk, and fulfillment actions in one place</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="All Bookings"
            value={bookings.length}
            icon="calendar"
            description="Live pipeline volume"
          />
          <StatCard
            label="Bookings in Progress"
            value={bookingRiskSummary.inProgress}
            icon="trending-up"
            description="Pending and confirmed bookings"
          />
          <StatCard
            label="Completed Bookings"
            value={bookingRiskSummary.completed}
            icon="award"
            description="Successfully fulfilled bookings"
          />
          <StatCard
            label="No-show Bookings"
            value={bookingRiskSummary.noShow}
            icon="x-circle"
            description="Provider or customer no-show"
          />
          <StatCard
            label="Cancelled Bookings"
            value={bookingRiskSummary.cancelled}
            icon="x"
            description="Cancelled from pipeline"
          />
        </div>
      </section>
      ) : null}

      {isServicesView ? (
        <>
          <ServiceCategoriesManager initialCategories={initialServiceCategories} />
          <ServiceBuilder
            initialServices={initialCatalogServices}
            categories={initialServiceCategories}
          />
          <PackageBuilder
            initialPackages={initialServicePackages}
            categories={initialServiceCategories}
            providers={providers}
          />
        </>
      ) : null}

      {canManageUserAccess && isAccessView ? (
        <section className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-section-title">Admin Access Management</h2>
              <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', schemaHealthBadgeClass)}>
                {schemaHealthBadgeLabel}
              </span>
              <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', functionalHealthBadgeClass)}>
                {functionalHealthBadgeLabel}
              </span>
            </div>
            <p className="text-muted">Promote existing users to admin or staff roles</p>
          </div>
          
          <Card>
            <div className="space-y-4">
              <Input
                type="email"
                label="Email Address"
                value={promoteEmail}
                onChange={(event) => setPromoteEmail(event.target.value)}
                placeholder="user@example.com"
              />
              
              <div className="flex gap-2 flex-wrap pt-2">
                <Button
                  onClick={() => promoteUserToRole('admin')}
                  disabled={isPending}
                >
                  Promote to Admin
                </Button>
                <Button
                  onClick={() => promoteUserToRole('staff')}
                  disabled={isPending}
                  variant="secondary"
                >
                  Promote to Staff
                </Button>
                <Button
                  onClick={() => promoteUserToRole('provider')}
                  disabled={isPending}
                  variant="secondary"
                >
                  Promote to Provider
                </Button>
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      {isHealthView ? (
        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-section-title">Platform Health Center</h2>
            <p className="text-muted">Run and monitor schema and functional health checks from one observability panel.</p>
          </div>

          <Card>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-neutral-900">Health Actions</p>
                  <p className="text-sm text-neutral-600">Use these controls to verify infrastructure and critical admin APIs.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={runSchemaSyncHealthCheck} disabled={isPending || isSchemaSyncChecking} variant="secondary">
                    {isSchemaSyncChecking ? 'Checking Schema…' : 'Run Schema Check'}
                  </Button>
                  <Button onClick={runFunctionalHealthChecks} disabled={isPending || isFunctionalHealthChecking} variant="secondary">
                    {isFunctionalHealthChecking ? 'Checking Functions…' : 'Run Functional Checks'}
                  </Button>
                  <Button onClick={downloadSchemaHealthReport} disabled={!schemaSyncHealth} variant="ghost">
                    Download Schema Report
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-neutral-200/60 bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-600">Schema Status</p>
                  <p className={cn('mt-1 text-sm font-semibold', schemaSyncHealth?.healthy ? 'text-green-700' : 'text-red-700')}>
                    {schemaSyncHealth?.healthy ? 'Healthy' : schemaSyncHealth ? 'Unhealthy' : 'Not run'}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200/60 bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-600">Schema Checks</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {schemaSyncHealth ? `${schemaSyncHealth.summary.passed}/${schemaSyncHealth.summary.total}` : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200/60 bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-600">Function Checks</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {functionalHealthChecks.filter((check) => check.status === 'healthy').length}/{functionalHealthChecks.length}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200/60 bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-600">Last Schema Run</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {formatSchemaHealthTimestamp(schemaSyncHealth?.generated_at ?? null)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-neutral-200/60 p-3">
                  <p className="text-sm font-semibold text-neutral-900">Schema Health</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Duration: {schemaSyncDurationMs !== null ? `${schemaSyncDurationMs}ms` : '—'}
                  </p>

                  {schemaSyncHealth && schemaSyncHealth.failed_checks.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-red-700">
                      {schemaSyncHealth.failed_checks.map((check) => {
                        const fixGuide = SCHEMA_FIX_GUIDES[check.key];
                        return (
                          <li key={check.key}>
                            • {check.key}
                            {fixGuide ? ` → ${fixGuide.migration}` : ''}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-green-700">No schema drift detected.</p>
                  )}
                </div>

                <div className="rounded-xl border border-neutral-200/60 p-3">
                  <p className="text-sm font-semibold text-neutral-900">Functional Health</p>
                  <ul className="mt-2 space-y-2 text-xs">
                    {functionalHealthChecks.map((check) => (
                      <li key={check.key} className="rounded-lg border border-neutral-200/60 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-neutral-900">{check.label}</span>
                          <span
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                              check.status === 'healthy'
                                ? 'border-green-300 bg-green-100 text-green-700'
                                : check.status === 'unhealthy'
                                ? 'border-red-300 bg-red-100 text-red-700'
                                : 'border-neutral-300 bg-neutral-100 text-neutral-700',
                            )}
                          >
                            {check.status}
                          </span>
                        </div>
                        <p className="mt-1 text-neutral-500">{check.endpoint}</p>
                        <p className="mt-1 text-neutral-500">
                          {check.lastRunAt ? `Last run: ${formatSchemaHealthTimestamp(check.lastRunAt)}` : 'Last run: —'}
                          {check.durationMs !== null ? ` • ${check.durationMs}ms` : ''}
                        </p>
                        {check.error ? <p className="mt-1 text-red-700">{check.error}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      {isBookingsView ? (
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">All Bookings</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-neutral-600">
            <span>Pending SLA: <span className="font-semibold text-neutral-900">{bookingRiskSummary.pending}</span></span>
            <span className="hidden sm:inline text-neutral-300">•</span>
            <span>No-show: <span className="font-semibold text-neutral-900">{bookingRiskSummary.noShow}</span></span>
            <span className="hidden sm:inline text-neutral-300">•</span>
            <span>Cancelled: <span className="font-semibold text-neutral-900">{bookingRiskSummary.cancelled}</span></span>
          </div>
        </div>

        <Card>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                type="search"
                label="Search"
                placeholder="Booking ID, customer/provider name or ID"
                value={bookingSearchQuery}
                onChange={(event) => setBookingSearchQuery(event.target.value)}
              />
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-2">Filter</label>
                <select
                  value={bookingFilter}
                  onChange={(event) => setBookingFilter(event.target.value as 'all' | 'sla' | 'high-risk')}
                  className="input-field w-full"
                >
                  <option value="all">All Bookings</option>
                  <option value="sla">SLA Queue</option>
                  <option value="high-risk">High Risk</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-2">Bulk Action</label>
                <select
                  value={bulkStatus}
                  onChange={(event) =>
                    setBulkStatus(event.target.value as 'confirmed' | 'completed' | 'cancelled' | 'no_show')
                  }
                  className="input-field w-full"
                >
                  <option value="confirmed">Mark: Confirmed</option>
                  <option value="completed">Mark: Completed</option>
                  <option value="cancelled">Mark: Cancelled</option>
                  <option value="no_show">Mark: No-show</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={applyBulkStatus}
                  disabled={isPending || selectedBookingIds.length === 0}
                  className="w-full"
                >
                  Apply to {selectedBookingIds.length} Selected
                </Button>
              </div>
            </div>

            {visibleBookings.length === 0 ? (
              <p className="text-body text-neutral-500 text-center py-8">No bookings found</p>
            ) : (
              <div className="space-y-3">
                {visibleBookings.map((booking) => {
                  const status = booking.booking_status ?? booking.status;

                  return (
                  <div
                    key={booking.id}
                    className="border-b border-neutral-200/60 pb-4 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedBookingIds.includes(booking.id)}
                          onChange={() => toggleBookingSelection(booking.id)}
                          className="w-4 h-4 rounded border-neutral-300 mt-1"
                        />
                        <div>
                          <p className="font-semibold text-neutral-900">Booking #{booking.id}</p>
                          <p className="text-xs text-neutral-500 mt-1">
                            Customer: {booking.customer_name ?? booking.user_id ?? '—'}
                            {booking.customer_phone ? ` • ${booking.customer_phone}` : ''}
                          </p>
                          <p className="text-xs text-neutral-500">
                            Provider: {booking.provider_name ?? `#${booking.provider_id}`}
                          </p>
                          <p className="text-sm text-neutral-600">
                            {booking.booking_date && booking.start_time
                              ? `${booking.booking_date} • ${booking.start_time}${booking.end_time ? ` - ${booking.end_time}` : ''}`
                              : new Date(booking.booking_start).toLocaleString()}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">{bookingTimelineLabel(status)}</p>
                          <p className="text-xs text-neutral-500">
                            {booking.service_type ?? 'Service'} • {(booking.booking_mode ?? 'home_visit').replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {status === 'pending' && (
                          <Alert variant="warning" className="!p-2 !text-xs">
                            SLA Queue
                          </Alert>
                        )}
                        {(status === 'no_show' || status === 'cancelled') && (
                          <Alert variant="error" className="!p-2 !text-xs">
                            High Risk
                          </Alert>
                        )}
                        {status === 'confirmed' && booking.completion_task_status === 'pending' && (
                          <Alert variant="warning" className="!p-2 !text-xs">
                            Provider Follow-up Pending
                          </Alert>
                        )}
                        {booking.completion_task_status === 'completed' && (
                          <Alert variant="success" className="!p-2 !text-xs">
                            Provider Feedback Logged
                          </Alert>
                        )}
                        <Badge>{status.replace('_', ' ')}</Badge>
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-neutral-200/60">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          className="input-field text-sm"
                          defaultValue={booking.provider_id}
                          onChange={(event) => reassignProvider(booking.id, Number(event.target.value))}
                          disabled={isPending}
                        >
                          <option value="">Reassign to provider...</option>
                          {providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => overrideStatus(booking.id, 'confirmed')}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => overrideStatus(booking.id, 'completed')}
                        >
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => overrideStatus(booking.id, 'no_show')}
                        >
                          No-show
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => overrideStatus(booking.id, 'cancelled')}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => applyBookingAdjustment(booking.id)}
                          disabled={isPending}
                        >
                          Cancel + Reverse
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </section>
      ) : null}

      {isUsersView ? (
        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-section-title">User Directory</h2>
            <p className="text-muted">Search users and inspect account profile with their pet information.</p>
          </div>

          <Card>
            <div className="space-y-4">
              <Input
                type="search"
                label="Search Users"
                placeholder="Name, email, or phone"
                value={userSearchQuery}
                onChange={(event) => setUserSearchQuery(event.target.value)}
              />

              {isUserSearchLoading ? (
                <p className="text-sm text-neutral-500">Loading users…</p>
              ) : !userSearchDebounced ? (
                <p className="text-sm text-neutral-500">Type a name, email, or phone number to search users.</p>
              ) : userSearchResults.length === 0 ? (
                <p className="text-sm text-neutral-500">No users found.</p>
              ) : (
                <div className="space-y-4">
                  {userSearchResults.map((user) => (
                    <div key={user.id} className="rounded-xl border border-neutral-200/60 p-4">
                      {(() => {
                        const profileBadge = getUserProfileBadge(user.profile_type);

                        return (
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-neutral-900">{user.name ?? 'Unnamed user'}</p>
                          <p className="text-xs text-neutral-500">User ID: {user.id}</p>
                          <p className="text-sm text-neutral-600">{user.email ?? 'No email available'}</p>
                          <p className="text-sm text-neutral-600">{user.phone ?? 'No phone available'}</p>
                          <p className="text-sm text-neutral-600">{user.address ?? 'No address available'}</p>
                          <p className="text-xs text-neutral-500">
                            {user.gender ?? '—'} • {user.age ?? '—'} years • Joined {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {user.profile_type === 'customer' ? (
                            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700">
                              Pets: {user.pets.length}
                            </span>
                          ) : (
                            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-500">
                              Pets: N/A
                            </span>
                          )}
                          <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', profileBadge.className)}>
                            {profileBadge.label}
                          </span>
                        </div>
                      </div>
                        );
                      })()}

                      {user.profile_type === 'customer' ? (
                        <div className="mt-4 rounded-lg border border-neutral-200/60 bg-neutral-50 p-3">
                          <p className="text-sm font-semibold text-neutral-900">Pet Information</p>
                          {user.pets.length === 0 ? (
                            <p className="mt-2 text-sm text-neutral-500">No pets added yet.</p>
                          ) : (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {user.pets.map((pet) => (
                                <div key={pet.id} className="rounded-lg border border-neutral-200/60 bg-white p-3">
                                  <p className="text-sm font-semibold text-neutral-900">{pet.name}</p>
                                  <p className="text-xs text-neutral-600">
                                    {pet.breed ?? 'Breed not set'} • {pet.gender ?? 'Gender not set'} • {pet.age ?? '—'} years
                                  </p>
                                  <p className="text-xs text-neutral-500">
                                    {pet.size_category ?? 'Size n/a'} • {pet.energy_level ?? 'Energy n/a'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </section>
      ) : null}

      {isProvidersView ? (
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-section-title">Provider Management</h2>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs font-semibold',
                  schemaSyncHealth === null
                    ? 'border-neutral-300 bg-neutral-100 text-neutral-700'
                    : schemaSyncHealth.healthy
                    ? 'border-green-300 bg-green-100 text-green-700'
                    : 'border-red-300 bg-red-100 text-red-700',
                )}
              >
                {schemaSyncHealth?.healthy ? 'Schema Healthy' : schemaSyncHealth ? 'Schema Unhealthy' : 'Schema Not Checked'}
              </span>
            </div>
            <p className="text-muted">Review, approve, and manage provider profiles, documentation, and service locations</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setIsOnboardingModalOpen(true)}
              disabled={isPending}
            >
              + Onboard New Provider
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-card-title">Provider Management Control Center</h3>
              <p className="text-muted">Search providers and inspect their day-wise schedule in one unified workspace.</p>
            </div>

            <div className="space-y-4 rounded-xl border border-neutral-200/60 bg-neutral-50/50 p-4">
              <Input
                type="search"
                placeholder="Search by name, ID, email, city..."
                value={providerSearchQuery}
                onChange={(e) => setProviderSearchQuery(e.target.value)}
                label="Search Providers"
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-neutral-700 block mb-2">Provider Type</label>
                  <select
                    value={providerTypeFilter}
                    onChange={(e) => setProviderTypeFilter(e.target.value as typeof providerTypeFilter)}
                    className="input-field w-full"
                  >
                    <option value="all">All Types</option>
                    <option value="clinic">Clinics/Centers</option>
                    <option value="home_visit">Home Visit Professionals</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-neutral-700 block mb-2">Approval Status</label>
                  <select
                    value={providerStatusFilter}
                    onChange={(e) => setProviderStatusFilter(e.target.value as typeof providerStatusFilter)}
                    className="input-field w-full"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setProviderSearchQuery('');
                      setProviderTypeFilter('all');
                      setProviderStatusFilter('all');
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>

              <p className="text-sm text-neutral-600">
                Showing <span className="font-semibold">{filteredProviders.length}</span> of{' '}
                <span className="font-semibold">{providerRows.length}</span> providers
              </p>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-800">Provider Quick View</p>
                {filteredProviders.length === 0 ? (
                  <p className="text-xs text-neutral-500">No providers to preview with current filters.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filteredProviders.slice(0, 12).map((provider) => {
                      const isProviderExpanded = expandedProviderIds.includes(provider.id);

                      return (
                        <button
                          key={`provider-chip-${provider.id}`}
                          type="button"
                          onClick={() => focusProviderCard(provider.id)}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition-colors',
                            isProviderExpanded
                              ? 'border-neutral-300 bg-white text-neutral-900'
                              : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-white',
                          )}
                        >
                          {provider.profile_photo_url ? (
                            <span className="relative h-6 w-6 overflow-hidden rounded-full border border-neutral-200/70 bg-neutral-100">
                              <StorageBackedImage
                                value={provider.profile_photo_url}
                                bucket="user-photos"
                                alt={provider.name}
                                fill
                                className="object-cover"
                              />
                            </span>
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200/70 bg-neutral-100 text-[10px] font-semibold text-neutral-600">
                              {(provider.name?.trim().charAt(0) || 'P').toUpperCase()}
                            </span>
                          )}
                          <span className="max-w-[11rem] truncate">{provider.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-neutral-200/60 bg-neutral-50/50 p-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-neutral-900">Provider Schedule Calendar</h4>
                <p className="text-xs text-neutral-600">Day-wise provider availability with live booking status overlays.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-sm font-medium text-neutral-700 block mb-2">Selected Provider</label>
                  <select
                    value={calendarProviderId}
                    onChange={(event) => setCalendarProviderId(event.target.value ? Number(event.target.value) : '')}
                    className="input-field w-full"
                  >
                    <option value="">Select from searched providers</option>
                    {calendarSelectableProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  type="date"
                  label="From Date"
                  value={calendarFromDate}
                  onChange={(event) => setCalendarFromDate(event.target.value)}
                />
                <div>
                  <label className="text-sm font-medium text-neutral-700 block mb-2">Range</label>
                  <select
                    value={calendarDays}
                    onChange={(event) => setCalendarDays((event.target.value === '14' ? 14 : 7) as 7 | 14)}
                    className="input-field w-full"
                  >
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => void fetchProviderCalendar()}
                    disabled={isPending || isCalendarLoading}
                    className="w-full"
                  >
                    {isCalendarLoading ? 'Loading…' : 'Refresh Calendar'}
                  </Button>
                </div>
              </div>

              {!calendarProviderId ? (
                <p className="text-body text-neutral-500 text-center py-6">
                  Search providers above, then select one to load the schedule calendar.
                </p>
              ) : (isCalendarLoading && (!providerCalendar || isCalendarStale)) ? (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-500 rounded-lg border border-neutral-200/60 bg-white px-3 py-2">
                    Loading schedule for {selectedCalendarProviderName ?? 'selected provider'}…
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: calendarSkeletonCardCount }, (_, index) => (
                      <div key={`calendar-skeleton-${index}`} className="rounded-xl border border-neutral-200/60 bg-white p-3 shadow-sm animate-pulse">
                        <div className="h-4 w-24 rounded bg-neutral-200/70" />
                        <div className="mt-2 h-3 w-12 rounded bg-neutral-200/60" />
                        <div className="mt-4 h-3 w-20 rounded bg-neutral-200/60" />
                        <div className="mt-2 space-y-1">
                          <div className="h-3 rounded bg-neutral-200/60" />
                          <div className="h-3 rounded bg-neutral-200/50" />
                        </div>
                        <div className="mt-4 h-3 w-16 rounded bg-neutral-200/60" />
                        <div className="mt-2 space-y-2">
                          <div className="h-8 rounded bg-neutral-200/55" />
                          <div className="h-8 rounded bg-neutral-200/45" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !providerCalendar ? (
                <p className="text-body text-neutral-500 text-center py-6">
                  {isCalendarLoading ? 'Loading provider calendar…' : 'Choose a provider to view schedule calendar.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {isCalendarLoading ? (
                    <p className="text-xs text-neutral-500 rounded-lg border border-neutral-200/60 bg-white px-3 py-2">
                      Refreshing schedule for {selectedCalendarProviderName ?? providerCalendar.provider.name}…
                    </p>
                  ) : null}
                  <p className="text-xs text-neutral-500 rounded-lg border border-neutral-200/60 bg-white px-3 py-2">
                    Showing {providerCalendar.provider.name} • {providerCalendar.fromDate} to {providerCalendar.toDate}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {providerCalendar.days.map((day) => (
                      <div key={day.date} className="rounded-xl border border-neutral-200/60 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">{day.date}</p>
                            <p className="text-xs text-neutral-500">
                              {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
                            </p>
                          </div>
                          <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                            {day.bookings.length} bookings
                          </span>
                        </div>

                        <div className="mt-3">
                          <p className="text-[11px] font-semibold text-neutral-700">Availability</p>
                          {day.availability.length === 0 ? (
                            <p className="mt-1 text-[11px] text-neutral-500">No slots</p>
                          ) : (
                            <ul className="mt-1 space-y-1">
                              {day.availability.map((slot) => (
                                <li key={slot.id} className="flex items-center justify-between text-[11px]">
                                  <span className="text-neutral-700">{slot.start_time} - {slot.end_time}</span>
                                  <span
                                    className={cn(
                                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                      slot.is_available
                                        ? 'border-green-300 bg-green-100 text-green-700'
                                        : 'border-neutral-300 bg-neutral-100 text-neutral-600',
                                    )}
                                  >
                                    {slot.is_available ? 'Open' : 'Closed'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="mt-3 border-t border-neutral-200/60 pt-2">
                          <p className="text-[11px] font-semibold text-neutral-700">Bookings</p>
                          {day.bookings.length === 0 ? (
                            <p className="mt-1 text-[11px] text-neutral-500">No bookings</p>
                          ) : (
                            <ul className="mt-1 space-y-2">
                              {day.bookings.map((booking) => (
                                <li key={booking.id} className="rounded-lg border border-neutral-200/60 bg-neutral-50/70 p-2">
                                  <p className="text-[11px] font-medium text-neutral-800">#{booking.id}</p>
                                  <p className="text-[11px] text-neutral-600">
                                    {(booking.start_time ?? '—')} - {(booking.end_time ?? '—')} • {(booking.service_type ?? 'Service')}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-1">
                                    <StatusBadge status={booking.status} />
                                    {booking.status === 'confirmed' && booking.completion_task_status === 'pending' ? (
                                      <Alert variant="warning" className="!p-1 !text-[10px]">Feedback Pending</Alert>
                                    ) : null}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {filteredProviders.length === 0 ? (
            <Card>
              <p className="text-body text-neutral-500 text-center py-8">
                {providerSearchQuery || providerTypeFilter !== 'all' || providerStatusFilter !== 'all' 
                  ? 'No providers match your search criteria' 
                  : 'No providers found'}
              </p>
            </Card>
          ) : (
            filteredProviders.map((provider) => {
              const serviceDraftRow = serviceDraft[provider.id] ?? {
                id: undefined,
                service_pincodes: '',
              };
              const providerAvailabilityRows = availabilityByProvider[provider.id] ?? [];
              const providerServicesRows = servicesByProvider[provider.id] ?? [];
              const isProviderExpanded = expandedProviderIds.includes(provider.id);
              const isProviderDetailsLoading = providerDetailsLoadingById[provider.id] ?? false;
              const isProviderDetailsLoaded = providerDetailsLoadedById[provider.id] ?? false;
              const isEditingLocation = Boolean(locationDraft[provider.id]);
              const locationDraftRow = locationDraft[provider.id] ?? {
                address: provider.address ?? '',
                city: provider.city ?? '',
                state: provider.state ?? '',
                pincode: provider.pincode ?? '',
                latitude: provider.latitude === null ? '' : String(provider.latitude),
                longitude: provider.longitude === null ? '' : String(provider.longitude),
                service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
              };
              const availabilityRowDraft = availabilityDraft[provider.id] ?? getDefaultAvailabilityDraft();
              const coveragePincodes = Array.from(
                new Set(
                  providerServicesRows.flatMap((service) => pincodesByService[service.id] ?? []),
                ),
              );
              const localCoverageWarnings: string[] = [];

              if (coveragePincodes.length > 0) {
                const clinicPincode = provider.pincode?.trim() ?? null;
                const serviceRadius = provider.service_radius_km;
                const nonClinicCoverageCount = clinicPincode
                  ? coveragePincodes.filter((item) => item !== clinicPincode).length
                  : coveragePincodes.length;

                if (!clinicPincode && serviceRadius === null) {
                  localCoverageWarnings.push('Service pincodes are configured, but clinic pincode and service radius are missing.');
                }

                if (clinicPincode && serviceRadius !== null && serviceRadius <= 0 && nonClinicCoverageCount > 0) {
                  localCoverageWarnings.push('Service radius is 0 km, but enabled service pincodes extend beyond clinic pincode.');
                }

                if (serviceRadius !== null && serviceRadius <= 2 && nonClinicCoverageCount >= 3) {
                  localCoverageWarnings.push('Service radius is very small for the current pincode rollout footprint.');
                }

                if (serviceRadius === null && coveragePincodes.length >= 10) {
                  localCoverageWarnings.push('Large pincode rollout is configured without a service radius baseline.');
                }
              }

              const effectiveCoverageWarnings =
                locationCoverageWarnings[provider.id] && locationCoverageWarnings[provider.id].length > 0
                  ? locationCoverageWarnings[provider.id]
                  : localCoverageWarnings;
              const providerServiceTypeOptions = Array.from(
                new Set(
                  [
                    ...availableServiceTypes,
                    ...providerServicesRows.map((service) => service.service_type),
                  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
                ),
              ).sort();
              const selectedServiceTypes = selectedServiceTypesByProvider[provider.id] ?? providerServicesRows.map((service) => service.service_type);
              const normalizedSelectedServiceTypes = new Set(
                selectedServiceTypes.map((value) => value.trim()).filter((value) => value.length > 0),
              );
              const isEditingProviderProfile = Boolean(providerProfileDraft[provider.id]);
              const providerProfileDraftRow = providerProfileDraft[provider.id] ?? {
                name: provider.name ?? '',
                email: provider.email ?? '',
                provider_type: provider.provider_type ?? '',
                business_name: provider.business_name ?? '',
                profile_photo_url: provider.profile_photo_url ?? '',
                service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
              };
              const lastAutoFixNote = locationLastAutoFixNote[provider.id] ?? null;

              return (
                <div
                  key={provider.id}
                  ref={(node) => {
                    providerCardRefs.current[provider.id] = node;
                  }}
                >
                <Card className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {provider.profile_photo_url ? (
                        <div className="relative h-12 w-12 overflow-hidden rounded-full border border-neutral-200/70 bg-neutral-100">
                          <StorageBackedImage
                            value={provider.profile_photo_url}
                            bucket="user-photos"
                            alt={provider.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200/70 bg-neutral-100 text-sm font-semibold text-neutral-600">
                          {(provider.name?.trim().charAt(0) || 'P').toUpperCase()}
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="font-semibold text-neutral-900">Provider #{provider.id} • {provider.name}</p>
                        <p className="text-sm text-neutral-600">
                          Type: <span className="font-medium capitalize">{provider.provider_type.replace(/_/g, ' ')}</span> •
                          {' '}Approval: <span className="font-medium capitalize">{provider.admin_approval_status}</span> •
                          {' '}Account: <span className="font-medium capitalize">{provider.account_status}</span>
                        </p>
                        <p className="text-xs text-neutral-500">
                          Documents → Pending: {provider.documentCounts.pending} | Approved: {provider.documentCounts.approved} | Rejected: {provider.documentCounts.rejected}
                        </p>
                        {isProviderDetailsLoaded && providerServicesRows.length > 0 && (
                          <p className="text-xs text-neutral-500">
                            Services: {providerServicesRows.filter(s => s.is_active).length} active, {providerServicesRows.filter(s => !s.is_active).length} inactive
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            copyProviderProfileIntoDraft(provider);
                            if (!isProviderExpanded) {
                              toggleProviderCard(provider.id);
                            }
                          }}
                          disabled={isPending}
                        >
                          Edit Provider
                        </Button>
                        <Button
                          size="sm"
                          variant={provider.account_status === 'active' ? 'danger' : 'secondary'}
                          onClick={() => moderateProvider(provider.id, provider.account_status === 'active' ? 'disable' : 'enable')}
                          disabled={isPending}
                        >
                          {provider.account_status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeProvider(provider.id)}
                          disabled={deletingProviderId === provider.id}
                        >
                          {deletingProviderId === provider.id ? 'Deleting…' : 'Delete'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleProviderCard(provider.id)}
                          disabled={isPending}
                        >
                          {isProviderExpanded ? 'Hide Details' : 'Load Details'}
                        </Button>
                      </div>
                      {providerServicesRows.length > 0 && (
                        <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => toggleProviderServices(provider.id, true)}
                            disabled={isPending || providerServicesRows.every(s => s.is_active)}
                          >
                            🟢 Enable All Services
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleProviderServices(provider.id, false)}
                            disabled={isPending || providerServicesRows.every(s => !s.is_active)}
                          >
                            🔴 Disable All Services
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isProviderExpanded ? (
                  <>
                  <div className="space-y-3 pt-4 border-t border-neutral-200/60">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="font-semibold text-neutral-900">Provider Profile</p>
                      {!isEditingProviderProfile ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyProviderProfileIntoDraft(provider)}
                          disabled={isPending}
                        >
                          Edit
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => saveProviderProfile(provider.id)}
                            disabled={isPending}
                          >
                            Save Profile
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelProviderProfileEdit(provider.id)}
                            disabled={isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>

                    {isEditingProviderProfile ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label="Provider Name"
                          value={providerProfileDraftRow.name}
                          onChange={(event) => setProviderProfileDraftField(provider.id, 'name', event.target.value)}
                          placeholder="Provider name"
                        />
                        <Input
                          label="Email"
                          value={providerProfileDraftRow.email}
                          onChange={(event) => setProviderProfileDraftField(provider.id, 'email', event.target.value)}
                          placeholder="provider@email.com"
                        />
                        <Input
                          label="Provider Type"
                          value={providerProfileDraftRow.provider_type}
                          onChange={(event) => setProviderProfileDraftField(provider.id, 'provider_type', event.target.value)}
                          placeholder="clinic / groomer / custom_type"
                        />
                        <Input
                          label="Business Name"
                          value={providerProfileDraftRow.business_name}
                          onChange={(event) => setProviderProfileDraftField(provider.id, 'business_name', event.target.value)}
                          placeholder="Business name"
                        />
                        <Input
                          label="Service Radius (km)"
                          value={providerProfileDraftRow.service_radius_km}
                          onChange={(event) => setProviderProfileDraftField(provider.id, 'service_radius_km', event.target.value)}
                          placeholder="Optional"
                        />
                        <ImageUploadField
                          label="Provider Photo"
                          value={providerProfileDraftRow.profile_photo_url}
                          onChange={(url) => setProviderProfileDraftField(provider.id, 'profile_photo_url', url)}
                          bucket="user-photos"
                          placeholder="Upload provider photo"
                          disabled={isPending}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm text-neutral-600">
                        <p>
                          Email: <span className="font-medium">{provider.email || 'Not set'}</span>
                        </p>
                        <p>
                          Business: <span className="font-medium">{provider.business_name || 'Not set'}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-neutral-200/60">
                    {isProviderDetailsLoading ? (
                      <div className="rounded-lg border border-neutral-200/60 bg-neutral-50 p-3 text-sm text-neutral-600">
                        Loading provider details…
                      </div>
                    ) : null}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="font-semibold text-neutral-900">Location Moderation</p>
                      {!isEditingLocation ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyLocationIntoDraft(provider)}
                          disabled={isPending}
                        >
                          Edit
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelLocationEdit(provider.id)}
                          disabled={isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-1 text-sm text-neutral-600">
                      <p>
                        Current: <span className="font-medium">{[provider.address, provider.city, provider.state, provider.pincode].filter(Boolean).join(', ') || 'Not set'}</span>
                      </p>
                      <p>
                        Coordinates: <span className="font-medium">{provider.latitude ?? '—'}, {provider.longitude ?? '—'}</span> • 
                        Radius: <span className="font-medium">{provider.service_radius_km ?? '—'} km</span>
                      </p>
                    </div>

                    {effectiveCoverageWarnings.length > 0 ? (
                      <Alert variant="warning" className="space-y-3">
                        {effectiveCoverageWarnings.map((warning, warningIndex) => (
                          <div key={`${provider.id}:${warningIndex}:${warning}`} className="border-t border-neutral-300/60 pt-2 last:border-t-0 last:pt-0">
                            <p className="text-sm">⚠ {warning}</p>
                            <p className="text-xs text-neutral-800 mt-1">→ {locationWarningSuggestion(warning)}</p>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => applyLocationWarningSuggestion(provider, warning, coveragePincodes)}
                              disabled={isPending}
                              className="mt-2"
                            >
                              {locationWarningActionLabel(warning)}
                            </Button>
                          </div>
                        ))}
                      </Alert>
                    ) : null}

                    {lastAutoFixNote ? (
                      <div className="rounded-lg border border-neutral-200/60 bg-neutral-50/50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-neutral-700">{lastAutoFixNote}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => dismissLocationAutoFixNote(provider.id)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {isEditingLocation ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            value={locationDraftRow.address}
                            onChange={(event) => setLocationDraftField(provider.id, 'address', event.target.value)}
                            placeholder="Address"
                            label="Address"
                            className="sm:col-span-2"
                          />
                          <Input
                            value={locationDraftRow.city}
                            onChange={(event) => setLocationDraftField(provider.id, 'city', event.target.value)}
                            placeholder="City"
                            label="City"
                          />
                          <Input
                            value={locationDraftRow.state}
                            onChange={(event) => setLocationDraftField(provider.id, 'state', event.target.value)}
                            placeholder="State"
                            label="State"
                          />
                          <Input
                            value={locationDraftRow.pincode}
                            onChange={(event) => setLocationDraftField(provider.id, 'pincode', event.target.value)}
                            placeholder="Pincode"
                            label="Pincode"
                          />
                          <Input
                            value={locationDraftRow.service_radius_km}
                            onChange={(event) => setLocationDraftField(provider.id, 'service_radius_km', event.target.value)}
                            placeholder="Service radius (km)"
                            label="Service Radius (km)"
                          />
                          <Input
                            value={locationDraftRow.latitude}
                            onChange={(event) => setLocationDraftField(provider.id, 'latitude', event.target.value)}
                            placeholder="Latitude"
                            label="Latitude"
                          />
                          <Input
                            value={locationDraftRow.longitude}
                            onChange={(event) => setLocationDraftField(provider.id, 'longitude', event.target.value)}
                            placeholder="Longitude"
                            label="Longitude"
                          />
                        </div>

                        <Button
                          onClick={() => saveProviderLocation(provider.id)}
                          disabled={isPending}
                        >
                          Save Location
                        </Button>
                      </>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-xl border border-neutral-200/60 p-3">
                    <p className="text-xs font-semibold text-neutral-950">Availability Control</p>
                    {providerAvailabilityRows.length === 0 ? (
                      <p className="mt-2 text-xs text-neutral-600">No availability windows configured yet.</p>
                    ) : (
                      <ul className="mt-2 grid gap-2">
                        {providerAvailabilityRows.map((slot) => (
                          <li key={slot.id} className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                            <span>
                              {weekdayLabel(slot.day_of_week)} • {slot.start_time} - {slot.end_time}
                            </span>
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={slot.is_available}
                                onChange={(event) => toggleAvailabilitySlot(provider.id, slot.id, event.target.checked)}
                              />
                              Enabled
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 space-y-2">
                      <label className="text-sm font-medium text-neutral-700 block">Weekdays</label>
                      <div className="grid gap-2 sm:grid-cols-4">
                        {WEEKDAY_OPTIONS.map((option) => (
                          <label key={option.value} className="inline-flex items-center gap-2 rounded-md border border-neutral-200/60 bg-neutral-50/60 px-2 py-1 text-xs text-neutral-700">
                            <input
                              type="checkbox"
                              checked={availabilityRowDraft.selected_days.includes(option.value)}
                              onChange={(event) => toggleAvailabilityDraftWeekday(provider.id, option.value, event.target.checked)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Input
                        label="Start Time"
                        value={availabilityRowDraft.start_time}
                        onChange={(event) => setAvailabilityDraftField(provider.id, 'start_time', event.target.value)}
                        placeholder="Start (HH:MM)"
                      />
                      <Input
                        label="End Time"
                        value={availabilityRowDraft.end_time}
                        onChange={(event) => setAvailabilityDraftField(provider.id, 'end_time', event.target.value)}
                        placeholder="End (HH:MM)"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => appendAvailabilitySlot(provider.id)}
                      disabled={isPending}
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                    >
                      Add Availability Slot
                    </Button>
                  </div>

                  <div className="mt-4 rounded-xl border border-neutral-200/60 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-950">Service & Pincode Rollout</p>
                        <p className="mt-1 text-xs text-neutral-600">Configure pricing, coverage, and rollout per service for this provider.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                          Total: {providerServicesRows.length}
                        </span>
                        <span className="rounded-full border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                          Active: {providerServicesRows.filter((item) => item.is_active).length}
                        </span>
                        <span className="rounded-full border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                          Disabled: {providerServicesRows.filter((item) => !item.is_active).length}
                        </span>
                      </div>
                    </div>

                    {providerServicesRows.length === 0 ? (
                      <div className="mt-3 rounded-lg border border-dashed border-neutral-200/80 bg-neutral-50/70 p-3">
                        <p className="text-xs text-neutral-600">No services configured yet. Use the form below to add the first service.</p>
                      </div>
                    ) : (
                      <ul className="mt-3 grid gap-2 lg:grid-cols-2">
                        {providerServicesRows.map((service) => (
                          <li key={service.id} className="rounded-lg border border-neutral-200/60 bg-neutral-50/40 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-neutral-950">{service.service_type}</p>
                                <p className="mt-1 text-xs text-neutral-600">
                                  Base ₹{service.base_price}
                                  {service.surge_price !== null ? ` • Surge ₹${service.surge_price}` : ''}
                                  {service.commission_percentage !== null ? ` • Commission ${service.commission_percentage}%` : ''}
                                </p>
                                <p className="text-xs text-neutral-600">
                                  Duration: {service.service_duration_minutes ?? '—'} mins
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                    service.is_active
                                      ? 'border-green-300 bg-green-100 text-green-700'
                                      : 'border-neutral-300 bg-neutral-100 text-neutral-600',
                                  )}
                                >
                                  {service.is_active ? 'Active' : 'Disabled'}
                                </span>
                                <Button
                                  type="button"
                                  onClick={() => copyServiceIntoDraft(provider.id, service.id)}
                                  variant="secondary"
                                  size="sm"
                                >
                                  Edit
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 rounded-md border border-neutral-200/60 bg-white px-2 py-1.5">
                              <p className="text-[11px] text-neutral-600">
                                Pincodes: {(pincodesByService[service.id] ?? []).join(', ') || 'Not mapped'}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-4 rounded-lg border border-neutral-200/70 bg-neutral-50/50 p-3">
                      <p className="text-xs font-semibold text-neutral-900">Add / Update Service Rollout</p>
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-neutral-600">Tick services to rollout for this provider.</p>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAllProviderServiceSelections(provider.id, providerServiceTypeOptions, true)}
                              disabled={isPending || providerServiceTypeOptions.length === 0}
                            >
                              Select All
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAllProviderServiceSelections(provider.id, providerServiceTypeOptions, false)}
                              disabled={isPending || providerServiceTypeOptions.length === 0}
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {providerServiceTypeOptions.length === 0 ? (
                            <p className="text-xs text-neutral-500">No services available.</p>
                          ) : (
                            providerServiceTypeOptions.map((serviceType) => (
                              <label
                                key={serviceType}
                                className="inline-flex items-center gap-2 rounded-md border border-neutral-200/60 bg-white px-2 py-1.5 text-xs text-neutral-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={normalizedSelectedServiceTypes.has(serviceType)}
                                  onChange={(event) =>
                                    toggleProviderServiceSelection(
                                      provider.id,
                                      serviceType,
                                      event.target.checked,
                                      providerServiceTypeOptions,
                                      providerServicesRows,
                                    )
                                  }
                                />
                                {serviceType}
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium text-neutral-700 mb-2">Selected Services</p>
                          <p className="rounded-md border border-neutral-200/60 bg-white px-3 py-2 text-xs text-neutral-600">
                            {normalizedSelectedServiceTypes.size} selected
                          </p>
                        </div>
                      </div>
                      <Input
                        label="Service Pincodes"
                        value={serviceDraftRow.service_pincodes}
                        onChange={(event) => setServiceDraftField(provider.id, 'service_pincodes', event.target.value)}
                        placeholder="Optional, applies to selected services"
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-neutral-600">This section only enables selected services and applies coverage pincodes. Pricing and commission are managed in Services and Provider setup.</p>
                        <Button
                          type="button"
                          onClick={() => submitServiceRollout(provider.id, providerServiceTypeOptions, providerServicesRows)}
                          disabled={isPending}
                          variant="secondary"
                          size="sm"
                        >
                          Apply Selected Services
                        </Button>
                      </div>
                    </div>
                  </div>
                  </>
                  ) : null}
                </Card>
                </div>
              );
            })
          )}
        </div>
      </section>
      ) : null}

      {isServicesView ? (
      <section className="rounded-2xl border border-neutral-200/60 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-neutral-950">Service Catalog Management</h2>
          <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', schemaHealthBadgeClass)}>
            {schemaHealthBadgeLabel}
          </span>
          <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', functionalHealthBadgeClass)}>
            {functionalHealthBadgeLabel}
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-600">Control service availability and rollout new services across the platform.</p>

        <div className="mt-4 rounded-xl border border-neutral-200/60 p-3">
          <p className="text-xs font-semibold text-neutral-950">Service Catalog Control</p>
          {serviceSummary.length === 0 ? (
            <p className="mt-2 text-xs text-[#6b6b6b]">No services found yet.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {serviceSummary.map((service) => (
                <li key={service.service_type} className="rounded-lg border border-neutral-200/60 p-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-neutral-950">
                      {service.service_type} • Providers: {service.provider_count} • Active: {service.active_count} • Inactive:{' '}
                      {service.inactive_count} • Avg Price: ₹{service.average_base_price}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => setServiceActivation(service.service_type, true)}
                        disabled={isPending}
                        variant="secondary"
                        size="sm"
                      >
                        Enable
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setServiceActivation(service.service_type, false)}
                        disabled={isPending}
                        variant="ghost"
                        size="sm"
                      >
                        Disable
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-neutral-200/60 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-950">Global Service Rollout</p>
              <p className="mt-1 text-xs text-neutral-600">Deploy a service configuration across selected providers or the full network.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                Service Types: {availableServiceTypes.length}
              </span>
              <span className="rounded-full border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                Saves as Active
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-neutral-200/70 bg-neutral-50/50 p-3">
            <p className="text-xs font-semibold text-neutral-900">Rollout Configuration</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-2">Available Service</label>
                <select
                  value={globalServiceDraft.service_type}
                  onChange={(event) => setGlobalServiceDraftField('service_type', event.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Select a service</option>
                  {availableServiceTypes.map((serviceType) => (
                    <option key={serviceType} value={serviceType}>
                      {serviceType}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Base Price"
                value={globalServiceDraft.base_price}
                onChange={(event) => setGlobalServiceDraftField('base_price', event.target.value)}
                placeholder="0"
              />
              <Input
                label="Surge Price"
                value={globalServiceDraft.surge_price}
                onChange={(event) => setGlobalServiceDraftField('surge_price', event.target.value)}
                placeholder="Optional"
              />
              <Input
                label="Commission %"
                value={globalServiceDraft.commission_percentage}
                onChange={(event) => setGlobalServiceDraftField('commission_percentage', event.target.value)}
                placeholder="Optional"
              />
              <Input
                label="Duration (minutes)"
                value={globalServiceDraft.service_duration_minutes}
                onChange={(event) => setGlobalServiceDraftField('service_duration_minutes', event.target.value)}
                placeholder="e.g. 60"
              />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Input
                label="Service Pincodes"
                value={globalServiceDraft.service_pincodes}
                onChange={(event) => setGlobalServiceDraftField('service_pincodes', event.target.value)}
                placeholder="Indian pincodes (comma separated)"
              />
              <Input
                label="Target Provider IDs"
                value={globalServiceDraft.provider_ids}
                onChange={(event) => setGlobalServiceDraftField('provider_ids', event.target.value)}
                placeholder="Optional, comma separated"
              />
            </div>
            <label className={cn('mt-2', adminToggleFieldClass)}>
              <input
                type="checkbox"
                checked={globalServiceDraft.overwrite_existing}
                onChange={(event) => setGlobalServiceDraftField('overwrite_existing', event.target.checked)}
              />
              Overwrite existing service config for targeted providers
            </label>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-neutral-600">If no provider IDs are entered, rollout applies to all providers.</p>
              <Button
                type="button"
                onClick={rolloutGlobalService}
                disabled={isPending}
                variant="secondary"
                size="sm"
              >
                Rollout Service Globally
              </Button>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {isServicesView ? (
      <section className="rounded-2xl border border-neutral-200/60 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-950">Offers & Discounts</h2>
        <p className="mt-1 text-xs text-neutral-600">Create, manage, and track promotional offers and discount codes.</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-neutral-200/60 p-3 text-xs">
            <p className="text-neutral-600">Total Discounts</p>
            <p className="mt-1 text-sm font-semibold text-neutral-950">{discountAnalytics.total_discounts}</p>
          </div>
          <div className="rounded-xl border border-neutral-200/60 p-3 text-xs">
            <p className="text-neutral-600">Active Discounts</p>
            <p className="mt-1 text-sm font-semibold text-neutral-950">{discountAnalytics.total_active_discounts}</p>
          </div>
          <div className="rounded-xl border border-neutral-200/60 p-3 text-xs">
            <p className="text-neutral-600">Total Redemptions</p>
            <p className="mt-1 text-sm font-semibold text-neutral-950">{discountAnalytics.total_redemptions}</p>
          </div>
          <div className="rounded-xl border border-neutral-200/60 p-3 text-xs">
            <p className="text-neutral-600">Booking Redemption Rate</p>
            <p className="mt-1 text-sm font-semibold text-neutral-950">{discountAnalytics.booking_redemption_rate}%</p>
          </div>
        </div>
        <div className="mt-2 rounded-xl border border-neutral-200/60 p-3 text-xs text-neutral-600">
          Total discount amount issued: <span className="font-semibold text-neutral-950">₹{discountAnalytics.total_discount_amount}</span>
          {discountAnalytics.top_discounts.length > 0 ? (
            <span>
              {' '}
              • Top codes:{' '}
              {discountAnalytics.top_discounts
                .map((item) => `${item.code} (${item.redemption_count})`)
                .join(', ')}
            </span>
          ) : null}
        </div>

        <div className="mt-4 rounded-xl border border-neutral-200/60 p-3">
          <p className="text-xs font-semibold text-neutral-950">Create / Update Discount</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              value={discountDraft.code}
              onChange={(event) => setDiscountDraftField('code', event.target.value.toUpperCase())}
              placeholder="Code (e.g. PET20)"
              className={adminRawFieldClass}
              disabled={Boolean(discountDraft.id)}
            />
            <input
              value={discountDraft.title}
              onChange={(event) => setDiscountDraftField('title', event.target.value)}
              placeholder="Title"
              className={adminRawFieldClass}
            />
            <select
              value={discountDraft.discount_type}
              onChange={(event) => setDiscountDraftField('discount_type', event.target.value as 'percentage' | 'flat')}
              className={adminRawFieldClass}
            >
              <option value="percentage">Percentage</option>
              <option value="flat">Flat</option>
            </select>
            <input
              value={discountDraft.discount_value}
              onChange={(event) => setDiscountDraftField('discount_value', event.target.value)}
              placeholder="Discount value"
              className={adminRawFieldClass}
            />
            <input
              value={discountDraft.max_discount_amount}
              onChange={(event) => setDiscountDraftField('max_discount_amount', event.target.value)}
              placeholder="Max discount amount"
              className={adminRawFieldClass}
            />
            <input
              value={discountDraft.min_booking_amount}
              onChange={(event) => setDiscountDraftField('min_booking_amount', event.target.value)}
              placeholder="Min booking amount"
              className={adminRawFieldClass}
            />
            <input
              value={discountDraft.applies_to_service_type}
              onChange={(event) => setDiscountDraftField('applies_to_service_type', event.target.value)}
              placeholder="Service type (optional)"
              className={adminRawFieldClass}
            />
            <input
              type="datetime-local"
              value={discountDraft.valid_from}
              onChange={(event) => setDiscountDraftField('valid_from', event.target.value)}
              className={adminRawFieldClass}
            />
            <input
              type="datetime-local"
              value={discountDraft.valid_until}
              onChange={(event) => setDiscountDraftField('valid_until', event.target.value)}
              className={adminRawFieldClass}
            />
            <input
              value={discountDraft.usage_limit_total}
              onChange={(event) => setDiscountDraftField('usage_limit_total', event.target.value)}
              placeholder="Usage limit total"
              className={adminRawFieldClass}
            />
            <input
              value={discountDraft.usage_limit_per_user}
              onChange={(event) => setDiscountDraftField('usage_limit_per_user', event.target.value)}
              placeholder="Usage limit per user"
              className={adminRawFieldClass}
            />
            <label className={adminToggleFieldClass}>
              <input
                type="checkbox"
                checked={discountDraft.first_booking_only}
                onChange={(event) => setDiscountDraftField('first_booking_only', event.target.checked)}
              />
              First Booking Only
            </label>
            <label className={adminToggleFieldClass}>
              <input
                type="checkbox"
                checked={discountDraft.is_active}
                onChange={(event) => setDiscountDraftField('is_active', event.target.checked)}
              />
              Discount Active
            </label>
          </div>
          <textarea
            value={discountDraft.description}
            onChange={(event) => setDiscountDraftField('description', event.target.value)}
            placeholder="Description"
            rows={2}
            className={cn('mt-2 w-full', adminRawFieldClass)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={saveDiscount}
              disabled={isPending}
              variant="secondary"
              size="sm"
            >
              {discountDraft.id ? 'Update Discount' : 'Create Discount'}
            </Button>
            {discountDraft.id ? (
              <Button
                type="button"
                onClick={resetDiscountDraft}
                disabled={isPending}
                variant="ghost"
                size="sm"
              >
                Clear Edit
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-neutral-200/60 p-3">
          <p className="text-xs font-semibold text-neutral-950">Existing Discounts</p>
          {discounts.length === 0 ? (
            <p className="mt-2 text-xs text-neutral-600">No discounts configured yet.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {discounts.map((discount) => (
                <li key={discount.id} className="rounded-lg border border-neutral-200/60 p-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-neutral-950">
                      {discount.code} • {discount.title} • {discount.discount_type} {discount.discount_value}
                    </p>
                    <span className="rounded-full border border-neutral-200/60 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-950">
                      {discount.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-600">
                    Valid: {new Date(discount.valid_from).toLocaleString()} -{' '}
                    {discount.valid_until ? new Date(discount.valid_until).toLocaleString() : 'No expiry'}
                  </p>
                  {discount.first_booking_only ? (
                    <p className="mt-1 text-[11px] font-medium text-neutral-950">Applies to first booking only</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => loadDiscountInDraft(discount)}
                      disabled={isPending}
                      variant="secondary"
                      size="sm"
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      onClick={() => toggleDiscount(discount.id, !discount.is_active)}
                      disabled={isPending}
                      variant="ghost"
                      size="sm"
                    >
                      {discount.is_active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => removeDiscount(discount.id)}
                      disabled={isPending}
                      variant="ghost"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      ) : null}

      {!canManageUserAccess && isAccessView ? (
        <section className="rounded-2xl border border-neutral-200/60 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-600">Admin access controls are available only to admin role users.</p>
        </section>
      ) : null}
      </div>

      {/* Provider Onboarding Modal */}
      <ProviderOnboardingModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        onSuccess={handleOnboardingSuccess}
      />
    </DashboardPageLayout>
  );
}
