'use client';

import { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  highlight?: boolean;
}

export default function SectionCard({
  title,
  description,
  children,
  highlight = false,
}: SectionCardProps) {
  return (
    <div
      className={`rounded-2xl border bg-white p-6 sm:p-8 shadow-sm transition-all duration-300 ${
        highlight ? 'border-brand-500/30 ring-2 ring-brand-500/10' : 'border-neutral-200/60'
      }`}
    >
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-950">{title}</h2>
        {description && (
          <p className="mt-2 text-sm text-neutral-600">{description}</p>
        )}
      </div>

      {/* Content */}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
