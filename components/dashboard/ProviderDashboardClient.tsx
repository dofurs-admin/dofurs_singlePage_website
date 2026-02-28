'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

type ProviderBooking = {
  id: number;
  provider_id: number;
  booking_start: string;
  booking_end: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
};

export default function ProviderDashboardClient({
  providerId,
  initialBookings,
}: {
  providerId: number;
  initialBookings: ProviderBooking[];
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [isPending, startTransition] = useTransition();
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const { showToast } = useToast();

  function updateStatus(bookingId: number, status: ProviderBooking['status']) {
    const previous = bookings;
    setBookings((current) => current.map((booking) => (booking.id === bookingId ? { ...booking, status } : booking)));

    startTransition(async () => {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        setBookings(previous);
        showToast('Status update failed.', 'error');
        return;
      }

      showToast('Booking status updated.', 'success');
    });
  }

  function blockTime() {
    if (!blockStart || !blockEnd) {
      showToast('Select both block start and end.', 'error');
      return;
    }

    startTransition(async () => {
      const response = await fetch('/api/provider/block-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerId,
          blockStart: new Date(blockStart).toISOString(),
          blockEnd: new Date(blockEnd).toISOString(),
        }),
      });

      if (!response.ok) {
        showToast('Could not block time.', 'error');
        return;
      }

      showToast('Time blocked successfully.', 'success');
      setBlockStart('');
      setBlockEnd('');
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md transition-all duration-300 ease-out hover:-translate-y-0.5">
        <h2 className="text-xl font-semibold text-ink">Calendar Actions</h2>
        <p className="mt-1 text-sm text-[#6b6b6b]">Block unavailable windows to keep slot generation accurate.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="datetime-local"
            value={blockStart}
            onChange={(event) => setBlockStart(event.target.value)}
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          />
          <input
            type="datetime-local"
            value={blockEnd}
            onChange={(event) => setBlockEnd(event.target.value)}
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={blockTime}
          disabled={isPending}
          className="mt-4 rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-5 py-2.5 text-xs font-semibold text-ink"
        >
          Block Time
        </button>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md transition-all duration-300 ease-out hover:-translate-y-0.5">
        <h2 className="text-xl font-semibold text-ink">Assigned Bookings</h2>
        <ul className="mt-4 grid gap-2">
          {bookings.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-sm text-[#6b6b6b]">No bookings assigned.</li>
          ) : (
            bookings.map((booking) => (
              <li key={booking.id} className="rounded-xl border border-[#f2dfcf] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">#{booking.id}</p>
                    <p className="text-xs text-[#6b6b6b]">{new Date(booking.booking_start).toLocaleString()}</p>
                  </div>
                  <span className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-2.5 py-1 text-[11px] font-medium capitalize text-ink">
                    {booking.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateStatus(booking.id, 'confirmed')}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(booking.id, 'cancelled')}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
