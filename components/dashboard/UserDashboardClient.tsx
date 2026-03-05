'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useBookingRealtime, useOptimisticUpdate } from '@/lib/hooks/useRealtime';

// Premium Components
import BookingCard from './premium/BookingCard';
import EmptyState from './premium/EmptyState';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import SectionCard from './SectionCard';
import FormField from './FormField';
import PetPassportViewModal from './PetPassportViewModal';
import type { PetPassportData } from './PetPassportViewModal';
import PetFullEditModal from './PetFullEditModal';
import ProgressRing from './ProgressRing';
import Modal from '@/components/ui/Modal';
import { uploadCompressedImage } from '@/lib/storage/upload-client';
import { getPetFallbackIcon } from '@/lib/pets/icon-helpers';
import StorageBackedImage from '@/components/ui/StorageBackedImage';

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
  const [pets, setPets] = useState(initialPets);
  const [bookings, setBookings] = useState(initialBookings);
  const [petCompletions, setPetCompletions] = useState<Record<number, number>>({});
  const [bookingFilter, setBookingFilter] = useState<'all' | 'active' | 'history'>('all');
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const { performUpdate } = useOptimisticUpdate(bookings, setBookings);
  const [reminders, setReminders] = useState<ReminderGroup[]>([]);
  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreferences>({
    daysAhead: 7,
    inAppEnabled: true,
    emailEnabled: false,
    whatsappEnabled: false,
  });
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreatePetModal, setShowCreatePetModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [editingPetPhotoUrl, setEditingPetPhotoUrl] = useState<string>('');
  const [viewModalData, setViewModalData] = useState<PetPassportData | null>(null);
  const [isLoadingViewData, setIsLoadingViewData] = useState(false);
  const [newPet, setNewPet] = useState({ name: '', breed: '', dateOfBirth: '', gender: '' });
  const [newPetPhotoFile, setNewPetPhotoFile] = useState<File | null>(null);
  const [newPetPhotoPreview, setNewPetPhotoPreview] = useState<string | null>(null);

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

  // Load pet completion percentages
  useEffect(() => {
    let active = true;

    async function loadPetCompletions() {
      const completions: Record<number, number> = {};
      
      for (const pet of pets) {
        try {
          const response = await fetch(`/api/user/pets/${pet.id}/passport`);
          if (response.ok && active) {
            const data = await response.json();
            const completion = calculateCompletion(data.profile);
            completions[pet.id] = completion;
          }
        } catch {
          completions[pet.id] = 0;
        }
      }

      if (active) {
        setPetCompletions(completions);
      }
    }

    if (pets.length > 0) {
      loadPetCompletions();
    }

    return () => {
      active = false;
    };
  }, [pets]);

  async function loadCompletion(petId: number) {
    try {
      const response = await fetch(`/api/user/pets/${petId}/passport`);
      if (response.ok) {
        const data = await response.json();
        const completion = calculateCompletion(data.profile);
        setPetCompletions((current) => ({ ...current, [petId]: completion }));
      }
    } catch {
      // Silent fail
    }
  }

  function calculateCompletion(profile: PetPassportData): number {
    const total = 7;
    let completed = 0;

    // Basic info
    if (profile.pet.name && profile.pet.breed && profile.pet.age !== null) completed++;
    
    // Behavior
    if (profile.pet.aggression_level || profile.pet.social_with_dogs || profile.pet.social_with_cats) completed++;
    
    // Vaccinations
    if (profile.vaccinations && profile.vaccinations.length > 0) completed++;
    
    // Medical records
    if (profile.medicalRecords && profile.medicalRecords.length > 0) completed++;
    
    // Feeding info
    if (profile.feedingInfo && profile.feedingInfo.food_type) completed++;
    
    // Grooming info
    if (profile.groomingInfo && profile.groomingInfo.coat_type) completed++;
    
    // Emergency info
    if (profile.emergencyInfo && profile.emergencyInfo.emergency_contact_name) completed++;

    return Math.round((completed / total) * 100);
  }

  async function openViewModal(petId: number) {
    setViewModalData(null);
    setIsLoadingViewData(true);
    setShowViewModal(true);

    try {
      const response = await fetch(`/api/user/pets/${petId}/passport`);
      if (!response.ok) {
        showToast('Unable to load pet passport.', 'error');
        setShowViewModal(false);
        return;
      }

      const data = await response.json();
      const profile = data.profile as PetPassportData;
      setViewModalData(profile);
    } catch {
      showToast('Error loading pet data.', 'error');
      setShowViewModal(false);
    } finally {
      setIsLoadingViewData(false);
    }
  }

  function openEditModal(pet: Pet) {
    setEditingPet(pet);
    setEditingPetPhotoUrl(pet.photo_url || '');
    setShowEditModal(true);
  }

  async function deletePetProfile(petId: number, petName: string) {
    if (!window.confirm(`Are you sure you want to delete ${petName}'s profile? This action cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/user/pets/${petId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          showToast('Unable to delete pet profile.', 'error');
          return;
        }

        setPets((current) => current.filter((pet) => pet.id !== petId));
        showToast(`${petName}'s profile deleted successfully.`, 'success');
      } catch {
        showToast('An error occurred while deleting the pet profile.', 'error');
      }
    });
  }

  async function createPetProfile() {
    const name = newPet.name.trim();
    if (!name) {
      showToast('Pet name is required.', 'error');
      return;
    }

    let photoUrl: string | null = null;
    if (newPetPhotoFile) {
      try {
        const uploaded = await uploadCompressedImage(newPetPhotoFile, 'pet-photos');
        photoUrl = uploaded.path;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Photo upload failed.', 'error');
        return;
      }
    }

    startTransition(async () => {
      const response = await fetch('/api/user/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          breed: newPet.breed.trim() || null,
          dateOfBirth: newPet.dateOfBirth.trim() || null,
          gender: newPet.gender.trim() || null,
          photoUrl,
        }),
      });

      if (!response.ok) {
        showToast('Unable to create pet profile.', 'error');
        return;
      }

      const payload = (await response.json().catch(() => null)) as { pet?: Pet } | null;
      if (!payload?.pet) {
        showToast('Unexpected response while creating pet.', 'error');
        return;
      }

      setPets((current) => [payload.pet!, ...current]);
      setNewPet({ name: '', breed: '', dateOfBirth: '', gender: '' });
      closeCreatePetModal();
      showToast('Pet profile created.', 'success');
    });
  }

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

  function closeCreatePetModal() {
    setShowCreatePetModal(false);
    setNewPetPhotoFile(null);
    if (newPetPhotoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(newPetPhotoPreview);
    }
    setNewPetPhotoPreview(null);
  }

  return (
    <div className="space-y-6">
      {/* ===== HERO SECTION ===== */}
      <div className="rounded-2xl bg-gradient-to-br from-coral/5 via-orange-50/30 to-transparent border border-coral/10 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-neutral-950 mb-1">Hey {userName}! 👋</h1>
            <p className="text-sm text-neutral-600">Manage your pets, bookings, and keep track of everything in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/forms/customer-booking">
              <Button>Book a Service</Button>
            </Link>
          </div>
        </div>
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-coral/10">
          <div className="text-center">
            <div className="text-2xl font-bold text-coral">{pets.length}</div>
            <div className="text-xs text-neutral-600 mt-0.5">Pets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{bookingCounts.active}</div>
            <div className="text-xs text-neutral-600 mt-0.5">Active Bookings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{reminders.length}</div>
            <div className="text-xs text-neutral-600 mt-0.5">Reminders</div>
          </div>
        </div>
      </div>

      {/* ===== OVERVIEW VIEW ===== */}
      {view === 'overview' && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
            {/* LEFT: PETS + BOOKINGS (8 COLS) */}
            <div className="space-y-4 lg:col-span-8">
              <section className="rounded-2xl border border-neutral-200/40 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-neutral-950">Your Pets</h2>
                  <button
                    type="button"
                    onClick={() => setShowCreatePetModal(true)}
                    className="rounded-lg bg-coral px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#cf8448] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30"
                  >
                    + Add Pet
                  </button>
                </div>

                {pets.length === 0 ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🐾</span>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">No pets added yet</p>
                        <p className="text-xs text-neutral-600">Create a profile to start managing care.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreatePetModal(true)}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Create
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pets.map((pet) => {
                      const completion = petCompletions[pet.id] ?? 0;
                      const completionStatus = completion === 100 ? 'complete' : completion >= 70 ? 'high' : completion >= 40 ? 'medium' : 'low';
                      const statusConfig = {
                        complete: { label: 'Complete', color: 'text-emerald-600', progress: 'bg-emerald-500' },
                        high: { label: 'Almost there', color: 'text-blue-600', progress: 'bg-blue-500' },
                        medium: { label: 'In progress', color: 'text-amber-600', progress: 'bg-amber-500' },
                        low: { label: 'Getting started', color: 'text-neutral-600', progress: 'bg-neutral-400' },
                      };
                      const status = statusConfig[completionStatus];

                      return (
                        <div
                          key={pet.id}
                          className="flex items-center gap-3 rounded-xl border border-neutral-200/40 bg-white p-4 shadow-sm"
                        >
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                            {pet.photo_url ? (
                              <StorageBackedImage
                                value={pet.photo_url}
                                bucket="pet-photos"
                                alt={`${pet.name} photo`}
                                width={128}
                                height={128}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xl">{getPetFallbackIcon(pet.breed)}</div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-neutral-950">{pet.name}</p>
                                <p className="truncate text-xs text-neutral-600">{pet.breed || 'Breed not set'}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold ${status.color}`}>{status.label}</span>
                                <span className="text-xs font-semibold text-neutral-700">{completion}%</span>
                              </div>
                            </div>

                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                              <div className={`h-full rounded-full ${status.progress}`} style={{ width: `${completion}%` }} />
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openViewModal(pet.id)}
                              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(pet)}
                              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePetProfile(pet.id, pet.name)}
                              disabled={isPending}
                              className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-500 transition hover:bg-neutral-50 disabled:opacity-60"
                              aria-label={`Delete ${pet.name}`}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-neutral-200/40 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-neutral-950">Recent Bookings</h2>
                  <Link href="/dashboard/user?view=operations" className="text-xs font-semibold text-orange-600 hover:text-orange-700">
                    View All
                  </Link>
                </div>

                {filteredBookings.length === 0 ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📅</span>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">No bookings yet</p>
                        <p className="text-xs text-neutral-600">Book a service to see upcoming appointments.</p>
                      </div>
                    </div>
                    <Link href="/forms/customer-booking">
                      <Button size="sm">Book</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200/50 bg-white">
                    {filteredBookings.slice(0, 5).map((booking) => {
                      const bookingStatus = booking.status;
                      const statusClasses: Record<string, string> = {
                        pending: 'bg-amber-50 text-amber-700',
                        confirmed: 'bg-blue-50 text-blue-700',
                        completed: 'bg-emerald-50 text-emerald-700',
                        cancelled: 'bg-red-50 text-red-700',
                        no_show: 'bg-neutral-100 text-neutral-700',
                      };

                      return (
                        <div key={booking.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-neutral-900">{booking.service_type ?? 'Service'}</p>
                            <p className="text-xs text-neutral-600">
                              {booking.booking_date ?? new Date(booking.booking_start).toLocaleDateString()}
                              {booking.start_time ? ` • ${booking.start_time}` : ''}
                              {booking.end_time ? ` - ${booking.end_time}` : ''}
                            </p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold capitalize ${statusClasses[bookingStatus]}`}>
                            {bookingStatus.replace('_', ' ')}
                          </span>
                          {(bookingStatus === 'pending' || bookingStatus === 'confirmed') && (
                            <button
                              type="button"
                              onClick={() => cancelBooking(booking.id)}
                              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT: VACCINE SIDEBAR (4 COLS) */}
            <aside className="lg:col-span-4">
              <section className="rounded-2xl border border-neutral-200/40 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-neutral-950">Upcoming Vaccines</h2>
                  <span className="text-xs text-neutral-500">{reminderPreferences.daysAhead} days</span>
                </div>

                <div className="mb-3 rounded-xl bg-neutral-50 p-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-neutral-600">Window</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={reminderPreferences.daysAhead}
                      onChange={(event) =>
                        setReminderPreferences((current) => ({
                          ...current,
                          daysAhead: Math.max(1, Math.min(90, Number.parseInt(event.target.value || '7', 10))),
                        }))
                      }
                      className="w-14 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-coral/30"
                    />
                    <span className="text-xs text-neutral-500">days</span>
                    <button
                      type="button"
                      onClick={saveReminderPreferences}
                      className="ml-auto rounded-md bg-coral px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#cf8448] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30"
                    >
                      Save
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-neutral-600">
                      <input
                        type="checkbox"
                        checked={reminderPreferences.inAppEnabled}
                        onChange={(event) => setReminderPreferences((current) => ({ ...current, inAppEnabled: event.target.checked }))}
                        className="h-3.5 w-3.5 rounded"
                      />
                      In-app
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-neutral-600">
                      <input
                        type="checkbox"
                        checked={reminderPreferences.emailEnabled}
                        onChange={(event) => setReminderPreferences((current) => ({ ...current, emailEnabled: event.target.checked }))}
                        className="h-3.5 w-3.5 rounded"
                      />
                      Email
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-neutral-600">
                      <input
                        type="checkbox"
                        checked={reminderPreferences.whatsappEnabled}
                        onChange={(event) => setReminderPreferences((current) => ({ ...current, whatsappEnabled: event.target.checked }))}
                        className="h-3.5 w-3.5 rounded"
                      />
                      WhatsApp
                    </label>
                  </div>
                </div>

                {reminders.length === 0 ? (
                  <div className="rounded-xl bg-neutral-50 px-3 py-3">
                    <p className="text-sm font-semibold text-neutral-800">No upcoming reminders</p>
                    <p className="text-xs text-neutral-600">Due vaccines appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reminders.map((group) => (
                      <div key={group.petId} className="rounded-xl border border-neutral-200/50 bg-white p-3 shadow-sm">
                        <p className="mb-1 text-xs font-semibold text-neutral-900">{group.petName}</p>
                        <div className="space-y-1.5">
                          {group.vaccinations.map((vax) => (
                            <div key={vax.vaccinationId} className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs text-neutral-700">{vax.vaccineName}</span>
                              <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                {new Date(vax.nextDueDate).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>


        </>
      )}

      {/* ===== MODALS ===== */}
      {/* View Pet Passport Modal */}
      <PetPassportViewModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        data={viewModalData}
        photoUrl={viewModalData?.pet?.photo_url ?? null}
        isLoading={isLoadingViewData}
      />

      {/* Edit Pet Modal - Full Passport Editor */}
      <PetFullEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        pet={editingPet}
        photoUrl={editingPetPhotoUrl}
        onSave={(updatedPet) => {
          setPets((current) =>
            current.map((p) => (p.id === updatedPet.id ? { ...p, ...updatedPet } : p))
          );
          // Reload completion
          loadCompletion(updatedPet.id);
        }}
      />

      {/* Create Pet Modal */}
      <Modal
        isOpen={showCreatePetModal}
        onClose={closeCreatePetModal}
        title="Add New Pet"
        description="Start with essential details. You can complete the full passport later."
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-white">
              {newPetPhotoPreview ? (
                <Image src={newPetPhotoPreview} alt="New pet preview" fill className="object-cover" unoptimized />
              ) : (
                <span className="text-lg">{getPetFallbackIcon(newPet.breed)}</span>
              )}
            </div>
            <label className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50">
              {newPetPhotoFile ? `Selected: ${newPetPhotoFile.name}` : 'Upload pet profile photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setNewPetPhotoFile(file);

                  if (newPetPhotoPreview?.startsWith('blob:')) {
                    URL.revokeObjectURL(newPetPhotoPreview);
                  }

                  if (!file) {
                    setNewPetPhotoPreview(null);
                    return;
                  }

                  const objectUrl = URL.createObjectURL(file);
                  setNewPetPhotoPreview(objectUrl);
                }}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Pet name"
              value={newPet.name}
              onChange={(event) => setNewPet((current) => ({ ...current, name: event.target.value }))}
              placeholder="Pet name *"
            />
            <FormField
              label="Breed"
              value={newPet.breed}
              onChange={(event) => setNewPet((current) => ({ ...current, breed: event.target.value }))}
              placeholder="e.g., Dog, Cat"
            />
            <FormField
              label="Date of birth"
              type="date"
              value={newPet.dateOfBirth}
              onChange={(event) => setNewPet((current) => ({ ...current, dateOfBirth: event.target.value }))}
              placeholder="Date of birth"
            />
            <FormField
              label="Gender"
              value={newPet.gender}
              onChange={(event) => setNewPet((current) => ({ ...current, gender: event.target.value }))}
              placeholder="Gender"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={createPetProfile}
              disabled={isPending}
              className="flex-1 rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 focus-visible:ring-offset-1 disabled:opacity-60"
            >
              {isPending ? 'Creating...' : 'Create Pet'}
            </button>
            <button
              type="button"
              onClick={closeCreatePetModal}
              className="rounded-xl border border-neutral-200/70 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-neutral-950">Pet Profiles</h2>
            <button
              onClick={() => setShowCreatePetModal(true)}
              className="rounded-lg bg-coral px-3 py-1.5 text-xs font-semibold text-white transition-all duration-150 ease-out hover:bg-[#cf8448] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30"
            >
              + Add Pet
            </button>
          </div>

          {pets.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🐾</div>
                <h3 className="text-lg font-bold text-neutral-900 mb-1">No Pets Yet</h3>
                <p className="text-sm text-neutral-600 mb-4">Create pet profiles with complete information.</p>
                <button
                  onClick={() => setShowCreatePetModal(true)}
                  className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#cf8448] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30"
                >
                  Add Your First Pet
                </button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {pets.map((pet) => {
                const completion = petCompletions[pet.id] ?? 0;
                const completionStatus = completion === 100 ? 'complete' : completion >= 70 ? 'high' : completion >= 40 ? 'medium' : 'low';
                const statusConfig = {
                  complete: { label: 'Complete', color: 'text-emerald-600', progress: 'bg-emerald-500' },
                  high: { label: 'Almost there', color: 'text-blue-600', progress: 'bg-blue-500' },
                  medium: { label: 'In progress', color: 'text-amber-600', progress: 'bg-amber-500' },
                  low: { label: 'Getting started', color: 'text-neutral-600', progress: 'bg-neutral-400' }
                };
                const status = statusConfig[completionStatus];

                return (
                  <div
                    key={pet.id}
                    className="flex items-center gap-3 rounded-xl border border-neutral-200/40 bg-white p-4 shadow-sm"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                      {pet.photo_url ? (
                        <StorageBackedImage
                          value={pet.photo_url}
                          bucket="pet-photos"
                          alt={`${pet.name} photo`}
                          width={128}
                          height={128}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xl">{getPetFallbackIcon(pet.breed)}</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-950">{pet.name}</p>
                          <p className="truncate text-xs text-neutral-600">{pet.breed || 'Breed not set'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${status.color}`}>{status.label}</span>
                          <span className="text-xs font-semibold text-neutral-700">{completion}%</span>
                        </div>
                      </div>

                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div className={`h-full rounded-full ${status.progress}`} style={{ width: `${completion}%` }} />
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openViewModal(pet.id)}
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(pet)}
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePetProfile(pet.id, pet.name)}
                        disabled={isPending}
                        className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-500 transition hover:bg-neutral-50 disabled:opacity-60"
                        aria-label={`Delete ${pet.name}`}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
