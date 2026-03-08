'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

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

interface ReviewConfirmStepProps {
  selectedService: Service | undefined;
  selectedPet: Pet | undefined;
  selectedProvider: Provider | undefined;
  bookingDate: string;
  slotStartTime: string;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  locationAddress: string;
  providerNotes: string;
  priceCalculation: PricingBreakdown | null;
  discountPreview: DiscountPreview | null;
  discountCode: string;
  onDiscountCodeChange: (code: string) => void;
  onApplyDiscount: (code: string) => Promise<boolean>;
  onPrev: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export default function ReviewConfirmStep({
  selectedService,
  selectedPet,
  selectedProvider,
  bookingDate,
  slotStartTime,
  bookingMode,
  locationAddress,
  providerNotes,
  priceCalculation,
  discountPreview,
  discountCode,
  onDiscountCodeChange,
  onApplyDiscount,
  onPrev,
  onConfirm,
  isPending,
}: ReviewConfirmStepProps) {
  const { showToast } = useToast();
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) {
      showToast('Enter a discount code', 'error');
      return;
    }

    setIsApplyingDiscount(true);
    const success = await onApplyDiscount(discountCode);
    setIsApplyingDiscount(false);
  };

  const totalAmount = discountPreview?.finalAmount ?? priceCalculation?.final_total ?? 0;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div>
        <h2 className="text-2xl font-semibold text-neutral-950">Step 4: Review & Confirm</h2>
        <p className="mt-2 text-sm text-neutral-600">Double-check everything before booking</p>
      </div>

      {/* Booking summary cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Service card */}
        <div className="rounded-lg border-2 border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase">Service</p>
          <p className="mt-2 text-base font-semibold text-neutral-950">{selectedService?.service_type}</p>
          <p className="mt-1 text-xs text-neutral-600">
            {selectedService?.service_duration_minutes} mins • ₹{selectedService?.base_price}
          </p>
        </div>

        {/* Pet card */}
        <div className="rounded-lg border-2 border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase">Pet</p>
          <p className="mt-2 text-base font-semibold text-neutral-950">🐾 {selectedPet?.name}</p>
          <p className="mt-1 text-xs text-neutral-600">Ready for service</p>
        </div>

        {/* Provider card */}
        <div className="rounded-lg border-2 border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase">Clinic / Provider</p>
          <p className="mt-2 text-base font-semibold text-neutral-950">{selectedProvider?.name}</p>
          <p className="mt-1 text-xs text-neutral-600">
            {selectedProvider?.provider_type || selectedProvider?.type || 'Provider'}
          </p>
        </div>

        {/* Date & Time card */}
        <div className="rounded-lg border-2 border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase">Date & Time</p>
          <p className="mt-2 text-base font-semibold text-neutral-950">{formatDate(bookingDate)}</p>
          <p className="mt-1 text-xs text-neutral-600">⏰ {slotStartTime}</p>
        </div>
      </div>

      {/* Location and notes */}
      <div className="space-y-3">
        <div className="rounded-lg border-2 border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase">Booking Mode</p>
          <p className="mt-2 text-base font-semibold text-neutral-950">
            {bookingMode === 'home_visit' && '🏠 Home Visit'}
            {bookingMode === 'clinic_visit' && '🏥 Clinic Visit'}
            {bookingMode === 'teleconsult' && '💻 Teleconsult'}
          </p>
          {bookingMode === 'home_visit' && locationAddress && (
            <p className="mt-2 text-xs text-neutral-600">📍 {locationAddress}</p>
          )}
        </div>

        {providerNotes && (
          <div className="rounded-lg border-2 border-neutral-200 bg-white p-4">
            <p className="text-xs font-semibold text-neutral-600 uppercase">Notes</p>
            <p className="mt-2 text-sm text-neutral-950">{providerNotes}</p>
          </div>
        )}
      </div>

      {/* Discount section */}
      <div className="rounded-lg border-2 border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm font-semibold text-neutral-950 mb-3">💰 Have a coupon?</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={discountCode}
            onChange={(e) => onDiscountCodeChange(e.target.value.toUpperCase())}
            placeholder="Enter discount code"
            className="flex-1 rounded-lg border-2 border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
          />
          <button
            onClick={handleApplyDiscount}
            disabled={isApplyingDiscount || !discountCode.trim()}
            className="rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-[#cf8448] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
        {discountPreview && (
          <p className="mt-2 text-xs font-medium text-green-700">
            ✓ Discount applied: {discountPreview.discountType === 'percentage' ? `${discountPreview.discountValue}%` : `₹${discountPreview.discountValue}`} off
          </p>
        )}
      </div>

      {/* Price breakdown */}
      <div className="rounded-lg border-2 border-coral bg-orange-50 p-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Base amount:</span>
            <span className="font-medium text-neutral-950">₹{discountPreview?.baseAmount ?? priceCalculation?.base_total ?? 0}</span>
          </div>
          {(discountPreview?.discountAmount || priceCalculation?.discount_amount) && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Discount:</span>
              <span className="font-medium text-green-700">-₹{discountPreview?.discountAmount ?? priceCalculation?.discount_amount ?? 0}</span>
            </div>
          )}
          <div className="border-t-2 border-coral/20 pt-2 flex justify-between">
            <span className="font-semibold text-neutral-950">Total to pay:</span>
            <span className="text-lg font-bold text-coral">₹{totalAmount}</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-600">
          💳 Payment is collected directly by the provider after service completion. No platform-side fee.
        </p>
      </div>

      {/* Navigation and submit */}
      <div className="flex justify-between gap-3 pt-4">
        <button
          onClick={onPrev}
          className="rounded-full border-2 border-neutral-200 px-6 py-2.5 text-sm font-semibold text-neutral-950 transition-all hover:border-coral hover:text-coral"
        >
          ← Back
        </button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="rounded-full bg-gradient-to-r from-coral to-orange-500 px-8 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Confirming...' : '✓ Confirm Booking'}
        </button>
      </div>
    </div>
  );
}
