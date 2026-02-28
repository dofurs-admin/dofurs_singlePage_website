'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { uploadCompressedImage } from '@/lib/storage/upload-client';

type Pet = {
  id: number;
  name: string;
  breed: string | null;
  age: number | null;
  weight: number | null;
  gender: string | null;
  vaccination_status: string | null;
  allergies: string | null;
  behavior_notes: string | null;
  photo_url: string | null;
};

type Booking = {
  id: number;
  booking_start: string;
  booking_end: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
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
  const [newPetName, setNewPetName] = useState('');
  const [newPetBreed, setNewPetBreed] = useState('');
  const [newPetAge, setNewPetAge] = useState('');
  const [newPetWeight, setNewPetWeight] = useState('');
  const [newPetGender, setNewPetGender] = useState('');
  const [newPetVaccinationStatus, setNewPetVaccinationStatus] = useState('');
  const [newPetAllergies, setNewPetAllergies] = useState('');
  const [newPetBehaviorNotes, setNewPetBehaviorNotes] = useState('');
  const [newPetPhoto, setNewPetPhoto] = useState<File | null>(null);
  const [isAddPetModalOpen, setIsAddPetModalOpen] = useState(false);
  const [petPhotoUrls, setPetPhotoUrls] = useState<Record<number, string>>({});
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const bookingCounts = useMemo(() => {
    return {
      total: bookings.length,
      active: bookings.filter((booking) => booking.status === 'pending' || booking.status === 'confirmed').length,
    };
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

  function addPet() {
    const normalizedName = newPetName.trim();
    const normalizedBreed = newPetBreed.trim();
    const normalizedVaccination = newPetVaccinationStatus.trim();
    const normalizedAllergies = newPetAllergies.trim();
    const normalizedBehaviorNotes = newPetBehaviorNotes.trim();
    const normalizedGender = newPetGender.trim();
    const parsedAge = newPetAge.trim() ? Number.parseInt(newPetAge.trim(), 10) : null;
    const parsedWeight = newPetWeight.trim() ? Number.parseFloat(newPetWeight.trim()) : null;

    if (!normalizedName) {
      showToast('Enter a pet name first.', 'error');
      return;
    }

    if (parsedAge !== null && (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 40)) {
      showToast('Pet age must be between 0 and 40.', 'error');
      return;
    }

    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || parsedWeight > 300)) {
      showToast('Pet weight must be between 0.1 and 300 kg.', 'error');
      return;
    }

    const optimisticPet: Pet = {
      id: -Date.now(),
      name: normalizedName,
      breed: normalizedBreed || null,
      age: parsedAge,
      weight: parsedWeight,
      gender: normalizedGender || null,
      vaccination_status: normalizedVaccination || null,
      allergies: normalizedAllergies || null,
      behavior_notes: normalizedBehaviorNotes || null,
      photo_url: null,
    };

    setPets((current) => [optimisticPet, ...current]);
    setNewPetName('');
    setNewPetBreed('');
    setNewPetAge('');
    setNewPetWeight('');
    setNewPetGender('');
    setNewPetVaccinationStatus('');
    setNewPetAllergies('');
    setNewPetBehaviorNotes('');

    startTransition(async () => {
      let photoUrl: string | null = null;

      if (newPetPhoto) {
        try {
          const upload = await uploadCompressedImage(newPetPhoto, 'pet-photos');
          photoUrl = upload.path;
        } catch {
          setPets((current) => current.filter((pet) => pet.id !== optimisticPet.id));
          showToast('Photo upload failed.', 'error');
          return;
        }
      }

      const response = await fetch('/api/user/pets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: optimisticPet.name,
          breed: optimisticPet.breed,
          age: optimisticPet.age,
          weight: optimisticPet.weight,
          gender: optimisticPet.gender,
          vaccinationStatus: optimisticPet.vaccination_status,
          allergies: optimisticPet.allergies,
          behaviorNotes: optimisticPet.behavior_notes,
          photoUrl,
        }),
      });

      if (!response.ok) {
        setPets((current) => current.filter((pet) => pet.id !== optimisticPet.id));
        showToast('Could not add pet.', 'error');
        return;
      }

      const payload = (await response.json()) as { pet: Pet };
      setPets((current) => [payload.pet, ...current.filter((pet) => pet.id !== optimisticPet.id)]);
      setNewPetPhoto(null);
      setIsAddPetModalOpen(false);
      showToast('Pet added successfully.', 'success');
    });
  }

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

      <section id="pets" className="scroll-mt-24 rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md transition-all duration-300 ease-out hover:-translate-y-0.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-ink">Pet Profiles</h2>
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
                  {pet.vaccination_status ? <span>Vaccination: {pet.vaccination_status}</span> : null}
                  {pet.allergies ? <span>Allergies: {pet.allergies}</span> : null}
                  {pet.behavior_notes ? <span>Notes: {pet.behavior_notes}</span> : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md transition-all duration-300 ease-out hover:-translate-y-0.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-ink">Bookings</h2>
          <p className="text-xs text-[#6b6b6b]">
            {bookingCounts.active} active / {bookingCounts.total} total
          </p>
        </div>

        <ul className="mt-4 grid gap-2">
          {bookings.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-sm text-[#6b6b6b]">No bookings yet.</li>
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
                {(booking.status === 'pending' || booking.status === 'confirmed') && (
                  <button
                    type="button"
                    onClick={() => cancelBooking(booking.id)}
                    className="mt-3 rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Cancel Booking
                  </button>
                )}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">Add New Pet</h2>
          <button
            type="button"
            onClick={() => setIsAddPetModalOpen(true)}
            className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink"
          >
            Add Pet Profile
          </button>
        </div>
      </section>

      {isAddPetModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-ink">Add Pet Profile</h3>
              <button
                type="button"
                onClick={() => setIsAddPetModalOpen(false)}
                className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-xs font-semibold text-ink"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input
                value={newPetName}
                onChange={(event) => setNewPetName(event.target.value)}
                placeholder="Pet name *"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              />
              <input
                value={newPetBreed}
                onChange={(event) => setNewPetBreed(event.target.value)}
                placeholder="Breed"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                max={40}
                value={newPetAge}
                onChange={(event) => setNewPetAge(event.target.value)}
                placeholder="Age"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0.1}
                max={300}
                step={0.1}
                value={newPetWeight}
                onChange={(event) => setNewPetWeight(event.target.value)}
                placeholder="Weight (kg)"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              />
              <select
                value={newPetGender}
                onChange={(event) => setNewPetGender(event.target.value)}
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              >
                <option value="">Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <input
                value={newPetVaccinationStatus}
                onChange={(event) => setNewPetVaccinationStatus(event.target.value)}
                placeholder="Vaccination status"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              />
              <input
                value={newPetAllergies}
                onChange={(event) => setNewPetAllergies(event.target.value)}
                placeholder="Allergies"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm lg:col-span-2"
              />
              <input
                value={newPetBehaviorNotes}
                onChange={(event) => setNewPetBehaviorNotes(event.target.value)}
                placeholder="Behavior notes"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm lg:col-span-3"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-full border border-[#f2dfcf] bg-white px-3 py-2 text-xs text-ink">
                {newPetPhoto ? `Photo selected: ${newPetPhoto.name}` : 'Upload Photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => setNewPetPhoto(event.target.files?.[0] ?? null)}
                />
              </label>
              <button
                type="button"
                onClick={addPet}
                disabled={isPending}
                className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60"
              >
                {isPending ? 'Adding...' : 'Save Pet Profile'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
