'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import AsyncState from '@/components/ui/AsyncState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import type { PricingBreakdown } from '@/lib/bookings/types';
import { apiRequest } from '@/lib/api/client';
import { bookingCreateSchema } from '@/lib/flows/validation';
import PremiumBookingConfirmation from './PremiumBookingConfirmation';
import ServiceSelectionStep from './steps/ServiceSelectionStep';
import PetSelectionStep from './steps/PetSelectionStep';
import DateTimeSlotStep from './steps/DateTimeSlotStep';
import ReviewConfirmStep from './steps/ReviewConfirmStep';
import BookingSummarySidebar from './BookingSummarySidebar';

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
type BookingCreateResponse = {
  success: boolean;
  booking: { id: number };
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
  addOns?: Array<{ id: string; quantity: number }>;
};

type BookingStep = 'service' | 'pet' | 'datetime' | 'review';

export default function PremiumUserBookingFlow() {
  // Catalog data
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [discounts, setDiscounts] = useState<CatalogDiscount[]>([]);

  // Booking selections
  const [currentStep, setCurrentStep] = useState<BookingStep>('service');
  const [providerId, setProviderId] = useState<number | null>(null);
  const [selectedAutoProvider, setSelectedAutoProvider] = useState(true);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('');
  const [bookingMode, setBookingMode] = useState<'home_visit' | 'clinic_visit' | 'teleconsult'>('home_visit');
  const [locationAddress, setLocationAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [providerNotes, setProviderNotes] = useState('');

  // Slots and pricing
  const [slots, setSlots] = useState<Slot[]>([]);
  const [priceCalculation, setPriceCalculation] = useState<PricingBreakdown | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);
  const [serviceAddOns, setServiceAddOns] = useState<ServiceAddon[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [flowState, setFlowState] = useState<'collecting' | 'submitting' | 'success' | 'error'>('collecting');
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastBookingSummary, setLastBookingSummary] = useState<{
    bookingDate: string;
    slotStartTime: string;
    bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
    providerName?: string;
    petName?: string;
    totalAmount: number;
  } | null>(null);

  const { showToast } = useToast();

  // Load initial catalog on mount
  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setIsLoading(true);
      setApiError(null);

      try {
        const payload = await apiRequest<{
          providers: Provider[];
          services: Service[];
          pets: Pet[];
          addresses?: SavedAddress[];
          discounts?: CatalogDiscount[];
        }>('/api/bookings/catalog');

        if (!isMounted) return;

        setProviders(payload.providers);
        setServices(payload.services);
        setPets(payload.pets);
        setSavedAddresses(payload.addresses ?? []);
        setDiscounts(payload.discounts ?? []);

        // Preselect defaults
        const preferredProvider =
          Number(globalThis.localStorage?.getItem('booking.preferredProviderId') ?? 0) ||
          payload.providers[0]?.id ||
          null;
        setProviderId(preferredProvider);

        // Preselect default pet
        setPetId(payload.pets[0]?.id ?? null);

        // Preselect default booking mode
        setBookingMode('home_visit');

        const defaultAddress = (payload.addresses ?? []).find((item) => item.is_default) ?? (payload.addresses ?? [])[0];
        if (defaultAddress) {
          const formattedAddress = [
            defaultAddress.address_line_1,
            defaultAddress.address_line_2,
            defaultAddress.city,
            defaultAddress.state,
            defaultAddress.pincode,
            defaultAddress.country,
          ]
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .join(', ');
          setLocationAddress(formattedAddress);
          setSelectedSavedAddressId(defaultAddress.id);
          if (defaultAddress.latitude !== null && defaultAddress.longitude !== null) {
            setLatitude(String(defaultAddress.latitude));
            setLongitude(String(defaultAddress.longitude));
          }
        } else {
          const lastAddress = globalThis.localStorage?.getItem('booking.lastUsedAddress');
          if (lastAddress) {
            setLocationAddress(lastAddress);
          }
        }
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
  }, [showToast]);

  const providerServices = useMemo(
    () => services.filter((service) => service.provider_id === providerId && service.source === 'provider_services'),
    [services, providerId],
  );

  // Auto-select first service when provider changes
  useEffect(() => {
    const firstService = providerServices[0]?.id ?? null;
    setServiceId(firstService);
  }, [providerServices]);

  // Auto-select first available provider when Auto mode is enabled
  useEffect(() => {
    if (!selectedAutoProvider || !bookingMode) return;

    const filteredProviders = providers.filter((provider) => {
      const providerType = (provider.provider_type || provider.type || '').toLowerCase();
      if (bookingMode === 'clinic_visit') {
        return providerType.includes('clinic') || providerType.includes('center') || providerType.includes('grooming');
      }
      return !providerType.includes('clinic') && !providerType.includes('center') && !providerType.includes('grooming');
    });

    const firstProvider = filteredProviders[0];
    if (firstProvider) {
      setProviderId(firstProvider.id);
    }
  }, [selectedAutoProvider, bookingMode, providers]);

  // Load add-ons when service changes
  useEffect(() => {
    if (!serviceId) {
      setServiceAddOns([]);
      setSelectedAddOns({});
      return;
    }

    let isMounted = true;

    async function loadAddOns() {
      try {
        const payload = await apiRequest<{ success: boolean; data: ServiceAddon[] }>(`/api/services/addons/${serviceId}`);
        if (!isMounted) return;
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
  }, [serviceId]);

  // Load slots when date or service changes
  useEffect(() => {
    if (!bookingDate || !providerId) {
      setSlots([]);
      setSlotStartTime('');
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

        if (!isMounted) return;
        setSlots(payload.slots ?? []);
        setSlotStartTime(payload.slots?.[0]?.start_time ?? '');
      } catch {
        if (isMounted) {
          setSlots([]);
          setSlotStartTime('');
        }
      }
    }

    loadSlots();

    return () => {
      isMounted = false;
    };
  }, [bookingDate, providerId, serviceId, services]);

  // Calculate pricing
  useEffect(() => {
    if (!providerId) {
      setPriceCalculation(null);
      return;
    }

    if (!serviceId) {
      setPriceCalculation(null);
      return;
    }

    let isMounted = true;

    async function calculatePrice() {
      const resolvedProviderId = providerId;
      if (!resolvedProviderId) {
        return;
      }

      try {
        const payload = await apiRequest<{ success: boolean; data: PricingBreakdown }>('/api/services/calculate-price', {
          method: 'POST',
          body: JSON.stringify({
            bookingType: 'service',
            serviceId,
            providerId: resolvedProviderId.toString(),
            addOns: Object.entries(selectedAddOns)
              .filter(([, qty]) => qty > 0)
              .map(([id, quantity]) => ({ id, quantity })),
          }),
        });

        if (!isMounted) return;
        setPriceCalculation(payload.data ?? null);
      } catch {
        if (isMounted) {
          setPriceCalculation(null);
        }
      }
    }

    calculatePrice();

    return () => {
      isMounted = false;
    };
  }, [providerId, serviceId, selectedAddOns]);

  // Clear discount when service changes
  useEffect(() => {
    setDiscountCode('');
    setDiscountPreview(null);
  }, [serviceId]);

  const handleNextStep = () => {
    // Validate current step
    if (currentStep === 'service') {
      if (!bookingMode) {
        showToast('Please select a service type (home visit or clinic visit)', 'error');
        return;
      }
      if (!selectedAutoProvider && !providerId) {
        showToast(
          `Please select a ${bookingMode === 'clinic_visit' ? 'clinic' : 'provider'}`,
          'error',
        );
        return;
      }
      if (!serviceId) {
        showToast('Please select a service', 'error');
        return;
      }
    }
    if (currentStep === 'pet' && !petId) {
      showToast('Please select a pet', 'error');
      return;
    }
    if (currentStep === 'datetime' && (!bookingDate || !slotStartTime)) {
      showToast('Please select date and time', 'error');
      return;
    }

    const steps: BookingStep[] = ['service', 'pet', 'datetime', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handlePreviousStep = () => {
    const steps: BookingStep[] = ['service', 'pet', 'datetime', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const applyDiscount = async (code: string) => {
    if (!serviceId) {
      showToast('Select a service before applying discount', 'error');
      return false;
    }

    try {
      const payload = await apiRequest<{ preview?: DiscountPreview }>('/api/bookings/discount-preview', {
        method: 'POST',
        body: JSON.stringify({
          providerServiceId: serviceId,
          discountCode: code.trim().toUpperCase(),
        }),
      });

      if (payload?.preview) {
        setDiscountCode(payload.preview.code);
        setDiscountPreview(payload.preview);
        return true;
      } else {
        setDiscountPreview(null);
        showToast('Discount code not valid', 'error');
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply discount';
      showToast(message, 'error');
      return false;
    }
  };

  const submitBooking = async () => {
    // Final validation
    if (!providerId || !petId || !bookingDate || !slotStartTime) {
      showToast('Please complete all steps', 'error');
      return;
    }

    if (bookingMode === 'home_visit' && (!locationAddress.trim() || !latitude || !longitude)) {
      showToast('For home visit, add your address and use location detection.', 'error');
      return;
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
        discountCode: discountCode.trim() ? discountCode.trim().toUpperCase() : undefined,
        addOns: Object.entries(selectedAddOns)
          .filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => ({ id, quantity })),
      };

      basePayload.providerServiceId = serviceId;

      const validationPayload = {
        ...basePayload,
        bookingType: 'service' as const,
        providerServiceId: basePayload.providerServiceId,
      };

      const clientValidation = bookingCreateSchema.safeParse(validationPayload);

      if (!clientValidation.success) {
        setFlowState('error');
        showToast('Please review booking details', 'error');
        return;
      }

      try {
        await apiRequest<BookingCreateResponse>('/api/bookings/create', {
          method: 'POST',
          body: JSON.stringify(basePayload),
        });

        // Save preferences
        globalThis.localStorage?.setItem('booking.preferredProviderId', String(providerId));
        if (serviceId) {
          globalThis.localStorage?.setItem('booking.preferredServiceId', serviceId);
        }
        if (bookingMode === 'home_visit' && locationAddress.trim()) {
          globalThis.localStorage?.setItem('booking.lastUsedAddress', locationAddress.trim());
        }

        const providerName = providers.find((p) => p.id === providerId)?.name;
        const petName = pets.find((p) => p.id === petId)?.name;

        setLastBookingSummary({
          bookingDate,
          slotStartTime,
          bookingMode,
          providerName,
          petName,
          totalAmount: discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0,
        });

        setFlowState('success');
        showToast('Booking created successfully', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Booking failed. Please try again.';
        setFlowState('error');
        showToast(message, 'error');
      }
    });
  };

  return (
    <AsyncState
      isLoading={isLoading}
      isError={Boolean(apiError)}
      errorMessage={apiError}
      loadingFallback={<div className="rounded-3xl border border-[#f2dfcf] bg-white p-6"><LoadingSkeleton lines={5} /></div>}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main booking flow */}
        <div className="lg:col-span-2 space-y-6">
          {currentStep === 'service' && (
            <ServiceSelectionStep
              providers={providers}
              services={providerServices}
              selectedProviderId={providerId}
              selectedServiceId={serviceId}
              bookingMode={bookingMode}
              selectedAutoProvider={selectedAutoProvider}
              onAutoProviderSelect={setSelectedAutoProvider}
              onBookingModeChange={setBookingMode}
              onProviderChange={setProviderId}
              onServiceChange={setServiceId}
              onNext={handleNextStep}
            />
          )}

          {currentStep === 'pet' && (
            <PetSelectionStep
              pets={pets}
              selectedPetId={petId}
              onPetChange={setPetId}
              onNext={handleNextStep}
              onPrev={handlePreviousStep}
            />
          )}

          {currentStep === 'datetime' && (
            <DateTimeSlotStep
              slots={slots}
              selectedDate={bookingDate}
              selectedSlot={slotStartTime}
              bookingMode={bookingMode}
              locationAddress={locationAddress}
              latitude={latitude}
              longitude={longitude}
              savedAddresses={savedAddresses}
              selectedSavedAddressId={selectedSavedAddressId}
              providerNotes={providerNotes}
              onDateChange={setBookingDate}
              onSlotChange={setSlotStartTime}
              onBookingModeChange={setBookingMode}
              onLocationChange={setLocationAddress}
              onLatitudeChange={setLatitude}
              onLongitudeChange={setLongitude}
              onSelectSavedAddress={setSelectedSavedAddressId}
              onNotesChange={setProviderNotes}
              onNext={handleNextStep}
              onPrev={handlePreviousStep}
            />
          )}

          {currentStep === 'review' && (
            <ReviewConfirmStep
              selectedService={services.find((s) => s.id === serviceId)}
              selectedPet={pets.find((p) => p.id === petId)}
              selectedProvider={providers.find((p) => p.id === providerId)}
              bookingDate={bookingDate}
              slotStartTime={slotStartTime}
              bookingMode={bookingMode}
              locationAddress={locationAddress}
              providerNotes={providerNotes}
              priceCalculation={priceCalculation}
              discountPreview={discountPreview}
              discountCode={discountCode}
              onDiscountCodeChange={setDiscountCode}
              onApplyDiscount={applyDiscount}
              onPrev={handlePreviousStep}
              onConfirm={submitBooking}
              isPending={isPending}
            />
          )}

          {flowState === 'success' && lastBookingSummary && (
            <PremiumBookingConfirmation
              bookingDate={lastBookingSummary.bookingDate}
              slotStartTime={lastBookingSummary.slotStartTime}
              bookingMode={lastBookingSummary.bookingMode}
              providerName={lastBookingSummary.providerName}
              petName={lastBookingSummary.petName}
              totalAmount={lastBookingSummary.totalAmount}
            />
          )}
        </div>

        {/* Sticky summary sidebar */}
        <BookingSummarySidebar
          step={currentStep}
          service={services.find((s) => s.id === serviceId)}
          pet={pets.find((p) => p.id === petId)}
          provider={providers.find((p) => p.id === providerId)}
          bookingDate={bookingDate}
          slotStartTime={slotStartTime}
          bookingMode={bookingMode}
          priceCalculation={priceCalculation}
          discountPreview={discountPreview}
          addOns={serviceAddOns}
          selectedAddOns={selectedAddOns}
        />
      </div>
    </AsyncState>
  );
}
