'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

type AdminBooking = {
  id: number;
  provider_id: number;
  booking_start: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
};

type Provider = {
  id: number;
  name: string;
};

export default function AdminDashboardClient({
  initialBookings,
  providers,
}: {
  initialBookings: AdminBooking[];
  providers: Provider[];
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  function overrideStatus(bookingId: number, status: AdminBooking['status']) {
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
        showToast('Override failed.', 'error');
        return;
      }

      showToast('Status overridden.', 'success');
    });
  }

  function reassignProvider(bookingId: number, providerId: number) {
    const previous = bookings;
    setBookings((current) =>
      current.map((booking) => (booking.id === bookingId ? { ...booking, provider_id: providerId, status: 'pending' } : booking)),
    );

    startTransition(async () => {
      const response = await fetch(`/api/admin/bookings/${bookingId}/reassign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerId }),
      });

      if (!response.ok) {
        setBookings(previous);
        showToast('Reassign failed.', 'error');
        return;
      }

      showToast('Provider reassigned.', 'success');
    });
  }

  return (
    <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md transition-all duration-300 ease-out hover:-translate-y-0.5">
      <h2 className="text-xl font-semibold text-ink">All Bookings</h2>
      <ul className="mt-4 grid gap-2">
        {bookings.length === 0 ? (
          <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-sm text-[#6b6b6b]">No bookings found.</li>
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

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px]"
                  defaultValue={booking.provider_id}
                  onChange={(event) => reassignProvider(booking.id, Number(event.target.value))}
                  disabled={isPending}
                >
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => overrideStatus(booking.id, 'confirmed')}
                  className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                >
                  Mark Confirmed
                </button>
                <button
                  type="button"
                  onClick={() => overrideStatus(booking.id, 'completed')}
                  className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                >
                  Mark Completed
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
