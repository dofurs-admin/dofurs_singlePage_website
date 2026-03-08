'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useBookingRealtime, useOptimisticUpdate } from '@/lib/hooks/useRealtime';
import { calculateLightweightPetCompletion } from '@/lib/utils/pet-completion';

// Premium Components
import StatCard from './premium/StatCard';
import BookingCard from './premium/BookingCard';
import PetCard from './premium/PetCard';
import EmptyState from './premium/EmptyState';
import ActivityFeed from './premium/ActivityFeed';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import SectionCard from './SectionCard';
import FormField from './FormField';

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

type UserDashboardView = 'overview' | 'operations' | 'profile';

type ReminderGroup = {
  petId: number;
  petName: string;
  vaccinations: Array<{
    vaccinationId: string;
    vaccineName: string;
    nextDueDate: string;
    reminderEnabled: boolean;
  }>;
};

type ReminderPreferences = {
  daysAhead: number;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
};

export default function UserDashboardClient({
  userId,
  userName,
  initialPets,
  initialBookings,
  view = 'overview',
}: {
  userId: string;
  userName: string;
  initialPets: Pet[];
  initialBookings: Booking[];
  view?: UserDashboardView;
}) {
  const [pets] = useState(initialPets);
  const [bookings, setBookings] = useState(initialBookings);
  const [petPhotoUrls, setPetPhotoUrls] = useState<Record<number, string>>({});
  const [bookingFilter, setBookingFilter] = useState<'all' | 'active' | 'history'>('all');
  const [, startTransition] = useTransition();
  const { showToast } = useToast();
  const { performUpdate } = useOptimisticUpdate(bookings, setBookings);
  const [reminders, setReminders] = useState<ReminderGroup[]>([]);
  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreferences>({
    daysAhead: 7,
    inAppEnabled: true,
    emailEnabled: false,
    whatsappEnabled: false,
  });

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

  const petCompletionById = useMemo(() => {
    return Object.fromEntries(
      pets.map((pet) => [pet.id, calculateLightweightPetCompletion(pet)]),
    ) as Record<number, number>;
  }, [pets]);

  // Realtime subscription for booking updates
  const refreshBookings = useCallback(async () => {
    try {
      const response = await fetch('/api/user/bookings');
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings ?? []);
      }
    } catch (error) {
      console.error('Failed to refresh bookings:', error);
    }
  }, []);

  useBookingRealtime(userId, refreshBookings);

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

  useEffect(() => {
    let active = true;

    async function loadReminderPreferences() {
      const response = await fetch('/api/user/pets/reminder-preferences');
      if (!response.ok || !active) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as { preferences?: ReminderPreferences } | null;
      if (payload?.preferences && active) {
        setReminderPreferences(payload.preferences);
      }
    }

    loadReminderPreferences();

    return () => {
      active = false;
    };
  }, []);

  function saveReminderPreferences() {
    startTransition(async () => {
      const response = await fetch('/api/user/pets/reminder-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminderPreferences),
      });

      if (!response.ok) {
        showToast('Unable to save reminder preferences.', 'error');
        return;
      }

      const remindersResponse = await fetch(`/api/user/pets/upcoming-vaccinations?daysAhead=${reminderPreferences.daysAhead}`);
      if (remindersResponse.ok) {
        const payload = (await remindersResponse.json().catch(() => null)) as { reminders?: ReminderGroup[] } | null;
        if (payload?.reminders) {
          setReminders(payload.reminders);
        }
      }

      showToast('Reminder preferences saved.', 'success');
    });
  }

  useEffect(() => {
    let active = true;

    async function loadReminders() {
      const remindersResponse = await fetch(`/api/user/pets/upcoming-vaccinations?daysAhead=${reminderPreferences.daysAhead}`);
      if (remindersResponse.ok && active) {
        const payload = (await remindersResponse.json().catch(() => null)) as { reminders?: ReminderGroup[] } | null;
        if (payload?.reminders) {
          setReminders(payload.reminders);
        }
      }
    }

    loadReminders();

    return () => {
      active = false;
    };
  }, [reminderPreferences.daysAhead]);

  function cancelBooking(bookingId: number) {
    // Optimistic update: immediately mark as cancelled
    performUpdate(
      (current) => current.map((booking) => (booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking)),
      async () => {
        const response = await fetch(`/api/bookings/${bookingId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'cancelled' }),
        });

        if (!response.ok) {
          throw new Error('Cancellation failed');
        }
      },
      () => showToast('Booking cancelled.', 'success'),
      () => showToast('Cancellation failed.', 'error'),
    );
  }

  // Prepare data for premium layout
  const activityItems = userAlerts.map((alert, index) => ({
    id: `${alert.level}-${index}`,
    icon: alert.level === 'warning' ? '⚠️' : alert.level === 'success' ? '✅' : 'ℹ️',
    message: alert.message,
    timestamp: 'Just now',
    type: alert.level === 'warning' ? ('warning' as const) : alert.level === 'success' ? ('success' as const) : ('info' as const),
  }));

  return (
    <div className="space-y-12">
      {/* ===== HERO SECTION ===== */}
      <div className="space-y-6">
        <div>
          <h1 className="text-page-title mb-2">Welcome back, {userName}! 👋</h1>
          <p className="text-body text-neutral-600">Let's take care of your pets and manage your bookings.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/forms/customer-booking">
            <Button>Book a Service</Button>
          </Link>
          <Link href="#pets-section">
            <Button variant="secondary">View Your Pets</Button>
          </Link>
        </div>
      </div>

      {/* ===== OVERVIEW VIEW ===== */}
      {view === 'overview' && (
        <>
          {/* STATS SUMMARY ROW */}
          <section className="space-y-6">
            <h2 className="text-section-title">Your Bookings at a Glance</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon="📊"
                label="Active Bookings"
                value={bookingCounts.active}
                trend={bookingCounts.active > 0 ? 'up' : 'neutral'}
              />
              <StatCard
                icon="✓"
                label="Completed"
                value={bookings.filter((b) => b.status === 'completed').length}
                trend="neutral"
              />
              <StatCard
                icon="⚠"
                label="No Shows"
                value={bookings.filter((b) => b.status === 'no_show').length}
                trend={bookings.filter((b) => b.status === 'no_show').length > 0 ? 'down' : 'neutral'}
              />
              <StatCard
                icon="📅"
                label="Total Bookings"
                value={bookingCounts.total}
                trend="neutral"
              />
            </div>
          </section>

          {/* ACTIVITY FEED */}
          <section className="space-y-6">
            <h2 className="text-section-title">Recent Activity</h2>
            <Card>
              <ActivityFeed
                items={activityItems}
                emptyMessage="No recent notifications"
              />
            </Card>
          </section>

          {/* TWO COLUMN LAYOUT: BOOKINGS + PETS */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* LEFT: Bookings Overview */}
            <section className="space-y-6">
              <h2 className="text-section-title">Your Bookings</h2>
              {filteredBookings.length === 0 ? (
                <EmptyState
                  icon="📅"
                  title="No Bookings Yet"
                  description="Start by booking a service for your pet. Your provider will confirm and manage the appointment."
                  ctaLabel="Book Your First Service"
                  ctaHref="/forms/customer-booking"
                />
              ) : (
                <div className="space-y-3">
                  {filteredBookings.slice(0, 3).map((booking) => (
                    <BookingCard
                      key={booking.id}
                      id={booking.id}
                      bookingDate={booking.booking_date ?? undefined}
                      startTime={booking.start_time ?? undefined}
                      endTime={booking.end_time ?? undefined}
                      bookingStart={booking.booking_start}
                      serviceName={booking.service_type ?? 'Service'}
                      bookingMode={booking.booking_mode ?? undefined}
                      status={booking.status}
                      onCancel={cancelBooking}
                    />
                  ))}
                  {bookings.length > 3 && (
                    <Link
                      href="/dashboard/user?view=operations"
                      className="block py-3 text-center text-sm font-semibold text-orange-600 hover:text-orange-700"
                    >
                      View All Bookings →
                    </Link>
                  )}
                </div>
              )}
            </section>

            {/* RIGHT: Pet Profiles Overview */}
            <section id="pets-section" className="space-y-6">
              <h2 className="text-section-title">Your Pets</h2>
              {pets.length === 0 ? (
                <EmptyState
                  icon="🐾"
                  title="No Pets Yet"
                  description="Add your first pet to get started. Create a complete passport with medical and behavioral info."
                  ctaLabel="Add Your First Pet"
                  ctaHref="/dashboard/user/pets"
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {pets.slice(0, 2).map((pet) => (
                    <PetCard
                      key={pet.id}
                      id={pet.id}
                      name={pet.name}
                      breed={pet.breed ?? undefined}
                      age={pet.age ?? undefined}
                      photo={petPhotoUrls[pet.id]}
                      completionPercent={petCompletionById[pet.id]}
                    />
                  ))}
                  {pets.length > 2 && (
                    <Card className="flex items-center justify-center">
                      <Link href="/dashboard/user/pets">
                        <Button variant="ghost">View All Pets →</Button>
                      </Link>
                    </Card>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* UPCOMING VACCINE REMINDERS */}
          <section className="space-y-6">
            <SectionCard title={`Upcoming Vaccine Reminders (${reminderPreferences.daysAhead} days)`} description="Choose channels and reminder window for upcoming due dates.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <FormField
                  label="Window (days)"
                  type="number"
                  min={1}
                  max={90}
                  value={String(reminderPreferences.daysAhead)}
                  onChange={(event) =>
                    setReminderPreferences((current) => ({
                      ...current,
                      daysAhead: Math.max(1, Math.min(90, Number.parseInt(event.target.value || '7', 10))),
                    }))
                  }
                  className="lg:col-span-2"
                />
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm"><input type="checkbox" checked={reminderPreferences.inAppEnabled} onChange={(event) => setReminderPreferences((current) => ({ ...current, inAppEnabled: event.target.checked }))} /> In-app</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm"><input type="checkbox" checked={reminderPreferences.emailEnabled} onChange={(event) => setReminderPreferences((current) => ({ ...current, emailEnabled: event.target.checked }))} /> Email</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm"><input type="checkbox" checked={reminderPreferences.whatsappEnabled} onChange={(event) => setReminderPreferences((current) => ({ ...current, whatsappEnabled: event.target.checked }))} /> WhatsApp</label>
              </div>

              <button type="button" onClick={saveReminderPreferences} className="w-fit rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 focus-visible:ring-offset-1">Save Reminder Preferences</button>

              {reminders.length === 0 ? (
                <div className="rounded-xl border border-neutral-200/60 bg-neutral-50 p-6 text-center">
                  <p className="text-sm text-neutral-600">No upcoming reminders. Your due vaccinations will appear here when dates are within the selected window.</p>
                </div>
              ) : (
                <ul className="grid gap-3">
                  {reminders.map((group) => (
                    <li key={group.petId} className="rounded-2xl border border-neutral-200/60 bg-white p-4 shadow-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md">
                      <div className="font-semibold text-neutral-900">{group.petName}</div>
                      <div className="mt-1 text-sm text-neutral-600">
                        {group.vaccinations.map((vax) => `${vax.vaccineName} (${new Date(vax.nextDueDate).toLocaleDateString()})`).join(' • ')}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </section>
        </>
      )}

      {/* ===== OPERATIONS VIEW ===== */}
      {view === 'operations' && (
        <>
          <h2 className="text-page-title mb-6">Manage Bookings</h2>

          {/* Filter */}
          <Card>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  <span className="text-emerald-600">{bookingCounts.active}</span> active • <span className="text-neutral-600">{bookingCounts.total}</span> total
                </p>
              </div>
              <select
                value={bookingFilter}
                onChange={(event) => setBookingFilter(event.target.value as 'all' | 'active' | 'history')}
                className="input-field w-full sm:w-auto"
              >
                <option value="all">All Bookings</option>
                <option value="active">Active Only</option>
                <option value="history">History</option>
              </select>
            </div>
          </Card>

          {/* Bookings List */}
          {filteredBookings.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No Bookings"
              description={
                bookingFilter === 'active'
                  ? 'You have no active bookings at the moment.'
                  : 'Start by booking a service for your pet.'
              }
              ctaLabel="Book a Service"
              ctaHref="/forms/customer-booking"
            />
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  id={booking.id}
                  bookingDate={booking.booking_date ?? undefined}
                  startTime={booking.start_time ?? undefined}
                  endTime={booking.end_time ?? undefined}
                  bookingStart={booking.booking_start}
                  serviceName={booking.service_type ?? 'Service'}
                  bookingMode={booking.booking_mode ?? undefined}
                  status={booking.status}
                  onCancel={cancelBooking}
                />
              ))}
            </div>
          )}

          {/* CTA Section */}
          <Card>
            <div className="text-center space-y-4">
              <h3 className="text-card-title">Ready to book a service?</h3>
              <p className="text-body text-neutral-600">
                Schedule care for your pet with our trusted providers.
              </p>
              <Link href="/forms/customer-booking">
                <Button size="lg">Start New Booking</Button>
              </Link>
            </div>
          </Card>
        </>
      )}

      {/* ===== PROFILE VIEW ===== */}
      {view === 'profile' && (
        <>
          <h2 className="text-page-title mb-6">Pet Profiles</h2>

          {pets.length === 0 ? (
            <EmptyState
              icon="🐾"
              title="No Pets Yet"
              description="Create pet profiles with complete medical, behavioral, and care information."
              ctaLabel="Add Your First Pet"
              ctaHref="/dashboard/user/pets"
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pets.map((pet) => (
                  <PetCard
                    key={pet.id}
                    id={pet.id}
                    name={pet.name}
                    breed={pet.breed ?? undefined}
                    age={pet.age ?? undefined}
                    photo={petPhotoUrls[pet.id]}
                    completionPercent={petCompletionById[pet.id]}
                  />
                ))}
              </div>

              {/* Add Pet CTA */}
              <Card>
                <div className="text-center space-y-4">
                  <h3 className="text-card-title">Add Another Pet?</h3>
                  <p className="text-body text-neutral-600">
                    Create a complete passport with all medical and behavioral information.
                  </p>
                  <Link href="/dashboard/user/pets">
                    <Button size="lg">Add New Pet</Button>
                  </Link>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
