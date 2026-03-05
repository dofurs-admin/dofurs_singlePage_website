'use client';

import Link from 'next/link';
import StatusBadge from './StatusBadge';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/design-system';

interface BookingCardProps {
  id: number;
  bookingDate?: string;
  startTime?: string;
  endTime?: string;
  bookingStart: string;
  serviceName?: string;
  petName?: string;
  providerName?: string;
  bookingMode?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  onCancel?: (bookingId: number) => void;
  className?: string;
}

export default function BookingCard({
  id,
  bookingDate,
  startTime,
  endTime,
  bookingStart,
  serviceName,
  petName,
  providerName,
  bookingMode,
  status,
  onCancel,
  className,
}: BookingCardProps) {
  // Format datetime
  const formatDateTime = () => {
    if (bookingDate && startTime) {
      const endTimeStr = endTime ? ` - ${endTime}` : '';
      return `${bookingDate} • ${startTime}${endTimeStr}`;
    }
    return new Date(bookingStart).toLocaleString();
  };

  const isActive = status === 'pending' || status === 'confirmed';

  return (
    <div className={cn('card card-interactive card-padding', className)}>
      {/* Header: Booking ID and Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 space-y-3">
          {/* Booking Number */}
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Booking #{id}
          </p>

          {/* Main Details */}
          <div className="space-y-2">
            {/* Service / Pet / Provider */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {serviceName && (
                <span className="font-semibold text-neutral-900">{serviceName}</span>
              )}
              {petName && (
                <span className="text-neutral-600">• {petName}</span>
              )}
              {providerName && (
                <span className="text-neutral-600">by {providerName}</span>
              )}
            </div>

            {/* DateTime */}
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{formatDateTime()}</span>
            </div>

            {/* Mode */}
            {bookingMode && (
              <p className="text-xs text-neutral-500 capitalize">
                {bookingMode.replace('_', ' ')}
              </p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap gap-2">
        {isActive && onCancel && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => onCancel(id)}
          >
            Cancel Booking
          </Button>
        )}
        <Link href={`/dashboard/user/bookings/${id}`}>
          <Button variant="secondary" size="sm">
            View Details
          </Button>
        </Link>
      </div>
    </div>
  );
}
