'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { bookingTimelineLabel } from '@/lib/bookings/timeline';

type Pet = {
  id: number;
  name: string;
  breed: string | null;
  age: number | null;
  weight: number | null;
  gender: string | null;
  allergies: string | null;
  photo_url: string | null;
};

type Booking = {
  id: number;
  booking_start: string;
  booking_end: string;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_mode?: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type?: string | null;
  provider_id?: number;
  amount: number;
  payment_mode: string | null;
};

export default function UserDashboardClient({
  initialPets,
  initialBookings,
}: {
  initialPets: Pet[];
  initialBookings: Booking[];
}) {
  const [pets, setPets] = useState(initialPets);
  const [bookings, setBookings] = useState(initialBookings);
  const [petPhotoUrls, setPetPhotoUrls] = useState<Record<number, string>>({});
  const [bookingFilter, setBookingFilter] = useState<'all' | 'active' | 'history'>('all');
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const bookingCounts = useMemo(() => {
    return {
      total: bookings.length,
      active: bookings.filter((booking) => booking.status === 'pending' || booking.status === 'confirmed').length,
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (bookingFilter === 'active') {
      return bookings.filter((booking) => booking.status === 'pending' || booking.status === 'confirmed');
    }

    if (bookingFilter === 'history') {
      return bookings.filter((booking) => booking.status !== 'pending' && booking.status !== 'confirmed');
    }

    return bookings;
  }, [bookings, bookingFilter]);

  const userAlerts = useMemo(() => {
    const alerts: Array<{ level: 'info' | 'warning' | 'success'; message: string }> = [];

    const pending = bookings.filter((booking) => booking.status === 'pending').length;
    const confirmed = bookings.filter((booking) => booking.status === 'confirmed').length;
    const completed = bookings.filter((booking) => booking.status === 'completed').length;

    if (pending > 0) {
      alerts.push({ level: 'warning', message: `${pending} booking(s) are awaiting provider confirmation.` });
    }

    if (confirmed > 0) {
      alerts.push({ level: 'info', message: `${confirmed} confirmed booking(s) coming up soon.` });
    }

    if (completed > 0) {
      alerts.push({ level: 'success', message: `${completed} completed booking(s). Rebook your favorite service in one tap.` });
    }

    if (alerts.length === 0) {
      alerts.push({ level: 'info', message: 'No active notifications. Start your next booking when ready.' });
    }

    return alerts;
  }, [bookings]);

  useEffect(() => {
    let active = true;

    async function hydratePetPhotoUrls() {
      const entries = await Promise.all(
        pets.map(async (pet): Promise<[number, string]> => {
          if (!pet.photo_url) {
            return [pet.id, ''];
          }

          if (/^https?:\/\//i.test(pet.photo_url)) {
            return [pet.id, pet.photo_url];
          }

          const response = await fetch('/api/storage/signed-read-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bucket: 'pet-photos',
              path: pet.photo_url,
              expiresIn: 3600,
            }),
          });

          if (!response.ok) {
            return [pet.id, ''];
          }

          const payload = (await response.json().catch(() => null)) as { signedUrl?: string } | null;
          return [pet.id, payload?.signedUrl ?? ''];
        }),
      );

      if (!active) {
        return;
      }

      const nextMap: Record<number, string> = {};
      entries.forEach(([id, url]) => {
        if (url) {
          nextMap[id] = url;
        }
      });
      setPetPhotoUrls(nextMap);
    }

    hydratePetPhotoUrls();

    return () => {
      active = false;
    };
  }, [pets]);

  function cancelBooking(bookingId: number) {
    const previous = bookings;
    setBookings((current) =>
      current.map((booking) => (booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking)),
    );

    startTransition(async () => {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (!response.ok) {
        setBookings(previous);
        showToast('Cancellation failed.', 'error');
        return;
      }

      showToast('Booking cancelled.', 'success');
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md transition-all duration-300 ease-out hover:-translate-y-0.5">
        <h2 className="text-xl font-semibold text-ink">Notification Center</h2>
        <ul className="mt-4 grid gap-2 text-sm">
          {userAlerts.map((alert, index) => (
            <li
              key={`${alert.level}-${index}`}
              className={`rounded-xl border p-3 ${
                alert.level === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : alert.level === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-[#f2dfcf] bg-[#fffdfa] text-[#6b6b6b]'
              }`}
            >
              {alert.message}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md transition-all duration-300 ease-out hover:-translate-y-0.5">
        <h2 className="text-center text-xl font-semibold text-ink">Book Service Now</h2>
        <p className="mt-2 text-center text-sm text-[#6b6b6b]">
          Ready to schedule care for your pet? Start a new booking with your saved profile and pet details.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/forms/customer-booking#start-your-booking"
            className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-5 py-2.5 text-xs font-semibold text-white"
          >
            Start New Booking
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md transition-all duration-300 ease-out hover:-translate-y-0.5">
        <h2 className="text-xl font-semibold text-ink">Booking Insights</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-xl border border-[#f2dfcf] p-3">Active bookings: {bookingCounts.active}</div>
          <div className="rounded-xl border border-[#f2dfcf] p-3">Completed: {bookings.filter((booking) => booking.status === 'completed').length}</div>
          <div className="rounded-xl border border-[#f2dfcf] p-3">No-show: {bookings.filter((booking) => booking.status === 'no_show').length}</div>
        </div>
      </section>

      <section id="pets" className="scroll-mt-24 rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md transition-all duration-300 ease-out hover:-translate-y-0.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-ink">Pet Profiles</h2>
          <Link
            href="/dashboard/user/pets"
            className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink"
          >
            Open Complete Pet Passport
          </Link>
        </div>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pets.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-4 text-sm text-[#6b6b6b] sm:col-span-2 xl:col-span-3">
              No pets added yet.
            </li>
          ) : (
            pets.map((pet) => (
              <li key={pet.id} className="rounded-2xl border border-[#f2dfcf] bg-[#fffdfa] p-4 text-sm shadow-sm">
                {petPhotoUrls[pet.id] ? (
                  <img
                    src={petPhotoUrls[pet.id]}
                    alt={`${pet.name} photo`}
                    className="mb-3 h-36 w-full rounded-xl object-cover"
                  />
                ) : null}
                <div className="text-base font-semibold text-ink">{pet.name}</div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6b6b6b]">
                  {pet.breed ? <span>Breed: {pet.breed}</span> : null}
                  {pet.age !== null ? <span>Age: {pet.age}</span> : null}
                  {pet.weight !== null ? <span>Weight: {pet.weight} kg</span> : null}
                  {pet.gender ? <span>Gender: {pet.gender}</span> : null}
                  {pet.allergies ? <span>Allergies: {pet.allergies}</span> : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md transition-all duration-300 ease-out hover:-translate-y-0.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-ink">Bookings</h2>
          <div className="flex items-center gap-2">
            <p className="text-xs text-[#6b6b6b]">
              {bookingCounts.active} active / {bookingCounts.total} total
            </p>
            <select
              value={bookingFilter}
              onChange={(event) => setBookingFilter(event.target.value as 'all' | 'active' | 'history')}
              className="rounded-xl border border-[#f2dfcf] px-3 py-1 text-[11px]"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="history">History</option>
            </select>
          </div>
        </div>

        <ul className="mt-4 grid gap-2">
          {filteredBookings.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-sm text-[#6b6b6b]">No bookings yet.</li>
          ) : (
            filteredBookings.map((booking) => (
              <li key={booking.id} className="rounded-xl border border-[#f2dfcf] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">#{booking.id}</p>
                    <p className="text-xs text-[#6b6b6b]">
                      {booking.booking_date && booking.start_time
                        ? `${booking.booking_date} • ${booking.start_time}${booking.end_time ? ` - ${booking.end_time}` : ''}`
                        : new Date(booking.booking_start).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-[#6b6b6b]">{bookingTimelineLabel(booking.status)}</p>
                    <p className="text-[11px] text-[#6b6b6b]">
                      {(booking.service_type ?? 'Service')} • {(booking.booking_mode ?? 'home_visit').replace('_', ' ')}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-2.5 py-1 text-[11px] font-medium capitalize text-ink">
                    {booking.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(booking.status === 'pending' || booking.status === 'confirmed') && (
                    <button
                      type="button"
                      onClick={() => cancelBooking(booking.id)}
                      className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                    >
                      Cancel Booking
                    </button>
                  )}
                  <Link
                    href="/forms/customer-booking"
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Rebook
                  </Link>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">Add New Pet</h2>
          <Link
            href="/dashboard/user/pets"
            className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink"
          >
            Add Complete Pet Passport
          </Link>
        </div>
        <p className="mt-3 text-sm text-[#6b6b6b]">
          Create pet profiles using the full passport form (medical, behavior, feeding, grooming, and emergency details).
        </p>
      </section>
    </div>
  );
}
