import { PawPrint } from 'lucide-react';
import { theme } from '@/lib/theme';

type BrandMarkProps = {
  compact?: boolean;
};

export default function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="inline-flex items-center gap-2" aria-label={`${theme.brandName} logo`}>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-coral/15 text-coral">
        <PawPrint size={compact ? 16 : 18} aria-hidden="true" />
      </span>
      <span className={`font-semibold tracking-tight text-ink ${compact ? 'text-lg' : 'text-xl md:text-2xl'}`}>
        {theme.brandName}
      </span>
    </div>
  );
}
