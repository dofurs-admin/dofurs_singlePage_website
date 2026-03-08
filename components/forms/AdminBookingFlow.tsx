'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import AsyncState from '@/components/ui/AsyncState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { apiRequest } from '@/lib/api/client';
import { useToast } from '@/components/ui/ToastProvider';

type BookableUser = {
  id: string;
  name: string | null;
  email: string | null;
};

type Pet = {
  id: number;
  name: string;
};

type SavedAddress = {
  id: string;
  label: 'Home' | 'Office' | 'Other' | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

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

type AvailabilityServiceSummary = {
  serviceType: string;
  minBasePrice: number;
  maxBasePrice: number;
  providerCount: number;
};

type AvailabilityProvider = {
  providerId: number;
  providerName: string;
  providerType: string | null;
  providerServiceId: string;
  serviceType: string;
  serviceMode: string | null;
  basePrice: number;
  serviceDurationMinutes: number;
  availableSlotCount: number;
  availableForSelectedSlot: boolean;
  recommended: boolean;
};

type AvailabilitySlot = {
  startTime: string;
  endTime: string;
  availableProviderCount: number;
  recommended: boolean;
};

type AdminFlowAvailabilityResponse = {
  services: AvailabilityServiceSummary[];
  providers: AvailabilityProvider[];
  slotOptions: AvailabilitySlot[];
  recommendedSlotStartTime: string | null;
  recommendedProviderServiceId: string | null;
};

type BookingCreateResponse = {
  success: boolean;
  booking: { id: number };
};

type CatalogResponse = {
  canBookForUsers: boolean;
  bookableUsers: BookableUser[];
  selectedUserId: string | null;
  pets: Pet[];
  addresses: SavedAddress[];
  discounts: CatalogDiscount[];
};

type BookingMode = 'home_visit' | 'clinic_visit' | 'teleconsult';

const STEPS = [
  { id: 1, title: 'User & Address' },
  { id: 2, title: 'Service & Discount' },
  { id: 3, title: 'Date & Slot' },
  { id: 4, title: 'Provider Match' },
  { id: 5, title: 'Summary & Create' },
] as const;

function formatAddress(address: SavedAddress) {
  return [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(', ');
}

function resolveBookingMode(value: string | null | undefined): BookingMode {
  if (value === 'clinic_visit' || value === 'teleconsult' || value === 'home_visit') {
    return value;
  }

  return 'home_visit';
}

export default function AdminBookingFlow() {
  const { showToast } = useToast();

  const [step, setStep] = useState<(typeof STEPS)[number]['id']>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [apiError, setApiError] = useState<string | null>(null);

  const [bookableUsers, setBookableUsers] = useState<BookableUser[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [discounts, setDiscounts] = useState<CatalogDiscount[]>([]);

  const [bookingUserSearch, setBookingUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<BookableUser[]>([]);
  const [hasSearchedUsers, setHasSearchedUsers] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const [selectedBookingUserId, setSelectedBookingUserId] = useState<string | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const [serviceType, setServiceType] = useState<string>('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);

  const [bookingDate, setBookingDate] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('');

  const [providerServiceId, setProviderServiceId] = useState<string | null>(null);
  const [providerNotes, setProviderNotes] = useState('');

  const [availability, setAvailability] = useState<AdminFlowAvailabilityResponse>({
    services: [],
    providers: [],
    slotOptions: [],
    recommendedSlotStartTime: null,
    recommendedProviderServiceId: null,
  });

  const selectedUser = useMemo(
    () => bookableUsers.find((item) => item.id === selectedBookingUserId) ?? null,
    [bookableUsers, selectedBookingUserId],
  );

  const selectedAddress = useMemo(
    () => addresses.find((item) => item.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  const selectedProvider = useMemo(
    () => availability.providers.find((item) => item.providerServiceId === providerServiceId) ?? null,
    [availability.providers, providerServiceId],
  );

  const selectedPetName = useMemo(() => pets.find((item) => item.id === petId)?.name ?? null, [pets, petId]);

  const selectedAddressDisplay = useMemo(() => {
    if (!selectedAddress) {
      return 'Not selected';
    }

    return formatAddress(selectedAddress);
  }, [selectedAddress]);

  const pincode = selectedAddress?.pincode?.trim() ?? '';

  const summaryBaseAmount = selectedProvider?.basePrice ?? 0;
  const summaryDiscount = discountPreview?.discountAmount ?? 0;
  const summaryTotal = discountPreview?.finalAmount ?? summaryBaseAmount;

  const suggestedDiscounts = useMemo(() => {
    if (!serviceType) {
      return [] as CatalogDiscount[];
    }

    const normalizedServiceType = serviceType.trim().toLowerCase();

    return discounts.filter((item) => {
      if (item.applies_to_service_type === null) {
        return true;
      }

      return item.applies_to_service_type.trim().toLowerCase() === normalizedServiceType;
    });
  }, [discounts, serviceType]);

  const loadCatalog = useCallback(async (nextUserId: string | null) => {
    const searchParams = new URLSearchParams();

    if (nextUserId) {
      searchParams.set('userId', nextUserId);
    }

    const payload = await apiRequest<CatalogResponse>(
      `/api/bookings/catalog${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
    );

    setBookableUsers(payload.bookableUsers ?? []);
    setPets(payload.pets ?? []);
    setAddresses(payload.addresses ?? []);
    setDiscounts(payload.discounts ?? []);

    const effectiveUserId = nextUserId ?? payload.selectedUserId ?? null;
    setSelectedBookingUserId(effectiveUserId);

    const nextPetId = payload.pets?.[0]?.id ?? null;
    setPetId(nextPetId);

    const defaultAddress =
      (payload.addresses ?? []).find((item) => item.is_default) ??
      (payload.addresses ?? [])[0] ??
      null;

    setSelectedAddressId(defaultAddress?.id ?? null);

    // Reset downstream choices when user context changes.
    setServiceType('');
    setBookingDate('');
    setSlotStartTime('');
    setProviderServiceId(null);
    setDiscountCode('');
    setDiscountPreview(null);
    setProviderNotes('');
    setAvailability({
      services: [],
      providers: [],
      slotOptions: [],
      recommendedSlotStartTime: null,
      recommendedProviderServiceId: null,
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      setIsLoading(true);
      setApiError(null);

      try {
        await loadCatalog(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to load booking catalog.';
        setApiError(message);
        showToast(message, 'error');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [loadCatalog, showToast]);

  const refreshAvailability = useCallback(
    async ({
      targetServiceType,
      targetDate,
      targetStartTime,
      preserveProviderSelection,
    }: {
      targetServiceType?: string;
      targetDate?: string;
      targetStartTime?: string;
      preserveProviderSelection?: boolean;
    }) => {
      if (!pincode) {
        setAvailability({
          services: [],
          providers: [],
          slotOptions: [],
          recommendedSlotStartTime: null,
          recommendedProviderServiceId: null,
        });
        return;
      }

      const query = new URLSearchParams({ pincode });

      if (targetServiceType) {
        query.set('serviceType', targetServiceType);
      }

      if (targetDate) {
        query.set('bookingDate', targetDate);
      }

      if (targetStartTime) {
        query.set('startTime', targetStartTime);
      }

      const payload = await apiRequest<AdminFlowAvailabilityResponse>(`/api/bookings/admin-flow-availability?${query.toString()}`);

      setAvailability(payload);

      if (!targetServiceType) {
        return;
      }

      const keepCurrent = Boolean(
        preserveProviderSelection &&
          providerServiceId &&
          payload.providers.some((item) => item.providerServiceId === providerServiceId),
      );

      if (keepCurrent) {
        return;
      }

      setProviderServiceId(payload.recommendedProviderServiceId ?? payload.providers[0]?.providerServiceId ?? null);

      if (!targetStartTime) {
        setSlotStartTime(payload.recommendedSlotStartTime ?? payload.slotOptions[0]?.startTime ?? '');
      }
    },
    [pincode, providerServiceId],
  );

  useEffect(() => {
    if (!pincode) {
      return;
    }

    startTransition(async () => {
      try {
        await refreshAvailability({});
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load services for selected area.';
        showToast(message, 'error');
      }
    });
  }, [pincode, refreshAvailability, showToast]);

  useEffect(() => {
    if (!serviceType || !pincode) {
      return;
    }

    startTransition(async () => {
      try {
        await refreshAvailability({
          targetServiceType: serviceType,
          targetDate: bookingDate || undefined,
          targetStartTime: slotStartTime || undefined,
          preserveProviderSelection: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to refresh service availability.';
        showToast(message, 'error');
      }
    });
  }, [bookingDate, pincode, refreshAvailability, serviceType, slotStartTime, showToast]);

  useEffect(() => {
    if (!discountCode.trim() || !providerServiceId) {
      return;
    }

    startTransition(async () => {
      try {
        const payload = await apiRequest<{ preview?: DiscountPreview }>('/api/bookings/discount-preview', {
          method: 'POST',
          body: JSON.stringify({
            providerServiceId,
            discountCode: discountCode.trim().toUpperCase(),
            bookingUserId: selectedBookingUserId ?? undefined,
          }),
        });

        setDiscountPreview(payload.preview ?? null);
      } catch {
        setDiscountPreview(null);
      }
    });
  }, [discountCode, providerServiceId, selectedBookingUserId]);

  async function searchUsers() {
    const query = bookingUserSearch.trim();

    if (query.length < 2) {
      showToast('Enter at least 2 characters to search users.', 'error');
      return;
    }

    setHasSearchedUsers(true);
    setIsSearchingUsers(true);

    try {
      const payload = await apiRequest<{ users?: BookableUser[] }>(`/api/bookings/search-user?query=${encodeURIComponent(query)}`);
      setSearchResults(payload.users ?? []);

      if ((payload.users ?? []).length === 0) {
        showToast('No users found.', 'error');
      }
    } catch {
      setSearchResults([]);
      showToast('User search failed.', 'error');
    } finally {
      setIsSearchingUsers(false);
    }
  }

  function canMoveToStep(targetStep: (typeof STEPS)[number]['id']) {
    if (targetStep <= step) {
      return true;
    }

    if (step >= 1) {
      if (!selectedBookingUserId || !petId || !selectedAddressId) {
        showToast('Complete Step 1 before proceeding.', 'error');
        return false;
      }

      if (!pincode) {
        showToast('Selected address must include a valid pincode.', 'error');
        return false;
      }
    }

    if (targetStep >= 3 && !serviceType) {
      showToast('Select a service before choosing slots.', 'error');
      return false;
    }

    if (targetStep >= 4) {
      if (!bookingDate || !slotStartTime) {
        showToast('Select booking date and slot first.', 'error');
        return false;
      }
    }

    if (targetStep >= 5 && !providerServiceId) {
      showToast('Select a provider before reviewing summary.', 'error');
      return false;
    }

    return true;
  }

  function goToStep(targetStep: (typeof STEPS)[number]['id']) {
    if (!canMoveToStep(targetStep)) {
      return;
    }

    setStep(targetStep);
  }

  function applyDiscount() {
    if (!discountCode.trim()) {
      showToast('Enter a discount code.', 'error');
      return;
    }

    if (!providerServiceId) {
      showToast('Select service/date/provider first to validate discount.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        const payload = await apiRequest<{ preview?: DiscountPreview }>('/api/bookings/discount-preview', {
          method: 'POST',
          body: JSON.stringify({
            providerServiceId,
            discountCode: discountCode.trim().toUpperCase(),
            bookingUserId: selectedBookingUserId ?? undefined,
          }),
        });

        if (!payload.preview) {
          setDiscountPreview(null);
          showToast('Discount is not applicable.', 'error');
          return;
        }

        setDiscountPreview(payload.preview);
        setDiscountCode(payload.preview.code);
        showToast('Discount applied.', 'success');
      } catch (error) {
        setDiscountPreview(null);
        const message = error instanceof Error ? error.message : 'Unable to apply discount.';
        showToast(message, 'error');
      }
    });
  }

  function clearDiscount() {
    setDiscountCode('');
    setDiscountPreview(null);
  }

  function submitBooking() {
    if (!selectedBookingUserId || !petId || !selectedAddress || !providerServiceId || !selectedProvider || !bookingDate || !slotStartTime) {
      showToast('Please complete all steps before creating booking.', 'error');
      return;
    }

    const bookingMode = resolveBookingMode(selectedProvider.serviceMode);

    if (bookingMode === 'home_visit' && (selectedAddress.latitude === null || selectedAddress.longitude === null)) {
      showToast('Selected address must include map coordinates for home visit booking.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest<BookingCreateResponse>('/api/bookings/create', {
          method: 'POST',
          body: JSON.stringify({
            petId,
            providerId: selectedProvider.providerId,
            providerServiceId,
            bookingDate,
            startTime: slotStartTime,
            bookingMode,
            locationAddress: bookingMode === 'home_visit' ? formatAddress(selectedAddress) : null,
            latitude: bookingMode === 'home_visit' ? selectedAddress.latitude : null,
            longitude: bookingMode === 'home_visit' ? selectedAddress.longitude : null,
            providerNotes: providerNotes.trim() || null,
            bookingUserId: selectedBookingUserId,
            discountCode: discountCode.trim() ? discountCode.trim().toUpperCase() : undefined,
          }),
        });

        showToast('Booking created successfully.', 'success');
        setStep(1);
        await loadCatalog(selectedBookingUserId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Booking failed.';
        showToast(message, 'error');
      }
    });
  }

  return (
    <AsyncState
      isLoading={isLoading}
      isError={Boolean(apiError)}
      errorMessage={apiError}
      loadingFallback={<div className="rounded-3xl border border-neutral-200 bg-white p-6"><LoadingSkeleton lines={6} /></div>}
    >
      <div className="space-y-5" data-flow-state={isPending ? 'working' : 'ready'}>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
          <h3 className="text-xl font-semibold text-neutral-900">Admin Booking Orchestrator</h3>
          <p className="mt-1 text-sm text-neutral-600">Structured 5-step flow with pincode-aware service, slot, and provider matching.</p>

          <div className="mt-4 flex snap-x gap-2 overflow-x-auto pb-1">
            {STEPS.map((item) => {
              const isActive = item.id === step;
              const isCompleted = item.id < step;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToStep(item.id)}
                  className={`min-w-[170px] rounded-xl border px-3 py-2 text-left transition ${
                    isActive
                      ? 'border-coral bg-orange-50'
                      : isCompleted
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-neutral-200 bg-white hover:border-coral/50'
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Step {item.id}</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">{item.title}</p>
                </button>
              );
            })}
          </div>
        </div>

        {step === 1 ? (
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
            <h4 className="text-base font-semibold text-neutral-900">Step 1. Select User, Pet, Address</h4>
            <p className="mt-1 text-sm text-neutral-600">Search customer, then choose pet and exact service address.</p>

            <form
              className="mt-4 flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void searchUsers();
              }}
            >
              <input
                value={bookingUserSearch}
                onChange={(event) => setBookingUserSearch(event.target.value)}
                placeholder="Search by customer name/email"
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
              />
              <button
                type="submit"
                disabled={isSearchingUsers}
                className="h-11 rounded-xl border border-neutral-200 px-4 text-sm font-semibold hover:border-coral/60"
              >
                {isSearchingUsers ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="mt-3 max-h-48 space-y-2 overflow-auto rounded-xl border border-neutral-200 p-2">
              {isSearchingUsers ? <p className="text-xs text-neutral-500">Searching users...</p> : null}
              {!isSearchingUsers && !hasSearchedUsers ? <p className="text-xs text-neutral-500">Search for a customer to begin.</p> : null}
              {!isSearchingUsers && hasSearchedUsers && searchResults.length === 0 ? (
                <p className="text-xs text-neutral-500">No matching users.</p>
              ) : null}
              {searchResults.map((item) => {
                const selected = selectedBookingUserId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      startTransition(async () => {
                        await loadCatalog(item.id);
                      });
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                      selected ? 'border-coral bg-orange-50' : 'border-neutral-200 bg-white hover:border-coral/50'
                    }`}
                  >
                    <span className="font-medium text-neutral-900">{item.name?.trim() || item.email || item.id}</span>
                    {item.email ? <span className="text-xs text-neutral-500">{item.email}</span> : null}
                  </button>
                );
              })}
            </div>

            {selectedUser ? (
              <div className="mt-4 rounded-xl border border-coral/30 bg-orange-50 px-3 py-2 text-sm text-neutral-700">
                <p className="font-semibold text-neutral-900">Selected customer: {selectedUser.name?.trim() || selectedUser.email || selectedUser.id}</p>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Pet</label>
                <select
                  value={petId ?? ''}
                  onChange={(event) => setPetId(Number(event.target.value))}
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
                >
                  {pets.length === 0 ? <option value="">No pets available</option> : null}
                  {pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Address</label>
                <select
                  value={selectedAddressId ?? ''}
                  onChange={(event) => setSelectedAddressId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
                >
                  {addresses.length === 0 ? <option value="">No saved addresses</option> : null}
                  {addresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label ?? 'Address'} - {address.address_line_1} ({address.pincode || 'No pincode'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="h-11 rounded-xl bg-coral px-5 text-sm font-semibold text-white"
              >
                Continue to Service
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
            <h4 className="text-base font-semibold text-neutral-900">Step 2. Select Service & Apply Discounts</h4>
            <p className="mt-1 text-sm text-neutral-600">Services are filtered by selected address pincode.</p>

            {!pincode ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Select an address with a valid pincode in Step 1.
              </p>
            ) : null}

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {availability.services.length === 0 ? (
                <p className="text-sm text-neutral-500">No active services are currently available for pincode {pincode || 'N/A'}.</p>
              ) : (
                availability.services.map((item) => {
                  const selected = serviceType === item.serviceType;
                  return (
                    <button
                      key={item.serviceType}
                      type="button"
                      onClick={() => {
                        setServiceType(item.serviceType);
                        setBookingDate('');
                        setSlotStartTime('');
                        setProviderServiceId(null);
                        setDiscountPreview(null);
                      }}
                      className={`rounded-xl border p-3 text-left ${
                        selected ? 'border-coral bg-orange-50' : 'border-neutral-200 bg-white hover:border-coral/50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-neutral-900">{item.serviceType}</p>
                      <p className="mt-1 text-xs text-neutral-600">Providers: {item.providerCount}</p>
                      <p className="text-xs text-neutral-600">Price range: Rs.{item.minBasePrice} - Rs.{item.maxBasePrice}</p>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Discount</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={discountCode}
                  onChange={(event) => {
                    setDiscountCode(event.target.value.toUpperCase());
                    setDiscountPreview(null);
                  }}
                  placeholder="Enter discount code"
                  className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={applyDiscount}
                  disabled={isPending}
                  className="h-11 rounded-xl border border-neutral-200 px-4 text-sm font-semibold hover:border-coral/60 disabled:opacity-60"
                >
                  Apply
                </button>
                {discountCode ? (
                  <button
                    type="button"
                    onClick={clearDiscount}
                    className="h-11 rounded-xl border border-neutral-200 px-4 text-sm font-semibold hover:border-coral/60"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              {suggestedDiscounts.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestedDiscounts.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDiscountCode(item.code);
                        setDiscountPreview(null);
                      }}
                      className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:border-coral/50"
                    >
                      {item.code} - {item.title}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 text-xs text-neutral-600">
                <p>Base amount: Rs.{summaryBaseAmount}</p>
                <p>Discount: Rs.{summaryDiscount}</p>
                <p className="font-semibold text-neutral-900">Payable estimate: Rs.{summaryTotal}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="h-11 rounded-xl border border-neutral-200 px-5 text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="h-11 rounded-xl bg-coral px-5 text-sm font-semibold text-white"
              >
                Continue to Slots
              </button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
            <h4 className="text-base font-semibold text-neutral-900">Step 3. Select Date & Recommended Slot</h4>
            <p className="mt-1 text-sm text-neutral-600">Slots are computed from providers available for selected service in this pincode.</p>

            <div className="mt-4 max-w-xs">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Booking Date</label>
              <input
                type="date"
                value={bookingDate}
                onChange={(event) => {
                  setBookingDate(event.target.value);
                  setSlotStartTime('');
                }}
                className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm"
              />
            </div>

            {bookingDate ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {availability.slotOptions.length === 0 ? (
                  <p className="text-sm text-neutral-500">No slots available for this date in selected area.</p>
                ) : (
                  availability.slotOptions.map((slot) => {
                    const selected = slotStartTime === slot.startTime;
                    return (
                      <button
                        key={`${slot.startTime}-${slot.endTime}`}
                        type="button"
                        onClick={() => setSlotStartTime(slot.startTime)}
                        className={`rounded-xl border p-3 text-left ${
                          selected ? 'border-coral bg-orange-50' : 'border-neutral-200 bg-white hover:border-coral/50'
                        }`}
                      >
                        <p className="text-sm font-semibold text-neutral-900">{slot.startTime} - {slot.endTime}</p>
                        <p className="mt-1 text-xs text-neutral-600">{slot.availableProviderCount} providers available</p>
                        {slot.recommended ? <p className="mt-1 text-xs font-semibold text-coral">Recommended</p> : null}
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="h-11 rounded-xl border border-neutral-200 px-5 text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => goToStep(4)}
                className="h-11 rounded-xl bg-coral px-5 text-sm font-semibold text-white"
              >
                Continue to Providers
              </button>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
            <h4 className="text-base font-semibold text-neutral-900">Step 4. Provider Selection</h4>
            <p className="mt-1 text-sm text-neutral-600">Auto-assigned best match is preselected. Click any other provider to override.</p>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {availability.providers.length === 0 ? (
                <p className="text-sm text-neutral-500">No providers match this service/date/slot combination.</p>
              ) : (
                availability.providers.map((provider) => {
                  const selected = providerServiceId === provider.providerServiceId;

                  return (
                    <button
                      key={provider.providerServiceId}
                      type="button"
                      onClick={() => setProviderServiceId(provider.providerServiceId)}
                      className={`rounded-xl border p-3 text-left ${
                        selected ? 'border-coral bg-orange-50' : 'border-neutral-200 bg-white hover:border-coral/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">{provider.providerName}</p>
                          <p className="text-xs text-neutral-600">{provider.providerType ?? 'Provider'}</p>
                        </div>
                        {provider.recommended ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Auto</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-neutral-700">Service: {provider.serviceType}</p>
                      <p className="text-xs text-neutral-700">Price: Rs.{provider.basePrice}</p>
                      <p className="text-xs text-neutral-700">Duration: {provider.serviceDurationMinutes} mins</p>
                      <p className={`mt-1 text-xs font-medium ${provider.availableForSelectedSlot ? 'text-emerald-700' : 'text-red-600'}`}>
                        {provider.availableForSelectedSlot ? 'Available for selected slot' : 'Not available for selected slot'}
                      </p>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="h-11 rounded-xl border border-neutral-200 px-5 text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => goToStep(5)}
                className="h-11 rounded-xl bg-coral px-5 text-sm font-semibold text-white"
              >
                Continue to Summary
              </button>
            </div>
          </section>
        ) : null}

        {step === 5 ? (
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
            <h4 className="text-base font-semibold text-neutral-900">Step 5. Final Booking Summary</h4>
            <p className="mt-1 text-sm text-neutral-600">Review all selections and create booking.</p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Customer</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{selectedUser?.name?.trim() || selectedUser?.email || 'Not selected'}</p>
                <p className="mt-1 text-xs text-neutral-700">Pet: {selectedPetName ?? 'Not selected'}</p>
                <p className="mt-1 text-xs text-neutral-700">Address: {selectedAddressDisplay}</p>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Service Plan</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{serviceType || 'Not selected'}</p>
                <p className="mt-1 text-xs text-neutral-700">Date: {bookingDate || 'Not selected'}</p>
                <p className="mt-1 text-xs text-neutral-700">Slot: {slotStartTime || 'Not selected'}</p>
                <p className="mt-1 text-xs text-neutral-700">Provider: {selectedProvider?.providerName ?? 'Not selected'}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Pricing</p>
              <div className="mt-2 space-y-1 text-sm text-neutral-700">
                <p>Base amount: Rs.{summaryBaseAmount}</p>
                <p>Discount: -Rs.{summaryDiscount}</p>
                <p className="font-semibold text-neutral-900">Total: Rs.{summaryTotal}</p>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Admin / Provider Notes (Optional)</label>
              <textarea
                value={providerNotes}
                onChange={(event) => setProviderNotes(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                placeholder="Internal context for assigned provider"
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => goToStep(4)}
                className="h-11 rounded-xl border border-neutral-200 px-5 text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submitBooking}
                disabled={isPending}
                className="h-11 rounded-xl bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-6 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isPending ? 'Creating Booking...' : 'Create Booking'}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </AsyncState>
  );
}
