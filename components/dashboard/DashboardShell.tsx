import type { ReactNode } from 'react';

export default function DashboardShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-[#f2dfcf] bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[#6b6b6b]">{subtitle}</p> : null}
      </div>
      <div className="rounded-2xl border border-[#f2dfcf] bg-white p-5 shadow-sm">{children}</div>
    </section>
  );
}
