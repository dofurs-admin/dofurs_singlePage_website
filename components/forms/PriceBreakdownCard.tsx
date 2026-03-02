type PriceBreakdown = {
  basePrice: number;
  addOnPrice: number;
  discountAmount: number;
  finalPrice: number;
  breakdown: string[];
};

export default function PriceBreakdownCard({ price, isLoading }: { price: PriceBreakdown | null; isLoading?: boolean }) {
  return (
    <div className="rounded-xl border border-[#f2dfcf] bg-[#fff7f0] p-3 transition-all duration-300 ease-out hover:-translate-y-0.5">
      <p className="text-xs font-semibold text-ink">Price Breakdown</p>
      {isLoading ? <p className="mt-1 text-xs text-[#6b6b6b]">Calculating...</p> : null}
      {!isLoading && !price ? <p className="mt-1 text-xs text-[#6b6b6b]">Select service/package to preview price.</p> : null}
      {!isLoading && price ? (
        <div className="mt-2 space-y-1 text-[11px] text-[#6b6b6b]">
          {price.breakdown.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
          <p>Base: ₹{price.basePrice}</p>
          <p>Add-ons: ₹{price.addOnPrice}</p>
          <p>Discount: ₹{price.discountAmount}</p>
          <p className="mt-1 text-sm font-semibold text-ink">Total: ₹{price.finalPrice}</p>
        </div>
      ) : null}
    </div>
  );
}
