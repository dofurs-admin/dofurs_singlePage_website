'use client';

import { useMemo } from 'react';

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

interface ServiceSelectionStepProps {
  providers: Provider[];
  services: Service[];
  selectedProviderId: number | null;
  selectedServiceId: string | null;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  selectedAutoProvider: boolean;
  onBookingModeChange: (mode: 'home_visit' | 'clinic_visit') => void;
  onProviderChange: (providerId: number | null) => void;
  onAutoProviderSelect: (auto: boolean) => void;
  onServiceChange: (serviceId: string) => void;
  onNext: () => void;
}

export default function ServiceSelectionStep({
  providers,
  services,
  selectedProviderId,
  selectedServiceId,
  bookingMode,
  selectedAutoProvider,
  onBookingModeChange,
  onProviderChange,
  onAutoProviderSelect,
  onServiceChange,
  onNext,
}: ServiceSelectionStepProps) {
  // Filter providers based on booking mode
  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      const providerType = (provider.provider_type || provider.type || '').toLowerCase();
      
      if (bookingMode === 'clinic_visit') {
        // Show clinics, grooming centers, veterinary clinics
        return providerType.includes('clinic') || providerType.includes('center') || providerType.includes('grooming');
      } else {
        // Home visit - show individual providers (those without clinic/center in type)
        return !providerType.includes('clinic') && !providerType.includes('center') && !providerType.includes('grooming');
      }
    });
  }, [providers, bookingMode]);
  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div>
        <h2 className="text-2xl font-semibold text-neutral-950">Step 1: Select Service Type</h2>
        <p className="mt-2 text-sm text-neutral-600">Choose how you'd like to book the service</p>
      </div>

      {/* Booking mode selection */}
      <div>
        <label className="block text-sm font-semibold text-neutral-950 mb-3">Service Type</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => {
              onBookingModeChange('home_visit');
              onProviderChange(null as any);
            }}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              bookingMode === 'home_visit'
                ? 'border-coral bg-orange-50'
                : 'border-neutral-200 bg-white hover:border-coral/30'
            }`}
          >
            <h3 className="font-semibold text-neutral-950">🏠 Home Visit</h3>
            <p className="mt-1 text-xs text-neutral-600">Service at your home</p>
            {bookingMode === 'home_visit' && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-coral">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>

          <button
            onClick={() => {
              onBookingModeChange('clinic_visit');
              onProviderChange(null as any);
            }}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              bookingMode === 'clinic_visit'
                ? 'border-coral bg-orange-50'
                : 'border-neutral-200 bg-white hover:border-coral/30'
            }`}
          >
            <h3 className="font-semibold text-neutral-950">🏥 Clinic Visit</h3>
            <p className="mt-1 text-xs text-neutral-600">Service at a clinic or center</p>
            {bookingMode === 'clinic_visit' && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-coral">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Provider selection */}
      <div>
        <label className="block text-sm font-semibold text-neutral-950 mb-3">
          Select {bookingMode === 'clinic_visit' ? 'Clinic or Center' : 'Provider'}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Auto Provider Card */}
          <button
            onClick={() => {
              onAutoProviderSelect(true);
              onProviderChange(null);
            }}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              selectedAutoProvider
                ? 'border-coral bg-orange-50'
                : 'border-neutral-200 bg-white hover:border-coral/30'
            }`}
          >
            <h3 className="font-semibold text-neutral-950">✨ Auto-Select</h3>
            <p className="mt-1 text-xs text-neutral-600">
              Our system picks the best available provider
            </p>
            {selectedAutoProvider && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-coral">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>

          {/* Individual Provider Cards */}
          {filteredProviders.map((provider) => (
            <button
              key={provider.id}
              onClick={() => {
                onAutoProviderSelect(false);
                onProviderChange(provider.id);
              }}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                !selectedAutoProvider && selectedProviderId === provider.id
                  ? 'border-coral bg-orange-50'
                  : 'border-neutral-200 bg-white hover:border-coral/30'
              }`}
            >
              <h3 className="font-semibold text-neutral-950">{provider.name}</h3>
              <p className="mt-1 text-xs text-neutral-600">
                {provider.provider_type || provider.type || (bookingMode === 'clinic_visit' ? 'Clinic' : 'Provider')}
              </p>
              {!selectedAutoProvider && selectedProviderId === provider.id && (
                <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-coral">
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
        {filteredProviders.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-neutral-200 p-4 text-center">
            <p className="text-sm text-neutral-500">
              No {bookingMode === 'clinic_visit' ? 'clinics' : 'providers'} available
            </p>
          </div>
        )}
      </div>

      {/* Service selection */}
      <div>
        <label className="block text-sm font-semibold text-neutral-950 mb-3">Select Service</label>
        {services.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-neutral-200 p-4 text-center">
            <p className="text-sm text-neutral-500">No services available for this provider</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => onServiceChange(service.id)}
                className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                  selectedServiceId === service.id
                    ? 'border-coral bg-orange-50'
                    : 'border-neutral-200 bg-white hover:border-coral/30'
                }`}
              >
                <h3 className="font-semibold text-neutral-950">{service.service_type}</h3>
                <p className="mt-1 text-xs text-neutral-600">
                  {service.service_duration_minutes} mins • ₹{service.base_price}
                </p>
                {selectedServiceId === service.id && (
                  <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-coral">
                    <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Next button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={!selectedProviderId || !selectedServiceId}
          className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#cf8448] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue → Pet Selection
        </button>
      </div>
    </div>
  );
}
