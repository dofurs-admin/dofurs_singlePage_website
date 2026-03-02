type ConfirmationProps = {
  providerName?: string;
  bookingDate: string;
  slotStartTime: string;
  bookingMode: string;
  petName?: string;
  totalAmount: number;
};

export default function PremiumBookingConfirmation({
  providerName,
  bookingDate,
  slotStartTime,
  bookingMode,
  petName,
  totalAmount,
}: ConfirmationProps) {
  return (
    <div className="rounded-2xl border border-[#f2dfcf] bg-[#fffaf6] p-4 shadow-sm transition-all duration-300 ease-out">
      <p className="text-sm font-semibold text-ink">Booking confirmed ✨</p>
      <p className="mt-1 text-xs text-[#6b6b6b]">Your booking summary</p>
      <div className="mt-3 grid gap-2 text-xs text-[#6b6b6b] sm:grid-cols-2">
        <p><span className="font-medium text-ink">Provider:</span> {providerName ?? 'Assigned provider'}</p>
        <p><span className="font-medium text-ink">Pet:</span> {petName ?? 'Selected pet'}</p>
        <p><span className="font-medium text-ink">Date:</span> {bookingDate}</p>
        <p><span className="font-medium text-ink">Time:</span> {slotStartTime}</p>
        <p><span className="font-medium text-ink">Mode:</span> {bookingMode.replace('_', ' ')}</p>
        <p><span className="font-medium text-ink">Payable:</span> ₹{totalAmount}</p>
      </div>
    </div>
  );
}
