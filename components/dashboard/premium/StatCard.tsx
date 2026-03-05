'use client';

import { cn } from '@/lib/design-system';
import {
  AlertCircle,
  Award,
  Calendar,
  Tag,
  TrendingUp,
  Users,
  X,
  XCircle,
  Star,
  type LucideIcon,
} from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  description?: string;
  icon?: string;
  className?: string;
}

export default function StatCard({ 
  label, 
  value, 
  trend, 
  trendValue,
  description, 
  icon,
  className 
}: StatCardProps) {
  const trendColors = {
    up: 'text-emerald-600',
    down: 'text-red-600',
    neutral: 'text-neutral-400',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '−',
  };

  const iconMap: Record<string, LucideIcon> = {
    calendar: Calendar,
    'alert-circle': AlertCircle,
    'x-circle': XCircle,
    x: X,
    users: Users,
    tag: Tag,
    star: Star,
    'trending-up': TrendingUp,
    award: Award,
  };

  const IconComponent = icon ? iconMap[icon] : undefined;

  return (
    <div className={cn('card card-interactive card-padding space-y-4', className)}>
      {/* Header with label and trend */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {IconComponent ? <IconComponent size={16} className="text-neutral-500" /> : null}
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            {label}
          </p>
        </div>
        {trend && (
          <div className={cn('flex items-center gap-1 text-sm font-semibold', trendColors[trend])}>
            <span>{trendIcons[trend]}</span>
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>

      {/* Value - large and prominent */}
      <p className="text-3xl font-bold text-neutral-950">{value}</p>

      {/* Optional description */}
      {description && (
        <p className="text-xs text-neutral-500">{description}</p>
      )}
    </div>
  );
}
