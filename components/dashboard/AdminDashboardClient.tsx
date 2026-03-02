'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { bookingTimelineLabel } from '@/lib/bookings/timeline';
import type {
  AdminProviderModerationItem,
  AdminServiceModerationSummaryItem,
  PlatformDiscount,
  PlatformDiscountAnalyticsSummary,
} from '@/lib/provider-management/types';
import type { ServiceCategory, ServicePackage } from '@/lib/service-catalog/types';
import ServiceCategoriesManager from './admin/ServiceCategoriesManager';
import PackageBuilder from './admin/PackageBuilder';

type AdminBooking = {
  id: number;
  provider_id: number;
  booking_start: string;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_mode?: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type?: string | null;
};

type Provider = {
  id: number;
  name: string;
};

type AdminProviderDocument = {
  id: string;
  provider_id: number;
  document_type: string | null;
  document_url: string | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
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
  service_type: string;
  base_price: string;
  surge_price: string;
  commission_percentage: string;
  service_duration_minutes: string;
  is_active: boolean;
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

type AdminDashboardView = 'overview' | 'operations' | 'access' | 'services';

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

const LOCATION_SUGGESTION_LEGEND = [
  'Add clinic pincode first, then set a realistic service radius baseline.',
  'Either increase service radius above 0 km or keep rollout limited to clinic pincode.',
  'Increase service radius or trim non-clinic rollout pincodes.',
  'Set service radius to align with current pincode coverage area.',
  'Review location fields and align service radius with rollout pincodes.',
] as const;

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

export default function AdminDashboardClient({
  canManageUserAccess = true,
  view = 'overview',
  initialBookings,
  providers,
  moderationProviders,
  providerDocuments,
  initialAvailability,
  initialServices,
  initialServicePincodes,
  initialServiceSummary,
  initialDiscounts,
  initialDiscountAnalytics,
  initialServiceCategories = [],
  initialServicePackages = [],
}: {
  canManageUserAccess?: boolean;
  view?: AdminDashboardView;
  initialBookings: AdminBooking[];
  providers: Provider[];
  moderationProviders: AdminProviderModerationItem[];
  providerDocuments: AdminProviderDocument[];
  initialAvailability: AdminProviderAvailability[];
  initialServices: AdminProviderService[];
  initialServicePincodes: AdminServicePincode[];
  initialServiceSummary: AdminServiceModerationSummaryItem[];
  initialDiscounts: PlatformDiscount[];
  initialDiscountAnalytics: PlatformDiscountAnalyticsSummary;
  initialServiceCategories?: ServiceCategory[];
  initialServicePackages?: ServicePackage[];
}) {
  const providerFallbackRows: AdminProviderModerationItem[] = providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
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
  const [documents, setDocuments] = useState(providerDocuments);
  const [availabilityByProvider, setAvailabilityByProvider] = useState<Record<number, AdminProviderAvailability[]>>(
    () => groupAvailabilityByProvider(initialAvailability),
  );
  const [servicesByProvider, setServicesByProvider] = useState<Record<number, AdminProviderService[]>>(() =>
    groupServicesByProvider(initialServices),
  );
  const [pincodesByService, setPincodesByService] = useState<Record<string, string[]>>(() =>
    groupPincodesByService(initialServicePincodes),
  );
  const [bookingFilter, setBookingFilter] = useState<'all' | 'sla' | 'high-risk'>('all');
  const [selectedBookingIds, setSelectedBookingIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<'confirmed' | 'completed' | 'cancelled' | 'no_show'>('confirmed');
  const [promoteEmail, setPromoteEmail] = useState('');
  const [serviceDraft, setServiceDraft] = useState<Record<number, ServiceRolloutDraft>>({});
  const [serviceSummary, setServiceSummary] = useState(initialServiceSummary);
  const [globalServiceDraft, setGlobalServiceDraft] = useState<GlobalServiceRolloutDraft>({
    service_type: 'grooming_session',
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
  const [availabilityDraft, setAvailabilityDraft] = useState<
    Record<number, { day_of_week: string; start_time: string; end_time: string; is_available: boolean }>
  >({});
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const visibleBookings = useMemo(() => {
    if (bookingFilter === 'all') {
      return bookings;
    }

    if (bookingFilter === 'sla') {
      return bookings.filter((booking) => booking.status === 'pending');
    }

    return bookings.filter((booking) => booking.status === 'no_show' || booking.status === 'cancelled');
  }, [bookings, bookingFilter]);

  const bookingRiskSummary = useMemo(() => {
    return {
      pending: bookings.filter((booking) => booking.status === 'pending').length,
      noShow: bookings.filter((booking) => booking.status === 'no_show').length,
      cancelled: bookings.filter((booking) => booking.status === 'cancelled').length,
    };
  }, [bookings]);

  const dashboardNavItems = useMemo<Array<{ id: AdminDashboardView; label: string }>>(() => {
    return [
      { id: 'overview', label: 'Overview' },
      { id: 'operations', label: 'Operations' },
      { id: 'services', label: 'Services' },
      { id: 'access', label: 'Access' },
    ];
  }, []);

  const isOverviewView = view === 'overview';
  const isAccessView = view === 'access';
  const isOperationsView = view === 'operations';
  const isServicesView = view === 'services';

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

  function overrideStatus(bookingId: number, status: AdminBooking['status']) {
    const previous = bookings;
    setBookings((current) => current.map((booking) => (booking.id === bookingId ? { ...booking, status } : booking)));

    startTransition(async () => {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        setBookings(previous);
        showToast('Override failed.', 'error');
        return;
      }

      showToast('Status overridden.', 'success');
    });
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

  function moderateProvider(providerId: number, action: 'approve' | 'reject' | 'suspend' | 'enable') {
    const previous = providerRows;

    setProviderRows((current) =>
      current.map((row) => {
        if (row.id !== providerId) {
          return row;
        }

        if (action === 'approve') {
          return {
            ...row,
            admin_approval_status: 'approved',
            verification_status: 'approved',
            account_status: 'active',
          };
        }

        if (action === 'reject') {
          return {
            ...row,
            admin_approval_status: 'rejected',
            verification_status: 'rejected',
            account_status: 'suspended',
          };
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
    );

    startTransition(async () => {
      try {
        await adminRequest(`/api/admin/providers/${providerId}/${action}`, { method: 'POST' });
        showToast(`Provider ${action}d successfully.`, 'success');
      } catch (error) {
        setProviderRows(previous);
        showToast(error instanceof Error ? error.message : `Unable to ${action} provider.`, 'error');
      }
    });
  }

  function verifyProviderDocument(documentId: string, verificationStatus: 'pending' | 'approved' | 'rejected') {
    const previous = documents;

    setDocuments((current) =>
      current.map((doc) => (doc.id === documentId ? { ...doc, verification_status: verificationStatus } : doc)),
    );

    startTransition(async () => {
      try {
        await adminRequest(`/api/admin/provider-documents/${documentId}/verify`, {
          method: 'PATCH',
          body: JSON.stringify({ verificationStatus }),
        });
        showToast('Document verification updated.', 'success');
      } catch (error) {
        setDocuments(previous);
        showToast(error instanceof Error ? error.message : 'Unable to update document verification.', 'error');
      }
    });
  }

  function setServiceDraftField(providerId: number, field: keyof ServiceRolloutDraft, value: string | boolean) {
    setServiceDraft((current) => ({
      ...current,
      [providerId]: {
        id: current[providerId]?.id,
        service_type: current[providerId]?.service_type ?? 'grooming_session',
        base_price: current[providerId]?.base_price ?? '0',
        surge_price: current[providerId]?.surge_price ?? '',
        commission_percentage: current[providerId]?.commission_percentage ?? '',
        service_duration_minutes: current[providerId]?.service_duration_minutes ?? '',
        is_active: current[providerId]?.is_active ?? true,
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
        service_type: service.service_type,
        base_price: String(service.base_price),
        surge_price: service.surge_price === null ? '' : String(service.surge_price),
        commission_percentage: service.commission_percentage === null ? '' : String(service.commission_percentage),
        service_duration_minutes: service.service_duration_minutes === null ? '' : String(service.service_duration_minutes),
        is_active: service.is_active,
        service_pincodes: (pincodesByService[service.id] ?? []).join(', '),
      },
    }));
  }

  function submitServiceRollout(providerId: number) {
    const draft = serviceDraft[providerId];

    if (!draft || !draft.service_type.trim()) {
      showToast('Provide service details before saving.', 'error');
      return;
    }

    const basePrice = Number(draft.base_price);
    const surgePrice = draft.surge_price.trim() ? Number(draft.surge_price) : null;
    const commission = draft.commission_percentage.trim() ? Number(draft.commission_percentage) : null;
    const serviceDuration = draft.service_duration_minutes.trim() ? Number(draft.service_duration_minutes) : null;

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

    const servicePincodes = draft.service_pincodes
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    startTransition(async () => {
      try {
        const response = await adminRequest<{ services: Array<AdminProviderService & { service_pincodes?: string[] }> }>(
          `/api/admin/providers/${providerId}/services`,
          {
            method: 'PUT',
            body: JSON.stringify([
              {
                id: draft.id,
                service_type: draft.service_type.trim(),
                base_price: basePrice,
                surge_price: surgePrice,
                commission_percentage: commission,
                service_duration_minutes: serviceDuration,
                is_active: draft.is_active,
                service_pincodes: servicePincodes,
              },
            ]),
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
              service_type: globalServiceDraft.service_type.trim(),
              base_price: basePrice,
              surge_price: surgePrice,
              commission_percentage: commission,
              service_duration_minutes: serviceDuration,
              is_active: globalServiceDraft.is_active,
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

  function applyAllLocationSuggestions(provider: AdminProviderModerationItem, warnings: string[], coveragePincodes: string[]) {
    if (warnings.length === 0) {
      showToast('No suggestions available to apply.', 'error');
      return;
    }

    let changeSummary = '';

    setLocationDraft((current) => {
      const existing = getLocationDraftForProvider(provider, current);
      const next = warnings.reduce((draft, warningText) => applyLocationWarningToDraft(draft, warningText, coveragePincodes), existing);
      changeSummary = buildLocationChangeSummary(existing, next);

      return {
        ...current,
        [provider.id]: next,
      };
    });

    showToast(
      changeSummary
        ? `All suggestions applied: ${changeSummary}`
        : 'All suggestions applied (no field changes were required).',
      'success',
    );
    setLocationLastAutoFixNote((current) => ({
      ...current,
      [provider.id]: changeSummary
        ? `Last auto-fix (all suggestions): ${changeSummary}`
        : 'Last auto-fix (all suggestions): No field changes were required.',
    }));
  }

  function executeAllLocationSuggestionsForAllProviders() {
    const targets = providerRows
      .map((provider) => {
        const providerServicesRows = servicesByProvider[provider.id] ?? [];
        const coveragePincodes = Array.from(new Set(providerServicesRows.flatMap((service) => pincodesByService[service.id] ?? [])));
        const localCoverageWarnings = buildLocalCoverageWarnings(provider, coveragePincodes);
        const effectiveCoverageWarnings =
          locationCoverageWarnings[provider.id] && locationCoverageWarnings[provider.id].length > 0
            ? locationCoverageWarnings[provider.id]
            : localCoverageWarnings;

        return {
          provider,
          coveragePincodes,
          warnings: effectiveCoverageWarnings,
        };
      })
      .filter((item) => item.warnings.length > 0);

    if (targets.length === 0) {
      showToast('No provider-level suggestions available to execute.', 'error');
      return;
    }

    const noteUpdates: Record<number, string> = {};
    let changedProviderCount = 0;

    setLocationDraft((current) => {
      const nextState = { ...current };

      for (const target of targets) {
        const existing = getLocationDraftForProvider(target.provider, nextState);
        const nextDraft = target.warnings.reduce(
          (draft, warningText) => applyLocationWarningToDraft(draft, warningText, target.coveragePincodes),
          existing,
        );
        const summary = buildLocationChangeSummary(existing, nextDraft);

        nextState[target.provider.id] = nextDraft;

        if (summary) {
          changedProviderCount += 1;
          noteUpdates[target.provider.id] = `Last auto-fix (all providers): ${summary}`;
        } else {
          noteUpdates[target.provider.id] = 'Last auto-fix (all providers): No field changes were required.';
        }
      }

      return nextState;
    });

    setLocationLastAutoFixNote((current) => ({
      ...current,
      ...noteUpdates,
    }));

    showToast(
      changedProviderCount > 0
        ? `Executed suggestions for ${targets.length} provider(s); ${changedProviderCount} had draft updates.`
        : `Executed suggestions for ${targets.length} provider(s); no field changes were required.`,
      'success',
    );
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
    field: 'day_of_week' | 'start_time' | 'end_time' | 'is_available',
    value: string | boolean,
  ) {
    setAvailabilityDraft((current) => ({
      ...current,
      [providerId]: {
        day_of_week: current[providerId]?.day_of_week ?? '1',
        start_time: current[providerId]?.start_time ?? '09:00',
        end_time: current[providerId]?.end_time ?? '17:00',
        is_available: current[providerId]?.is_available ?? true,
        [field]: value,
      },
    }));
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
    const draft = availabilityDraft[providerId] ?? {
      day_of_week: '1',
      start_time: '09:00',
      end_time: '17:00',
      is_available: true,
    };

    const dayOfWeek = Number(draft.day_of_week);

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      showToast('Day should be between 0 and 6.', 'error');
      return;
    }

    if (!draft.start_time || !draft.end_time || draft.start_time >= draft.end_time) {
      showToast('Provide a valid availability window.', 'error');
      return;
    }

    const current = availabilityByProvider[providerId] ?? [];

    saveAvailability(providerId, [
      ...current,
      {
        id: crypto.randomUUID(),
        provider_id: providerId,
        day_of_week: dayOfWeek,
        start_time: draft.start_time,
        end_time: draft.end_time,
        is_available: draft.is_available,
      },
    ]);
  }

  function toggleAvailabilitySlot(providerId: number, slotId: string, isAvailable: boolean) {
    const current = availabilityByProvider[providerId] ?? [];
    const nextRows = current.map((row) => (row.id === slotId ? { ...row, is_available: isAvailable } : row));
    saveAvailability(providerId, nextRows);
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-4 shadow-soft-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Admin Dashboard</h2>
            <p className="mt-1 text-xs text-[#6b6b6b]">Overview for observability, with operations separated into dedicated workflows.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dashboardNavItems.map((item) => {
              const isActive = item.id === view;

              return (
                <Link
                  key={item.id}
                  href={item.id === 'overview' ? '/dashboard/admin' : `/dashboard/admin?view=${item.id}`}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                    isActive
                      ? 'border-[#f2dfcf] bg-[#fff7f0] text-ink'
                      : 'border-[#f2dfcf] bg-white text-[#6b6b6b] hover:text-ink'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {isOverviewView ? (
        <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
          <h2 className="text-xl font-semibold text-ink">Business Statistics</h2>
          <p className="mt-1 text-xs text-[#6b6b6b]">Track platform health and booking risk from one clean observability panel.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-[#f2dfcf] p-3 text-xs">
              <p className="text-[#6b6b6b]">Total Bookings</p>
              <p className="mt-1 text-sm font-semibold text-ink">{bookings.length}</p>
            </div>
            <div className="rounded-xl border border-[#f2dfcf] p-3 text-xs">
              <p className="text-[#6b6b6b]">Pending SLA</p>
              <p className="mt-1 text-sm font-semibold text-ink">{bookingRiskSummary.pending}</p>
            </div>
            <div className="rounded-xl border border-[#f2dfcf] p-3 text-xs">
              <p className="text-[#6b6b6b]">No-show</p>
              <p className="mt-1 text-sm font-semibold text-ink">{bookingRiskSummary.noShow}</p>
            </div>
            <div className="rounded-xl border border-[#f2dfcf] p-3 text-xs">
              <p className="text-[#6b6b6b]">Cancelled</p>
              <p className="mt-1 text-sm font-semibold text-ink">{bookingRiskSummary.cancelled}</p>
            </div>
            <div className="rounded-xl border border-[#f2dfcf] p-3 text-xs">
              <p className="text-[#6b6b6b]">Providers</p>
              <p className="mt-1 text-sm font-semibold text-ink">{providerRows.length}</p>
            </div>
            <div className="rounded-xl border border-[#f2dfcf] p-3 text-xs">
              <p className="text-[#6b6b6b]">Active Discounts</p>
              <p className="mt-1 text-sm font-semibold text-ink">{discountAnalytics.total_active_discounts}</p>
            </div>
          </div>
        </section>
      ) : null}

      {isServicesView ? (
        <>
          <ServiceCategoriesManager initialCategories={initialServiceCategories} />
          <PackageBuilder initialPackages={initialServicePackages} categories={initialServiceCategories} />
        </>
      ) : null}

      {canManageUserAccess && isAccessView ? (
        <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
          <h2 className="text-xl font-semibold text-ink">Admin Access</h2>
          <p className="mt-1 text-xs text-[#6b6b6b]">Promote an existing signed-up user by email.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={promoteEmail}
              onChange={(event) => setPromoteEmail(event.target.value)}
              placeholder="user@example.com"
              className="min-w-[260px] rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => promoteUserToRole('admin')}
              disabled={isPending}
              className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
            >
              Promote to Admin
            </button>
            <button
              type="button"
              onClick={() => promoteUserToRole('staff')}
              disabled={isPending}
              className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
            >
              Promote to Staff
            </button>
            <button
              type="button"
              onClick={() => promoteUserToRole('provider')}
              disabled={isPending}
              className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
            >
              Promote to Provider
            </button>
          </div>
        </section>
      ) : null}

      {isOverviewView ? (
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md transition-all duration-300 ease-out hover:-translate-y-0.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-ink">All Bookings</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6b6b6b]">Pending SLA: {bookingRiskSummary.pending}</span>
            <span className="text-xs text-[#6b6b6b]">No-show: {bookingRiskSummary.noShow}</span>
            <span className="text-xs text-[#6b6b6b]">Cancelled: {bookingRiskSummary.cancelled}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={bookingFilter}
            onChange={(event) => setBookingFilter(event.target.value as 'all' | 'sla' | 'high-risk')}
            className="rounded-xl border border-[#f2dfcf] px-3 py-1.5 text-[11px]"
          >
            <option value="all">All</option>
            <option value="sla">SLA Queue</option>
            <option value="high-risk">High Risk</option>
          </select>
          <select
            value={bulkStatus}
            onChange={(event) =>
              setBulkStatus(event.target.value as 'confirmed' | 'completed' | 'cancelled' | 'no_show')
            }
            className="rounded-xl border border-[#f2dfcf] px-3 py-1.5 text-[11px]"
          >
            <option value="confirmed">Bulk: Confirmed</option>
            <option value="completed">Bulk: Completed</option>
            <option value="cancelled">Bulk: Cancelled</option>
            <option value="no_show">Bulk: No-show</option>
          </select>
          <button
            type="button"
            onClick={applyBulkStatus}
            disabled={isPending}
            className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
          >
            Apply to Selected ({selectedBookingIds.length})
          </button>
        </div>

        <ul className="mt-4 grid gap-2">
          {visibleBookings.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-sm text-[#6b6b6b]">No bookings found.</li>
          ) : (
            visibleBookings.map((booking) => (
              <li key={booking.id} className="rounded-xl border border-[#f2dfcf] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedBookingIds.includes(booking.id)}
                          onChange={() => toggleBookingSelection(booking.id)}
                        />
                        #{booking.id}
                      </label>
                    </p>
                    <p className="text-xs text-[#6b6b6b]">
                      {booking.booking_date && booking.start_time
                        ? `${booking.booking_date} • ${booking.start_time}${booking.end_time ? ` - ${booking.end_time}` : ''}`
                        : new Date(booking.booking_start).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-[#6b6b6b]">{bookingTimelineLabel(booking.status)}</p>
                    <p className="text-[11px] text-[#6b6b6b]">
                      {(booking.service_type ?? 'Service')} • {(booking.booking_mode ?? 'home_visit').replace('_', ' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {booking.status === 'pending' ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700">
                        SLA
                      </span>
                    ) : null}
                    {(booking.status === 'no_show' || booking.status === 'cancelled') ? (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] text-red-700">
                        High Risk
                      </span>
                    ) : null}
                    <span className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-2.5 py-1 text-[11px] font-medium capitalize text-ink">
                      {booking.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px]"
                    defaultValue={booking.provider_id}
                    onChange={(event) => reassignProvider(booking.id, Number(event.target.value))}
                    disabled={isPending}
                  >
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => overrideStatus(booking.id, 'confirmed')}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Mark Confirmed
                  </button>
                  <button
                    type="button"
                    onClick={() => overrideStatus(booking.id, 'completed')}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Mark Completed
                  </button>
                  <button
                    type="button"
                    onClick={() => overrideStatus(booking.id, 'no_show')}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Mark No-show
                  </button>
                  <button
                    type="button"
                    onClick={() => overrideStatus(booking.id, 'cancelled')}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Mark Cancelled
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBookingAdjustment(booking.id)}
                    disabled={isPending}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Cancel + Reverse Discount
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
      ) : null}

      {isOperationsView ? (
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-ink">Provider Moderation</h2>
          <button
            type="button"
            onClick={executeAllLocationSuggestionsForAllProviders}
            disabled={isPending}
            className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
          >
            Execute All Provider Suggestions
          </button>
        </div>
        <details className="mt-3 rounded-xl border border-[#f2dfcf] bg-[#fffaf6] px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-ink">Location Suggestion Legend</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-[#6b6b6b]">
            {LOCATION_SUGGESTION_LEGEND.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </details>
        <div className="mt-4 grid gap-3">
          {providerRows.length === 0 ? (
            <p className="text-sm text-[#6b6b6b]">No providers found.</p>
          ) : (
            providerRows.map((provider) => {
              const serviceDraftRow = serviceDraft[provider.id] ?? {
                id: undefined,
                service_type: 'grooming_session',
                base_price: '0',
                surge_price: '',
                commission_percentage: '',
                service_duration_minutes: '60',
                is_active: true,
                service_pincodes: '',
              };
              const providerAvailabilityRows = availabilityByProvider[provider.id] ?? [];
              const providerServicesRows = servicesByProvider[provider.id] ?? [];
              const locationDraftRow = locationDraft[provider.id] ?? {
                address: provider.address ?? '',
                city: provider.city ?? '',
                state: provider.state ?? '',
                pincode: provider.pincode ?? '',
                latitude: provider.latitude === null ? '' : String(provider.latitude),
                longitude: provider.longitude === null ? '' : String(provider.longitude),
                service_radius_km: provider.service_radius_km === null ? '' : String(provider.service_radius_km),
              };
              const availabilityRowDraft = availabilityDraft[provider.id] ?? {
                day_of_week: '1',
                start_time: '09:00',
                end_time: '17:00',
                is_available: true,
              };
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
              const lastAutoFixNote = locationLastAutoFixNote[provider.id] ?? null;

              return (
                <article key={provider.id} className="rounded-xl border border-[#f2dfcf] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">#{provider.id} • {provider.name}</p>
                      <p className="text-xs text-[#6b6b6b]">
                        Type: {provider.provider_type} • Approval: {provider.admin_approval_status} • Account: {provider.account_status}
                      </p>
                      <p className="text-xs text-[#6b6b6b]">
                        Docs → Pending: {provider.documentCounts.pending} | Approved: {provider.documentCounts.approved} | Rejected: {provider.documentCounts.rejected}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moderateProvider(provider.id, 'approve')}
                        disabled={isPending}
                        className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => moderateProvider(provider.id, 'reject')}
                        disabled={isPending}
                        className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => moderateProvider(provider.id, 'suspend')}
                        disabled={isPending}
                        className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                      >
                        Suspend
                      </button>
                      <button
                        type="button"
                        onClick={() => moderateProvider(provider.id, 'enable')}
                        disabled={isPending}
                        className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                      >
                        Enable
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#f2dfcf] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-ink">Location Moderation</p>
                      <button
                        type="button"
                        onClick={() => copyLocationIntoDraft(provider)}
                        disabled={isPending}
                        className="rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[10px] font-semibold text-ink"
                      >
                        Load Current
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-[#6b6b6b]">
                      Current: {[provider.address, provider.city, provider.state, provider.pincode].filter(Boolean).join(', ') || 'Not set'}
                    </p>
                    <p className="text-[11px] text-[#6b6b6b]">
                      Coordinates: {provider.latitude ?? '—'}, {provider.longitude ?? '—'} • Radius: {provider.service_radius_km ?? '—'} km
                    </p>
                    {effectiveCoverageWarnings.length > 0 ? (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                        <div className="mb-2">
                          <button
                            type="button"
                            onClick={() => applyAllLocationSuggestions(provider, effectiveCoverageWarnings, coveragePincodes)}
                            disabled={isPending}
                            className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-800"
                          >
                            Execute All Suggestions
                          </button>
                        </div>
                        {effectiveCoverageWarnings.map((warning, warningIndex) => (
                          <div key={`${provider.id}:${warningIndex}:${warning}`} className="mb-2 last:mb-0">
                            <p>⚠ {warning}</p>
                            <p className="text-[10px] text-amber-800">Resolve: {locationWarningSuggestion(warning)}</p>
                            <button
                              type="button"
                              onClick={() => applyLocationWarningSuggestion(provider, warning, coveragePincodes)}
                              disabled={isPending}
                              className="mt-1 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-800"
                            >
                              {locationWarningActionLabel(warning)}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {lastAutoFixNote ? (
                      <div className="mt-2 rounded-lg border border-[#f2dfcf] bg-[#fff7f0] px-3 py-2 text-[11px] text-ink">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p>{lastAutoFixNote}</p>
                          <button
                            type="button"
                            onClick={() => dismissLocationAutoFixNote(provider.id)}
                            className="rounded-full border border-[#f2dfcf] bg-white px-2 py-0.5 text-[10px] font-semibold text-ink"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <input
                        value={locationDraftRow.address}
                        onChange={(event) => setLocationDraftField(provider.id, 'address', event.target.value)}
                        placeholder="Address"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs sm:col-span-2"
                      />
                      <input
                        value={locationDraftRow.city}
                        onChange={(event) => setLocationDraftField(provider.id, 'city', event.target.value)}
                        placeholder="City"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={locationDraftRow.state}
                        onChange={(event) => setLocationDraftField(provider.id, 'state', event.target.value)}
                        placeholder="State"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={locationDraftRow.pincode}
                        onChange={(event) => setLocationDraftField(provider.id, 'pincode', event.target.value)}
                        placeholder="Pincode"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={locationDraftRow.service_radius_km}
                        onChange={(event) => setLocationDraftField(provider.id, 'service_radius_km', event.target.value)}
                        placeholder="Service radius (km)"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={locationDraftRow.latitude}
                        onChange={(event) => setLocationDraftField(provider.id, 'latitude', event.target.value)}
                        placeholder="Latitude"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={locationDraftRow.longitude}
                        onChange={(event) => setLocationDraftField(provider.id, 'longitude', event.target.value)}
                        placeholder="Longitude"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => saveProviderLocation(provider.id)}
                      disabled={isPending}
                      className="mt-2 rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                    >
                      Save Location Moderation
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#f2dfcf] p-3">
                    <p className="text-xs font-semibold text-ink">Availability Control</p>
                    {providerAvailabilityRows.length === 0 ? (
                      <p className="mt-2 text-xs text-[#6b6b6b]">No availability windows configured yet.</p>
                    ) : (
                      <ul className="mt-2 grid gap-2">
                        {providerAvailabilityRows.map((slot) => (
                          <li key={slot.id} className="flex flex-wrap items-center gap-2 text-xs text-[#6b6b6b]">
                            <span>
                              Day {slot.day_of_week} • {slot.start_time} - {slot.end_time}
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
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <input
                        value={availabilityRowDraft.day_of_week}
                        onChange={(event) => setAvailabilityDraftField(provider.id, 'day_of_week', event.target.value)}
                        placeholder="Day (0-6)"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={availabilityRowDraft.start_time}
                        onChange={(event) => setAvailabilityDraftField(provider.id, 'start_time', event.target.value)}
                        placeholder="Start (HH:MM)"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={availabilityRowDraft.end_time}
                        onChange={(event) => setAvailabilityDraftField(provider.id, 'end_time', event.target.value)}
                        placeholder="End (HH:MM)"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          checked={availabilityRowDraft.is_available}
                          onChange={(event) =>
                            setAvailabilityDraftField(provider.id, 'is_available', event.target.checked)
                          }
                        />
                        Enabled
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => appendAvailabilitySlot(provider.id)}
                      disabled={isPending}
                      className="mt-2 rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                    >
                      Add Availability Slot
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#f2dfcf] p-3">
                    <p className="text-xs font-semibold text-ink">Service & Pincode Rollout</p>
                    {providerServicesRows.length === 0 ? (
                      <p className="mt-2 text-xs text-[#6b6b6b]">No services configured yet.</p>
                    ) : (
                      <ul className="mt-2 grid gap-2">
                        {providerServicesRows.map((service) => (
                          <li key={service.id} className="rounded-lg border border-[#f2dfcf] p-2 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-ink">
                                {service.service_type} • ₹{service.base_price} • {service.is_active ? 'Active' : 'Disabled'}
                              </p>
                              <button
                                type="button"
                                onClick={() => copyServiceIntoDraft(provider.id, service.id)}
                                className="rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[10px] font-semibold text-ink"
                              >
                                Edit
                              </button>
                            </div>
                            <p className="mt-1 text-[11px] text-[#6b6b6b]">
                              Pincodes: {(pincodesByService[service.id] ?? []).join(', ') || 'Not mapped'}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <input
                        value={serviceDraftRow.service_type}
                        onChange={(event) => setServiceDraftField(provider.id, 'service_type', event.target.value)}
                        placeholder="Service type"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={serviceDraftRow.base_price}
                        onChange={(event) => setServiceDraftField(provider.id, 'base_price', event.target.value)}
                        placeholder="Base price"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={serviceDraftRow.surge_price}
                        onChange={(event) => setServiceDraftField(provider.id, 'surge_price', event.target.value)}
                        placeholder="Surge price"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={serviceDraftRow.commission_percentage}
                        onChange={(event) =>
                          setServiceDraftField(provider.id, 'commission_percentage', event.target.value)
                        }
                        placeholder="Commission %"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={serviceDraftRow.service_duration_minutes}
                        onChange={(event) =>
                          setServiceDraftField(provider.id, 'service_duration_minutes', event.target.value)
                        }
                        placeholder="Duration (minutes)"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          checked={serviceDraftRow.is_active}
                          onChange={(event) => setServiceDraftField(provider.id, 'is_active', event.target.checked)}
                        />
                        Service Active
                      </label>
                    </div>
                    <input
                      value={serviceDraftRow.service_pincodes}
                      onChange={(event) => setServiceDraftField(provider.id, 'service_pincodes', event.target.value)}
                      placeholder="Indian pincodes (comma separated)"
                      className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => submitServiceRollout(provider.id)}
                      disabled={isPending}
                      className="mt-2 rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                    >
                      Save Service Rollout
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
      ) : null}

      {isOperationsView ? (
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Service Moderation</h2>
        <p className="mt-1 text-xs text-[#6b6b6b]">Moderate service availability globally and rollout new services at scale.</p>

        <div className="mt-4 rounded-xl border border-[#f2dfcf] p-3">
          <p className="text-xs font-semibold text-ink">Service Catalog Control</p>
          {serviceSummary.length === 0 ? (
            <p className="mt-2 text-xs text-[#6b6b6b]">No services found yet.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {serviceSummary.map((service) => (
                <li key={service.service_type} className="rounded-lg border border-[#f2dfcf] p-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink">
                      {service.service_type} • Providers: {service.provider_count} • Active: {service.active_count} • Inactive:{' '}
                      {service.inactive_count} • Avg Price: ₹{service.average_base_price}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setServiceActivation(service.service_type, true)}
                        disabled={isPending}
                        className="rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[10px] font-semibold text-ink"
                      >
                        Enable
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceActivation(service.service_type, false)}
                        disabled={isPending}
                        className="rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[10px] font-semibold text-ink"
                      >
                        Disable
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-[#f2dfcf] p-3">
          <p className="text-xs font-semibold text-ink">Global Service Rollout</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              value={globalServiceDraft.service_type}
              onChange={(event) => setGlobalServiceDraftField('service_type', event.target.value)}
              placeholder="Service type"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={globalServiceDraft.base_price}
              onChange={(event) => setGlobalServiceDraftField('base_price', event.target.value)}
              placeholder="Base price"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={globalServiceDraft.surge_price}
              onChange={(event) => setGlobalServiceDraftField('surge_price', event.target.value)}
              placeholder="Surge price"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={globalServiceDraft.commission_percentage}
              onChange={(event) => setGlobalServiceDraftField('commission_percentage', event.target.value)}
              placeholder="Commission %"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={globalServiceDraft.service_duration_minutes}
              onChange={(event) => setGlobalServiceDraftField('service_duration_minutes', event.target.value)}
              placeholder="Duration (minutes)"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={globalServiceDraft.is_active}
                onChange={(event) => setGlobalServiceDraftField('is_active', event.target.checked)}
              />
              Service Active
            </label>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              value={globalServiceDraft.service_pincodes}
              onChange={(event) => setGlobalServiceDraftField('service_pincodes', event.target.value)}
              placeholder="Indian pincodes (comma separated)"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={globalServiceDraft.provider_ids}
              onChange={(event) => setGlobalServiceDraftField('provider_ids', event.target.value)}
              placeholder="Provider IDs (optional, comma separated)"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
          </div>
          <label className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={globalServiceDraft.overwrite_existing}
              onChange={(event) => setGlobalServiceDraftField('overwrite_existing', event.target.checked)}
            />
            Overwrite existing service config for targeted providers
          </label>
          <button
            type="button"
            onClick={rolloutGlobalService}
            disabled={isPending}
            className="mt-2 rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
          >
            Rollout Service Globally
          </button>
        </div>
      </section>
      ) : null}

      {isOperationsView ? (
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Discount Moderation</h2>
        <p className="mt-1 text-xs text-[#6b6b6b]">Create, enable, disable, and retire platform discounts.</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-[#f2dfcf] p-3 text-xs">
            <p className="text-[#6b6b6b]">Total Discounts</p>
            <p className="mt-1 text-sm font-semibold text-ink">{discountAnalytics.total_discounts}</p>
          </div>
          <div className="rounded-xl border border-[#f2dfcf] p-3 text-xs">
            <p className="text-[#6b6b6b]">Active Discounts</p>
            <p className="mt-1 text-sm font-semibold text-ink">{discountAnalytics.total_active_discounts}</p>
          </div>
          <div className="rounded-xl border border-[#f2dfcf] p-3 text-xs">
            <p className="text-[#6b6b6b]">Total Redemptions</p>
            <p className="mt-1 text-sm font-semibold text-ink">{discountAnalytics.total_redemptions}</p>
          </div>
          <div className="rounded-xl border border-[#f2dfcf] p-3 text-xs">
            <p className="text-[#6b6b6b]">Booking Redemption Rate</p>
            <p className="mt-1 text-sm font-semibold text-ink">{discountAnalytics.booking_redemption_rate}%</p>
          </div>
        </div>
        <div className="mt-2 rounded-xl border border-[#f2dfcf] p-3 text-xs text-[#6b6b6b]">
          Total discount amount issued: <span className="font-semibold text-ink">₹{discountAnalytics.total_discount_amount}</span>
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

        <div className="mt-4 rounded-xl border border-[#f2dfcf] p-3">
          <p className="text-xs font-semibold text-ink">Create / Update Discount</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              value={discountDraft.code}
              onChange={(event) => setDiscountDraftField('code', event.target.value.toUpperCase())}
              placeholder="Code (e.g. PET20)"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
              disabled={Boolean(discountDraft.id)}
            />
            <input
              value={discountDraft.title}
              onChange={(event) => setDiscountDraftField('title', event.target.value)}
              placeholder="Title"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <select
              value={discountDraft.discount_type}
              onChange={(event) => setDiscountDraftField('discount_type', event.target.value as 'percentage' | 'flat')}
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            >
              <option value="percentage">Percentage</option>
              <option value="flat">Flat</option>
            </select>
            <input
              value={discountDraft.discount_value}
              onChange={(event) => setDiscountDraftField('discount_value', event.target.value)}
              placeholder="Discount value"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={discountDraft.max_discount_amount}
              onChange={(event) => setDiscountDraftField('max_discount_amount', event.target.value)}
              placeholder="Max discount amount"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={discountDraft.min_booking_amount}
              onChange={(event) => setDiscountDraftField('min_booking_amount', event.target.value)}
              placeholder="Min booking amount"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={discountDraft.applies_to_service_type}
              onChange={(event) => setDiscountDraftField('applies_to_service_type', event.target.value)}
              placeholder="Service type (optional)"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              type="datetime-local"
              value={discountDraft.valid_from}
              onChange={(event) => setDiscountDraftField('valid_from', event.target.value)}
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              type="datetime-local"
              value={discountDraft.valid_until}
              onChange={(event) => setDiscountDraftField('valid_until', event.target.value)}
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={discountDraft.usage_limit_total}
              onChange={(event) => setDiscountDraftField('usage_limit_total', event.target.value)}
              placeholder="Usage limit total"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <input
              value={discountDraft.usage_limit_per_user}
              onChange={(event) => setDiscountDraftField('usage_limit_per_user', event.target.value)}
              placeholder="Usage limit per user"
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
            />
            <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={discountDraft.first_booking_only}
                onChange={(event) => setDiscountDraftField('first_booking_only', event.target.checked)}
              />
              First Booking Only
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs">
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
            className="mt-2 w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveDiscount}
              disabled={isPending}
              className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
            >
              {discountDraft.id ? 'Update Discount' : 'Create Discount'}
            </button>
            {discountDraft.id ? (
              <button
                type="button"
                onClick={resetDiscountDraft}
                disabled={isPending}
                className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
              >
                Clear Edit
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#f2dfcf] p-3">
          <p className="text-xs font-semibold text-ink">Existing Discounts</p>
          {discounts.length === 0 ? (
            <p className="mt-2 text-xs text-[#6b6b6b]">No discounts configured yet.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {discounts.map((discount) => (
                <li key={discount.id} className="rounded-lg border border-[#f2dfcf] p-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink">
                      {discount.code} • {discount.title} • {discount.discount_type} {discount.discount_value}
                    </p>
                    <span className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-2.5 py-1 text-[11px] font-medium text-ink">
                      {discount.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#6b6b6b]">
                    Valid: {new Date(discount.valid_from).toLocaleString()} -{' '}
                    {discount.valid_until ? new Date(discount.valid_until).toLocaleString() : 'No expiry'}
                  </p>
                  {discount.first_booking_only ? (
                    <p className="mt-1 text-[11px] font-medium text-ink">Applies to first booking only</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadDiscountInDraft(discount)}
                      disabled={isPending}
                      className="rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[10px] font-semibold text-ink"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDiscount(discount.id, !discount.is_active)}
                      disabled={isPending}
                      className="rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[10px] font-semibold text-ink"
                    >
                      {discount.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDiscount(discount.id)}
                      disabled={isPending}
                      className="rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[10px] font-semibold text-ink"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      ) : null}

      {isOperationsView ? (
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Provider Documents</h2>
        <ul className="mt-4 grid gap-2">
          {documents.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-sm text-[#6b6b6b]">No provider documents found.</li>
          ) : (
            documents.map((document) => (
              <li key={document.id} className="rounded-xl border border-[#f2dfcf] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">Provider #{document.provider_id} • {document.document_type ?? 'Document'}</p>
                    <p className="text-xs text-[#6b6b6b]">{document.document_url ?? 'No URL'}</p>
                  </div>
                  <span className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-2.5 py-1 text-[11px] font-medium capitalize text-ink">
                    {document.verification_status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => verifyProviderDocument(document.id, 'approved')}
                    disabled={isPending}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => verifyProviderDocument(document.id, 'rejected')}
                    disabled={isPending}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => verifyProviderDocument(document.id, 'pending')}
                    disabled={isPending}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Mark Pending
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
      ) : null}

      {!canManageUserAccess && isAccessView ? (
        <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
          <p className="text-sm text-[#6b6b6b]">Admin access controls are available only to admin role users.</p>
        </section>
      ) : null}
    </div>
  );
}
