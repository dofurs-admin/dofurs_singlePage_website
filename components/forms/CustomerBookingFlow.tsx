'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import AsyncState from '@/components/ui/AsyncState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import type { ServiceCategory, ServicePackage } from '@/lib/service-catalog/types';
import type { FlowState } from '@/lib/flows/contracts';
import { apiRequest } from '@/lib/api/client';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import PriceBreakdownCard from './PriceBreakdownCard';
import PremiumBookingConfirmation from './PremiumBookingConfirmation';
import FormField from './FormField';
import { useOptimisticSelection } from '@/lib/hooks/useOptimisticSelection';
import { bookingCreateSchema } from '@/lib/flows/validation';

type Provider = { id: number; name: string; provider_type?: string | null; type?: string | null };
type Service = {
  id: string;
  provider_id: number;
  service_type: string;
  service_duration_minutes: number;
  buffer_minutes: number;
  base_price: number;
  source: 'provider_services' | 'services';
};
type Pet = { id: number; name: string };
type Slot = { start_time: string; end_time: string; is_available: boolean };
type BookableUser = { id: string; name: string | null; email: string | null };
type CatalogDiscount = {
  id: string;
  code: string;
  title: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  max_discount_amount: number | null;
  min_booking_amount: number | null;
  applies_to_service_type: string | null;
  first_booking_only: boolean;
  valid_until: string | null;
};
type DiscountPreview = {
  discountId: string;
  code: string;
  title: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  discountAmount: number;
  baseAmount: number;
  finalAmount: number;
  appliesToServiceType: string | null;
  validUntil: string | null;
};

type ServiceAddon = {
  id: string;
  name: string;
  price: number;
};

type BookingType = 'service' | 'package';

type PriceCalculation = {
  basePrice: number;
  addOnPrice: number;
  discountAmount: number;
  finalPrice: number;
  breakdown: string[];
};

type BookingCreateResponse = {
  success: boolean;
  booking: { id: number };
};

type BookingCreatePayload = {
  petId: number;
  providerId: number;
  bookingDate: string;
  startTime: string;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  locationAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  providerNotes: string | null;
  bookingUserId?: string;
  discountCode?: string;
  providerServiceId?: string | null;
  packageId?: string | null;
  discountAmount?: number;
  finalPrice?: number;
  addOns?: Array<{ id: string; quantity: number }>;
};

function toMinutes(timeValue: string) {
  const [hour, minute] = timeValue.split(':').map(Number);
  return hour * 60 + minute;
}

export default function CustomerBookingFlow({ allowBookForUsers = false }: { allowBookForUsers?: boolean }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [bookableUsers, setBookableUsers] = useState<BookableUser[]>([]);
  const [selectedBookingUserId, setSelectedBookingUserId] = useState<string | null>(null);
  const [bookingUserSearch, setBookingUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<BookableUser[]>([]);
  const [hasSearchedUsers, setHasSearchedUsers] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [canBookForUsers, setCanBookForUsers] = useState(false);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('');
  const [bookingMode, setBookingMode] = useState<'home_visit' | 'clinic_visit' | 'teleconsult'>('home_visit');
  const [locationAddress, setLocationAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [providerNotes, setProviderNotes] = useState('');
  const [amount, setAmount] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [discounts, setDiscounts] = useState<CatalogDiscount[]>([]);
  const [discountCode, setDiscountCode] = useState('');
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);
  const [autoDiscountContextKey, setAutoDiscountContextKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [flowState, setFlowState] = useState<FlowState>('collecting');
  const { showToast } = useToast();
  const showBookForUsers = allowBookForUsers || canBookForUsers;

  // New state for package support
  const [bookingType, setBookingType] = useState<BookingType>('service');
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [priceCalculation, setPriceCalculation] = useState<PriceCalculation | null>(null);
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [serviceAddOns, setServiceAddOns] = useState<ServiceAddon[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [slotsRefreshKey, setSlotsRefreshKey] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastBookingSummary, setLastBookingSummary] = useState<{
    bookingDate: string;
    slotStartTime: string;
    bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
    providerName?: string;
    petName?: string;
    totalAmount: number;
  } | null>(null);
  const optimisticSlot = useOptimisticSelection('');

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setIsLoading(true);
      setApiError(null);
      const searchParams = new URLSearchParams();

      if (selectedBookingUserId) {
        searchParams.set('userId', selectedBookingUserId);
      }

      try {
        const payload = await apiRequest<{
          providers: Provider[];
          services: Service[];
          pets: Pet[];
          discounts?: CatalogDiscount[];
          canBookForUsers?: boolean;
          bookableUsers?: BookableUser[];
          selectedUserId?: string;
        }>(`/api/bookings/catalog${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);

        if (!isMounted) {
          return;
        }

        setCanBookForUsers(Boolean(payload.canBookForUsers));
        setBookableUsers(payload.bookableUsers ?? []);
        setSelectedBookingUserId(payload.selectedUserId ?? null);
        setProviders(payload.providers);
        setServices(payload.services);
        setPets(payload.pets);
        setDiscounts(payload.discounts ?? []);

        const preferredProvider = Number(globalThis.localStorage?.getItem('booking.preferredProviderId') ?? 0);
        const providerCandidate = payload.providers.find((provider) => provider.id === preferredProvider)?.id ?? payload.providers[0]?.id ?? null;

        const preferredService = globalThis.localStorage?.getItem('booking.preferredServiceId');
        const usageRaw = globalThis.localStorage?.getItem('booking.serviceUsage');
        const usage = usageRaw ? (JSON.parse(usageRaw) as Record<string, number>) : {};
        const mostUsedServiceId = Object.entries(usage).sort((left, right) => right[1] - left[1])[0]?.[0];
        const serviceCandidate =
          payload.services.find((service) => service.id === preferredService)?.id ??
          payload.services.find((service) => service.id === mostUsedServiceId)?.id ??
          null;

        setProviderId(providerCandidate);
        if (serviceCandidate) {
          setServiceId(serviceCandidate);
        }

        setPetId(payload.pets[0]?.id ?? null);
      } catch {
        if (isMounted) {
          setApiError('Sign in to access booking flow.');
          showToast('Sign in to access booking flow.', 'error');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [selectedBookingUserId, showToast]);

  // Load categories and packages
  useEffect(() => {
    let isMounted = true;

    async function loadCategoriesAndPackages() {
      try {
        const [categoriesRes, packagesRes] = await Promise.all([
          fetch('/api/services/categories', { cache: 'no-store' }),
          fetch('/api/services/packages', { cache: 'no-store' }),
        ]);

        if (!categoriesRes.ok || !packagesRes.ok) {
          return;
        }

        const [categoriesData, packagesData] = await Promise.all([
          categoriesRes.json(),
          packagesRes.json(),
        ]);

        if (isMounted) {
          setCategories(categoriesData.data ?? []);
          setPackages(packagesData.data ?? []);
        }
      } catch {
        // Silently fail - categories/packages are optional
      }
    }

    loadCategoriesAndPackages();

    return () => {
      isMounted = false;
    };
  }, []);

  const providerServices = useMemo(
    () => services.filter((service) => service.provider_id === providerId && service.source === 'provider_services'),
    [services, providerId],
  );

  const selectedBookingUser = useMemo(
    () => bookableUsers.find((item) => item.id === selectedBookingUserId) ?? null,
    [bookableUsers, selectedBookingUserId],
  );

  const recommendationSlots = useMemo(() => {
    if (slots.length === 0) {
      return [] as Array<{ key: string; label: string; reason: string; slot: Slot }>;
    }

    const sorted = [...slots].sort((left, right) => toMinutes(left.start_time) - toMinutes(right.start_time));
    const fastest = sorted[0];

    const midTime = 13 * 60;
    const mostFlexible = [...sorted].sort((left, right) => {
      const leftDiff = Math.abs(toMinutes(left.start_time) - midTime);
      const rightDiff = Math.abs(toMinutes(right.start_time) - midTime);
      return leftDiff - rightDiff;
    })[0];

    const now = new Date();
    const targetDate = bookingDate ? new Date(`${bookingDate}T00:00:00`) : null;

    const best =
      targetDate && now.toDateString() === targetDate.toDateString()
        ? [...sorted].find((slot) => toMinutes(slot.start_time) >= now.getHours() * 60 + now.getMinutes() + 90) ?? fastest
        : mostFlexible;

    const unique = new Map<string, { key: string; label: string; reason: string; slot: Slot }>();

    unique.set(best.start_time, {
      key: `best-${best.start_time}`,
      label: 'Best',
      reason: 'Balanced timing for convenience',
      slot: best,
    });
    unique.set(fastest.start_time, {
      key: `fastest-${fastest.start_time}`,
      label: 'Fastest',
      reason: 'Earliest available start',
      slot: fastest,
    });
    unique.set(mostFlexible.start_time, {
      key: `flex-${mostFlexible.start_time}`,
      label: 'Most flexible',
      reason: 'Mid-day slot with easier adjustments',
      slot: mostFlexible,
    });

    return Array.from(unique.values());
  }, [slots, bookingDate]);

  useEffect(() => {
    setServiceId(providerServices[0]?.id ?? null);
  }, [providerServices]);

  useEffect(() => {
    const selected = services.find((service) => service.id === serviceId);
    setAmount(selected?.base_price ?? 0);
    setDiscountPreview(null);
  }, [serviceId, services]);

  useEffect(() => {
    if (!serviceId || bookingType !== 'service') {
      setServiceAddOns([]);
      setSelectedAddOns({});
      return;
    }

    let isMounted = true;

    async function loadAddOns() {
      try {
        const payload = await apiRequest<{ success: boolean; data: ServiceAddon[] }>(`/api/services/addons/${serviceId}`);

        if (!isMounted) {
          return;
        }

        setServiceAddOns(payload.data ?? []);
        setSelectedAddOns({});
      } catch {
        if (isMounted) {
          setServiceAddOns([]);
        }
      }
    }

    void loadAddOns();

    return () => {
      isMounted = false;
    };
  }, [bookingType, serviceId]);

  const discountSuggestions = useMemo(() => {
    const selectedService = services.find((service) => service.id === serviceId);

    return discounts.filter((discount) => {
      if (discount.min_booking_amount !== null && amount < discount.min_booking_amount) {
        return false;
      }

      if (!selectedService) {
        return true;
      }

      if (!discount.applies_to_service_type) {
        return true;
      }

      return discount.applies_to_service_type.trim().toLowerCase() === selectedService.service_type.trim().toLowerCase();
    });
  }, [discounts, serviceId, services, amount]);

  const rankedDiscountSuggestions = useMemo(() => {
    return [...discountSuggestions].sort((left, right) => {
      const leftRaw = left.discount_type === 'percentage' ? (amount * left.discount_value) / 100 : left.discount_value;
      const rightRaw = right.discount_type === 'percentage' ? (amount * right.discount_value) / 100 : right.discount_value;

      const leftEstimated = left.max_discount_amount !== null ? Math.min(leftRaw, left.max_discount_amount) : leftRaw;
      const rightEstimated = right.max_discount_amount !== null ? Math.min(rightRaw, right.max_discount_amount) : rightRaw;

      return rightEstimated - leftEstimated;
    });
  }, [discountSuggestions, amount]);

  useEffect(() => {
    if (!showBookForUsers || !selectedBookingUser) {
      return;
    }

    setSearchResults((current) => {
      if (current.some((item) => item.id === selectedBookingUser.id)) {
        return current;
      }

      return [selectedBookingUser, ...current].slice(0, 25);
    });
  }, [selectedBookingUser, showBookForUsers]);

  async function searchUsers() {
    if (!showBookForUsers) {
      return;
    }

    const query = bookingUserSearch.trim();

    if (query.length < 2) {
      showToast('Enter at least 2 characters to search users.', 'error');
      return;
    }

    setHasSearchedUsers(true);
    setIsSearchingUsers(true);

    try {
      const payload = await apiRequest<{ users?: BookableUser[] }>(`/api/bookings/search-user?query=${encodeURIComponent(query)}`);
      const users = payload?.users ?? [];

      setSearchResults(users);

      if (users.length === 0) {
        showToast('No users found for this search.', 'error');
        return;
      }

      showToast(`${users.length} user${users.length === 1 ? '' : 's'} found.`, 'success');
    } catch {
      setSearchResults([]);
      showToast('User search failed.', 'error');
    } finally {
      setIsSearchingUsers(false);
    }
  }

  const calculatePrice = useCallback(async () => {
    if (!providerId) {
      setPriceCalculation(null);
      return;
    }

    if (bookingType === 'service' && !serviceId) {
      setPriceCalculation(null);
      return;
    }

    if (bookingType === 'package' && !selectedPackageId) {
      setPriceCalculation(null);
      return;
    }

    setIsCalculatingPrice(true);

    try {
      const addOns = Object.entries(selectedAddOns)
        .filter(([, quantity]) => quantity > 0)
        .map(([id, quantity]) => ({ id, quantity }));

      const result = await apiRequest<{ success: boolean; data: PriceCalculation }>('/api/services/calculate-price', {
        method: 'POST',
        body: JSON.stringify({
          bookingType,
          serviceId: bookingType === 'service' ? serviceId : undefined,
          packageId: bookingType === 'package' ? selectedPackageId : undefined,
          providerId: providerId.toString(),
          addOns,
        }),
      });

      setPriceCalculation(result.data);
      setAmount(result.data.finalPrice);
    } catch {
      showToast('Failed to calculate price', 'error');
      setPriceCalculation(null);
    } finally {
      setIsCalculatingPrice(false);
    }
  }, [bookingType, providerId, selectedAddOns, selectedPackageId, serviceId, showToast]);

  // Calculate price when booking type, serviceId, or packageId changes
  useEffect(() => {
    void calculatePrice();
  }, [calculatePrice]);

  useEffect(() => {
    if (!providerId || !bookingDate) {
      setSlots([]);
      return;
    }

    let isMounted = true;

    async function loadSlots() {
      const selectedService = services.find((service) => service.id === serviceId);

      const search = new URLSearchParams({
        providerId: String(providerId),
        date: bookingDate,
      });

      if (serviceId && selectedService?.source === 'provider_services') {
        search.set('providerServiceId', serviceId);
      }

      if (selectedService?.service_duration_minutes) {
        search.set('serviceDurationMinutes', String(selectedService.service_duration_minutes));
      }

      try {
        const payload = await apiRequest<{ slots: Slot[] }>(`/api/bookings/available-slots?${search.toString()}`);
        if (isMounted) {
          setSlots(payload.slots);
          const first = payload.slots[0]?.start_time ?? '';
          setSlotStartTime(first);
        }
      } catch {
        if (isMounted) {
          showToast('Unable to fetch slots.', 'error');
        }
      }
    }

    loadSlots();

    return () => {
      isMounted = false;
    };
  }, [providerId, bookingDate, serviceId, services, showToast, slotsRefreshKey]);

  useEffect(() => {
    if (bookingMode !== 'home_visit') {
      return;
    }

    if (locationAddress.trim()) {
      return;
    }

    const lastAddress = globalThis.localStorage?.getItem('booking.lastUsedAddress');

    if (lastAddress) {
      setLocationAddress(lastAddress);
    }
  }, [bookingMode, locationAddress]);

  useEffect(() => {
    if (!providerId || !bookingDate) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`slots-live:${providerId}:${bookingDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `provider_id=eq.${providerId}`,
        },
        () => {
          setSlotsRefreshKey((current) => current + 1);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_availability',
          filter: `provider_id=eq.${providerId}`,
        },
        () => {
          setSlotsRefreshKey((current) => current + 1);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_blocked_dates',
          filter: `provider_id=eq.${providerId}`,
        },
        () => {
          setSlotsRefreshKey((current) => current + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingDate, providerId]);

  function submitBooking() {
    setFlowState('validating');
    // Validation
    if (!providerId || !petId || !slotStartTime) {
      setFlowState('collecting');
      showToast('Complete all booking fields.', 'error');
      return;
    }

    if (bookingType === 'service') {
      const selectedService = services.find((service) => service.id === serviceId);

      if (!serviceId || !selectedService) {
        setFlowState('collecting');
        showToast('Select a service.', 'error');
        return;
      }

      if (selectedService.source !== 'provider_services') {
        setFlowState('error');
        showToast('This service is not yet available for the upgraded booking flow.', 'error');
        return;
      }
    } else if (bookingType === 'package') {
      if (!selectedPackageId) {
        setFlowState('collecting');
        showToast('Select a package.', 'error');
        return;
      }

      if (!priceCalculation) {
        setFlowState('collecting');
        showToast('Price calculation required before booking.', 'error');
        return;
      }
    }

    if (bookingMode === 'home_visit') {
      if (!locationAddress.trim() || !latitude || !longitude) {
        setFlowState('collecting');
        showToast('Home visit requires address and map coordinates.', 'error');
        return;
      }
    }

    setFlowState('submitting');
    startTransition(async () => {
      const basePayload: BookingCreatePayload = {
        petId,
        providerId,
        bookingDate,
        startTime: slotStartTime,
        bookingMode,
        locationAddress: bookingMode === 'home_visit' ? locationAddress.trim() : null,
        latitude: bookingMode === 'home_visit' ? Number(latitude) : null,
        longitude: bookingMode === 'home_visit' ? Number(longitude) : null,
        providerNotes: providerNotes.trim() || null,
        bookingUserId: showBookForUsers ? selectedBookingUserId ?? undefined : undefined,
        discountCode: discountCode.trim() ? discountCode.trim().toUpperCase() : undefined,
        addOns: Object.entries(selectedAddOns)
          .filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => ({ id, quantity })),
      };

      if (bookingType === 'service') {
        basePayload.providerServiceId = serviceId;
      } else if (bookingType === 'package' && priceCalculation) {
        basePayload.packageId = selectedPackageId;
        basePayload.discountAmount = priceCalculation.discountAmount;
        basePayload.finalPrice = priceCalculation.finalPrice;
      }

      const validationPayload = {
        ...basePayload,
        bookingType,
        providerServiceId: bookingType === 'service' ? basePayload.providerServiceId : undefined,
      };

      const clientValidation = bookingCreateSchema.safeParse(validationPayload);

      if (!clientValidation.success) {
        setFlowState('error');
        showToast('Please review booking details before submitting.', 'error');
        return;
      }

      try {
        await apiRequest<BookingCreateResponse>('/api/bookings/create', {
          method: 'POST',
          body: JSON.stringify(basePayload),
        });

        globalThis.localStorage?.setItem('booking.preferredProviderId', String(providerId));
        if (serviceId) {
          globalThis.localStorage?.setItem('booking.preferredServiceId', serviceId);
          const usageRaw = globalThis.localStorage?.getItem('booking.serviceUsage');
          const usage = usageRaw ? (JSON.parse(usageRaw) as Record<string, number>) : {};
          usage[serviceId] = (usage[serviceId] ?? 0) + 1;
          globalThis.localStorage?.setItem('booking.serviceUsage', JSON.stringify(usage));
        }
        if (bookingMode === 'home_visit' && locationAddress.trim()) {
          globalThis.localStorage?.setItem('booking.lastUsedAddress', locationAddress.trim());
        }

        const providerName = providers.find((provider) => provider.id === providerId)?.name;
        const petName = pets.find((pet) => pet.id === petId)?.name;

        setLastBookingSummary({
          bookingDate,
          slotStartTime,
          bookingMode,
          providerName,
          petName,
          totalAmount: discountPreview?.finalAmount ?? priceCalculation?.finalPrice ?? amount,
        });

        setFlowState('success');
        showToast('Booking created successfully.', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Booking failed. Please try again.';
        setFlowState('error');
        showToast(message, 'error');
      }
    });
  }

  function clearDiscount() {
    setDiscountCode('');
    setDiscountPreview(null);
  }

  const applyDiscountCandidates = useCallback(async (codes: string[], silent: boolean) => {
    if (!serviceId) {
      if (!silent) {
        showToast('Select a service before applying discount.', 'error');
      }
      return;
    }

    const normalizedCodes = Array.from(new Set(codes.map((item) => item.trim().toUpperCase()).filter(Boolean)));

    if (normalizedCodes.length === 0) {
      if (!silent) {
        showToast('Enter a discount code.', 'error');
      }
      return;
    }

    let fallbackMessage = 'Discount cannot be applied.';

    for (const code of normalizedCodes) {
      try {
        const payload = await apiRequest<{ preview?: DiscountPreview }>('/api/bookings/discount-preview', {
          method: 'POST',
          body: JSON.stringify({
            providerServiceId: serviceId,
            discountCode: code,
            bookingUserId: showBookForUsers ? selectedBookingUserId ?? undefined : undefined,
          }),
        });

        if (!payload?.preview) {
          continue;
        }

        setDiscountCode(payload.preview.code);
        setDiscountPreview(payload.preview);

        if (!silent) {
          showToast('Discount applied successfully.', 'success');
        }

        return;
      } catch (error) {
        fallbackMessage = error instanceof Error ? error.message : fallbackMessage;
        continue;
      }
    }

    setDiscountPreview(null);

    if (!silent) {
      showToast(fallbackMessage, 'error');
    }
  }, [selectedBookingUserId, serviceId, showBookForUsers, showToast]);

  function applyDiscount() {
    startTransition(async () => {
      await applyDiscountCandidates([discountCode], false);
    });
  }

  useEffect(() => {
    if (!serviceId) {
      return;
    }

    if (discountCode.trim() || discountPreview) {
      return;
    }

    if (rankedDiscountSuggestions.length === 0) {
      return;
    }

    const contextKey = `${serviceId}:${selectedBookingUserId ?? 'self'}:${rankedDiscountSuggestions.map((item) => item.code).join('|')}`;

    if (autoDiscountContextKey === contextKey) {
      return;
    }

    setAutoDiscountContextKey(contextKey);
    void applyDiscountCandidates(
      rankedDiscountSuggestions.slice(0, 3).map((item) => item.code),
      true,
    );
  }, [
    applyDiscountCandidates,
    autoDiscountContextKey,
    discountCode,
    discountPreview,
    rankedDiscountSuggestions,
    selectedBookingUserId,
    serviceId,
  ]);

  return (
    <AsyncState
      isLoading={isLoading}
      isError={Boolean(apiError)}
      errorMessage={apiError}
      loadingFallback={<div className="rounded-3xl border border-[#f2dfcf] bg-white p-6"><LoadingSkeleton lines={5} /></div>}
    >
      <div className="grid gap-4" data-flow-state={flowState}>
      <h3 className="text-lg font-semibold text-ink">Smart Booking Engine</h3>
      <p className="mt-1 text-sm text-[#6b6b6b]">Choose a user (for staff), then provider, service, pet and slot.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {showBookForUsers ? (
          <div className="sm:col-span-2 rounded-xl border border-[#f2dfcf] bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-ink">Book for user</p>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void searchUsers();
              }}
            >
              <input
                value={bookingUserSearch}
                onChange={(event) => setBookingUserSearch(event.target.value)}
                placeholder="Search user by email"
                className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={isSearchingUsers}
                className="rounded-full border border-[#f2dfcf] px-4 py-2 text-xs font-semibold text-ink"
              >
                {isSearchingUsers ? 'Searching...' : 'Search'}
              </button>
            </form>
            <div className="mt-2 max-h-44 space-y-1 overflow-auto">
              {isSearchingUsers ? (
                <p className="text-xs text-[#6b6b6b]">Searching users...</p>
              ) : !hasSearchedUsers ? (
                <p className="text-xs text-[#6b6b6b]">Search by email and click Search.</p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-[#6b6b6b]">Your first booking starts here 🐾</p>
              ) : (
                searchResults.map((bookableUser) => {
                  const label = bookableUser.name?.trim() || bookableUser.email || bookableUser.id;
                  const isSelected = selectedBookingUserId === bookableUser.id;

                  return (
                    <button
                      key={bookableUser.id}
                      type="button"
                      onClick={() => setSelectedBookingUserId(bookableUser.id)}
                      className={`flex w-full items-start justify-between rounded-xl border px-3 py-2 text-left text-xs ${
                        isSelected
                          ? 'border-[#e76f51] bg-[#fff2ea] text-ink'
                          : 'border-[#f2dfcf] bg-[#fffaf6] text-[#6b6b6b]'
                      }`}
                    >
                      <span className="font-medium text-ink">{label}</span>
                      {bookableUser.email ? <span className="ml-3 text-[11px] text-[#7a7a7a]">{bookableUser.email}</span> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        <select
          value={providerId ?? ''}
          onChange={(event) => setProviderId(Number(event.target.value))}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
        >
          {providers.length === 0 ? <option value="">No providers available</option> : null}
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name} ({provider.provider_type ?? provider.type ?? 'provider'})
            </option>
          ))}
        </select>

        <div className="rounded-xl border border-[#f2dfcf] bg-[#fff7f0] p-3">
          <p className="mb-2 text-xs font-semibold text-ink">Booking Type</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBookingType('service');
                setSelectedPackageId(null);
                setSelectedCategoryId(null);
              }}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                bookingType === 'service'
                  ? 'border-[#e76f51] bg-[#fff2ea] text-ink'
                  : 'border-[#f2dfcf] bg-white text-[#6b6b6b]'
              }`}
            >
              Service
            </button>
            <button
              type="button"
              onClick={() => {
                setBookingType('package');
                setServiceId(null);
              }}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                bookingType === 'package'
                  ? 'border-[#e76f51] bg-[#fff2ea] text-ink'
                  : 'border-[#f2dfcf] bg-white text-[#6b6b6b]'
              }`}
            >
              Package
            </button>
          </div>
        </div>

        {bookingType === 'package' && categories.length > 0 ? (
          <>
            <select
              value={selectedCategoryId ?? ''}
              onChange={(event) => {
                setSelectedCategoryId(event.target.value);
                setSelectedPackageId(null);
              }}
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
            >
              <option value="">Select Category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            {selectedCategoryId ? (
              <select
                value={selectedPackageId ?? ''}
                onChange={(event) => setSelectedPackageId(event.target.value)}
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              >
                <option value="">Select Package</option>
                {packages
                  .filter(
                    (pkg) => !selectedCategoryId || pkg.category_id === selectedCategoryId
                  )
                  .map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} {pkg.discount_type ? `(${pkg.discount_type === 'percentage' ? `${pkg.discount_value}%` : `₹${pkg.discount_value}`} off)` : ''}
                    </option>
                  ))}
              </select>
            ) : null}
          </>
        ) : null}

        {bookingType === 'service' ? (
          <div className="space-y-3">
            <select
              value={serviceId ?? ''}
              onChange={(event) => setServiceId(event.target.value)}
              className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
            >
              {providerServices.length === 0 ? <option value="">No active services</option> : null}
              {providerServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.service_type} - ₹{service.base_price}
                </option>
              ))}
            </select>

            {serviceAddOns.length > 0 ? (
              <div className="rounded-xl border border-[#f2dfcf] bg-[#fffaf6] p-3">
                <p className="text-xs font-semibold text-ink">Add-ons</p>
                <div className="mt-2 space-y-2">
                  {serviceAddOns.map((addOn) => (
                    <label key={addOn.id} className="flex items-center justify-between gap-3 text-xs text-[#6b6b6b]">
                      <span className="text-ink">{addOn.name} · ₹{addOn.price}</span>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={selectedAddOns[addOn.id] ?? 0}
                        onChange={(event) => {
                          const quantity = Number(event.target.value || 0);
                          setSelectedAddOns((current) => ({
                            ...current,
                            [addOn.id]: quantity,
                          }));
                        }}
                        className="w-20 rounded-lg border border-[#f2dfcf] px-2 py-1 text-xs"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <PriceBreakdownCard price={priceCalculation} isLoading={isCalculatingPrice} />

        <select value={petId ?? ''} onChange={(event) => setPetId(Number(event.target.value))} className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm">
          {pets.length === 0 ? <option value="">No pets found for selected user</option> : null}
          {pets.map((pet) => (
            <option key={pet.id} value={pet.id}>
              {pet.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={bookingDate}
          onChange={(event) => setBookingDate(event.target.value)}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
        />

        <select
          value={slotStartTime}
          onChange={(event) => {
            optimisticSlot.update(event.target.value);
            setSlotStartTime(event.target.value);
          }}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm sm:col-span-2"
        >
          {slots.length === 0 ? <option value="">Your first booking starts here 🐾</option> : null}
          {slots.map((slotOption) => (
            <option key={`${slotOption.start_time}-${slotOption.end_time}`} value={slotOption.start_time}>
              {slotOption.start_time} - {slotOption.end_time}
            </option>
          ))}
        </select>

        <div className="sm:col-span-2 rounded-2xl bg-[#fffaf6] p-3">
          <p className="text-xs font-semibold text-ink">Recommended Slots</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recommendationSlots.length === 0 ? (
              <p className="text-xs text-[#6b6b6b]">Recommendations appear after loading slots.</p>
            ) : (
              recommendationSlots.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    optimisticSlot.update(item.slot.start_time);
                    setSlotStartTime(item.slot.start_time);
                  }}
                  className={`rounded-xl border px-3 py-2 text-left text-xs ${
                    slotStartTime === item.slot.start_time
                      ? 'border-[#e76f51] bg-[#fff2ea] text-ink'
                      : 'border-[#f2dfcf] bg-[#fffaf6] text-[#6b6b6b]'
                  }`}
                >
                  <p className="font-semibold text-ink">{item.label}: {item.slot.start_time}-{item.slot.end_time}</p>
                  <p>{item.reason}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <select
          value={bookingMode}
          onChange={(event) => setBookingMode(event.target.value as 'home_visit' | 'clinic_visit' | 'teleconsult')}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
        >
          <option value="home_visit">Home Visit</option>
          <option value="clinic_visit">Clinic Visit</option>
          <option value="teleconsult">Teleconsult</option>
        </select>

        <input
          type="number"
          value={discountPreview?.baseAmount ?? amount}
          readOnly
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
          min={0}
        />

        <div className="sm:col-span-2 rounded-2xl border border-[#f2dfcf] bg-[#fffaf6] p-3">
          <p className="text-xs font-semibold text-ink">Discount</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={discountCode}
              onChange={(event) => {
                setDiscountCode(event.target.value.toUpperCase());
                setDiscountPreview(null);
              }}
              className="min-w-[220px] rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              placeholder="Enter discount code"
            />
            <button
              type="button"
              onClick={applyDiscount}
              disabled={isPending}
              className="rounded-full border border-[#f2dfcf] px-3 py-2 text-xs font-semibold text-ink"
            >
              Apply
            </button>
            {discountCode.trim() ? (
              <button
                type="button"
                onClick={clearDiscount}
                disabled={isPending}
                className="rounded-full border border-[#f2dfcf] px-3 py-2 text-xs font-semibold text-ink"
              >
                Clear
              </button>
            ) : null}
          </div>
          {rankedDiscountSuggestions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {rankedDiscountSuggestions.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setDiscountCode(item.code);
                    startTransition(async () => {
                      await applyDiscountCandidates([item.code], false);
                    });
                  }}
                  className="rounded-full border border-[#f2dfcf] bg-white px-2.5 py-1 text-[11px] text-ink"
                >
                  {item.code} · {item.title}
                  {item.first_booking_only ? ' · New user' : ''}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 grid gap-1 text-xs text-[#6b6b6b]">
            <p>Base amount: ₹{discountPreview?.baseAmount ?? amount}</p>
            <p>Discount applied to service bill: ₹{discountPreview?.discountAmount ?? 0}</p>
            <p className="font-semibold text-ink">Estimated payable to provider after service: ₹{discountPreview?.finalAmount ?? amount}</p>
          </div>
        </div>

        {bookingMode === 'home_visit' ? (
          <>
            <FormField label="Home visit address">
              <input
                value={locationAddress}
                onChange={(event) => setLocationAddress(event.target.value)}
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm sm:col-span-2"
                placeholder="Home visit address"
              />
            </FormField>
            <input
              type="number"
              step="0.000001"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              placeholder="Latitude"
            />
            <input
              type="number"
              step="0.000001"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              placeholder="Longitude"
            />
          </>
        ) : null}

        <input
          value={providerNotes}
          onChange={(event) => setProviderNotes(event.target.value)}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm sm:col-span-2"
          placeholder="Booking notes (optional)"
        />
      </div>

      <p className="mt-3 text-xs text-[#6b6b6b]">Payment is collected directly by the provider after service completion. No platform-side online payment processing is involved.</p>

      {flowState === 'success' && lastBookingSummary ? (
        <PremiumBookingConfirmation
          bookingDate={lastBookingSummary.bookingDate}
          slotStartTime={lastBookingSummary.slotStartTime}
          bookingMode={lastBookingSummary.bookingMode}
          providerName={lastBookingSummary.providerName}
          petName={lastBookingSummary.petName}
          totalAmount={lastBookingSummary.totalAmount}
        />
      ) : null}

      <button
        type="button"
        onClick={submitBooking}
        disabled={isPending}
        className="mt-5 inline-flex items-center justify-center rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-6 py-3 text-sm font-semibold text-white transition-all duration-300 ease-out hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Booking...' : 'Create Booking'}
      </button>
      </div>
    </AsyncState>
  );
}
