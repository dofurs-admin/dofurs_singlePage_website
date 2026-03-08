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
  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      const providerType = (provider.provider_type || provider.type || '').toLowerCase();

      if (bookingMode === 'clinic_visit') {
        return providerType.includes('clinic') || providerType.includes('center') || providerType.includes('grooming');
      }

      return !providerType.includes('clinic') && !providerType.includes('center') && !providerType.includes('grooming');
    });
  }, [providers, bookingMode]);

  const canContinue = Boolean(selectedProviderId) && Boolean(selectedServiceId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-950">Step 1: Select Service</h2>
        <p className="mt-2 text-sm text-neutral-600">Choose booking mode, provider, and service</p>
      </div>

      <div>
        <label className="mb-3 block text-sm font-semibold text-neutral-950">Service Type</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => {
              onBookingModeChange('home_visit');
              onProviderChange(null);
            }}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              bookingMode === 'home_visit'
                ? 'border-coral bg-orange-50'
                : 'border-neutral-200 bg-white hover:border-coral/30'
            }`}
          >
            <h3 className="font-semibold text-neutral-950">Home Visit</h3>
            <p className="mt-1 text-xs text-neutral-600">Service at your home</p>
          </button>

          <button
            onClick={() => {
              onBookingModeChange('clinic_visit');
              onProviderChange(null);
            }}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              bookingMode === 'clinic_visit'
                ? 'border-coral bg-orange-50'
                : 'border-neutral-200 bg-white hover:border-coral/30'
            }`}
          >
            <h3 className="font-semibold text-neutral-950">Clinic Visit</h3>
            <p className="mt-1 text-xs text-neutral-600">Service at a clinic or center</p>
          </button>
        </div>
      </div>

      <div>
        <label className="mb-3 block text-sm font-semibold text-neutral-950">
          Select {bookingMode === 'clinic_visit' ? 'Clinic or Center' : 'Provider'}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
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
            <h3 className="font-semibold text-neutral-950">Auto-Select</h3>
            <p className="mt-1 text-xs text-neutral-600">Our system picks the best available provider</p>
          </button>

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

      <div>
        <label className="mb-3 block text-sm font-semibold text-neutral-950">Select Service</label>
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
                  {service.service_duration_minutes} mins • Rs.{service.base_price}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#cf8448] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to Pet Selection
        </button>
      </div>
    </div>
  );
}
