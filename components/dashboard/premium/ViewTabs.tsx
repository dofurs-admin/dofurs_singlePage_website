'use client';

import Link from 'next/link';

interface ViewTab {
  id: string;
  label: string;
  href: string;
  isActive: boolean;
}

interface ViewTabsProps {
  tabs: ViewTab[];
}

export default function ViewTabs({ tabs }: ViewTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-neutral-200">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`inline-flex items-center px-4 py-3 text-sm font-semibold transition-all duration-150 ease-out border-b-2 ${
            tab.isActive
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
