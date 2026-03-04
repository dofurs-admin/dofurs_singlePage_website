'use client';

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
type Provider = { id: number; name: string; provider_type?: string | null; type?: string | null };
type PricingBreakdown = {
  base_total: number;
  discount_amount: number;
  final_total: number;
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
type BookingStep = 'service' | 'pet' | 'datetime' | 'review';

interface BookingSummarySidebarProps {
  step: BookingStep;
  service: Service | undefined;
  pet: Pet | undefined;
  provider: Provider | undefined;
  bookingDate: string;
  slotStartTime: string;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  priceCalculation: PricingBreakdown | null;
  discountPreview: DiscountPreview | null;
  addOns: ServiceAddon[];
  selectedAddOns: Record<string, number>;
}

export default function BookingSummarySidebar({
  step,
  service,
  pet,
  provider,
  bookingDate,
  slotStartTime,
  bookingMode,
  priceCalculation,
  discountPreview,
  addOns,
  selectedAddOns,
}: BookingSummarySidebarProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const stepLabels = {
    service: 'Service',
    pet: 'Pet',
    datetime: 'Date & Time',
    review: 'Review',
  };

  const stepNumber = {
    service: 1,
    pet: 2,
    datetime: 3,
    review: 4,
  };

  const totalPrice = discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0;
  const basePrice = discountPreview?.baseAmount ?? priceCalculation?.base_total ?? 0;
  const discountAmount = discountPreview?.discountAmount ?? priceCalculation?.discount_amount ?? 0;

  const selectedAddOnsTotal = addOns
    .filter((addon) => selectedAddOns[addon.id] > 0)
    .reduce((sum, addon) => sum + addon.price * selectedAddOns[addon.id], 0);

  return (
    <div className="lg:sticky lg:top-6 h-fit">
      <div className="rounded-2xl border-2 border-coral/20 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
        {/* Header */}
        <h3 className="text-lg font-semibold text-neutral-950">Booking Summary</h3>
        <p className="mt-1 text-xs text-neutral-600">Step {stepNumber[step]} of 4</p>

        {/* Progress indicator */}
        <div className="mt-4 space-y-2">
          {(['service', 'pet', 'datetime', 'review'] as BookingStep[]).map((s) => {
            const isCompleted = ['service', 'pet', 'datetime'].indexOf(s) < ['service', 'pet', 'datetime'].indexOf(step);
            const isCurrent = s === step;

            return (
              <div
                key={s}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  isCurrent ? 'bg-white border-2 border-coral' : isCompleted ? 'bg-green-50' : 'bg-neutral-100'
                }`}
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                        ? 'bg-coral text-white'
                        : 'bg-neutral-300 text-neutral-600'
                  }`}
                >
                  {isCompleted ? '✓' : stepNumber[s]}
                </div>
                <span className={`font-medium ${isCurrent ? 'text-coral' : isCompleted ? 'text-green-700' : 'text-neutral-600'}`}>
                  {stepLabels[s]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-gradient-to-r from-coral/20 via-coral/10 to-transparent" />

        {/* Selection details */}
        <div className="space-y-3">
          {bookingMode && (
            <div>
              <p className="text-xs font-semibold text-neutral-600 uppercase">Service Type</p>
              <p className="mt-1 font-medium text-neutral-950">
                {bookingMode === 'home_visit' && '🏠 Home Visit'}
                {bookingMode === 'clinic_visit' && '🏥 Clinic Visit'}
                {bookingMode === 'teleconsult' && '💻 Teleconsult'}
              </p>
            </div>
          )}

          {provider && (
            <div>
              <p className="text-xs font-semibold text-neutral-600 uppercase">
                {bookingMode === 'clinic_visit' ? 'Clinic' : 'Provider'}
              </p>
              <p className="mt-1 font-medium text-neutral-950">{provider.name}</p>
            </div>
          )}

          {service && (
            <div>
              <p className="text-xs font-semibold text-neutral-600 uppercase">Service</p>
              <p className="mt-1 font-medium text-neutral-950">{service.service_type}</p>
              <p className="text-xs text-neutral-600">₹{service.base_price} • {service.service_duration_minutes} mins</p>
            </div>
          )}

          {pet && (
            <div>
              <p className="text-xs font-semibold text-neutral-600 uppercase">Pet</p>
              <p className="mt-1 font-medium text-neutral-950">🐾 {pet.name}</p>
            </div>
          )}

          {bookingDate && (
            <div>
              <p className="text-xs font-semibold text-neutral-600 uppercase">Date & Time</p>
              <p className="mt-1 font-medium text-neutral-950">{formatDate(bookingDate)}</p>
              {slotStartTime && <p className="text-xs text-neutral-600">⏰ {slotStartTime}</p>}
            </div>
          )}
        </div>

        {/* Divider */}
        {(basePrice > 0 || selectedAddOnsTotal > 0) && (
          <>
            <div className="my-4 h-px bg-gradient-to-r from-coral/20 via-coral/10 to-transparent" />

            {/* Price breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Base price</span>
                <span className="font-semibold text-neutral-950">₹{basePrice}</span>
              </div>

              {selectedAddOnsTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Add-ons</span>
                  <span className="font-semibold text-neutral-950">₹{selectedAddOnsTotal}</span>
                </div>
              )}

              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Discount</span>
                  <span className="font-semibold text-green-700">-₹{discountAmount}</span>
                </div>
              )}

              <div className="border-t-2 border-coral/20 pt-2 flex justify-between">
                <span className="font-semibold text-neutral-950">Total</span>
                <span className="text-xl font-bold text-coral">₹{totalPrice}</span>
              </div>

              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                💳 Direct payment with provider. No platform service fee.
              </p>
            </div>
          </>
        )}

        {/* Info banner */}
        <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
          <p className="text-xs text-blue-900">
            ✨ Complete booking in <strong>3&ndash;4 clicks</strong>. You&apos;re making great progress!
          </p>
        </div>
      </div>
    </div>
  );
}
