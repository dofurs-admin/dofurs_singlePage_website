'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
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

type EditPetForm = {
  name: string;
  breed: string;
  age: string;
  weight: string;
  gender: string;
  vaccinationStatus: string;
  allergies: string;
  behaviorNotes: string;
};

export default function UserPetProfilesClient({ initialPets }: { initialPets: Pet[] }) {
  const [pets, setPets] = useState(initialPets);
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [editForm, setEditForm] = useState<EditPetForm | null>(null);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;

    async function hydratePhotoUrls() {
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
            headers: { 'Content-Type': 'application/json' },
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

      const next: Record<number, string> = {};
      entries.forEach(([id, url]) => {
        if (url) {
          next[id] = url;
        }
      });
      setPhotoUrls(next);
    }

    hydratePhotoUrls();

    return () => {
      active = false;
    };
  }, [pets]);

  function startEdit(pet: Pet) {
    setEditingPet(pet);
    setEditPhotoFile(null);
    setEditForm({
      name: pet.name,
      breed: pet.breed ?? '',
      age: pet.age !== null ? String(pet.age) : '',
      weight: pet.weight !== null ? String(pet.weight) : '',
      gender: pet.gender ?? '',
      vaccinationStatus: pet.vaccination_status ?? '',
      allergies: pet.allergies ?? '',
      behaviorNotes: pet.behavior_notes ?? '',
    });
  }

  function closeEdit() {
    setEditingPet(null);
    setEditForm(null);
    setEditPhotoFile(null);
  }

  function savePetEdits() {
    if (!editingPet || !editForm) {
      return;
    }

    const normalizedName = editForm.name.trim();
    const normalizedBreed = editForm.breed.trim();
    const normalizedGender = editForm.gender.trim();
    const normalizedVaccinationStatus = editForm.vaccinationStatus.trim();
    const normalizedAllergies = editForm.allergies.trim();
    const normalizedBehaviorNotes = editForm.behaviorNotes.trim();
    const parsedAge = editForm.age.trim() ? Number.parseInt(editForm.age.trim(), 10) : null;
    const parsedWeight = editForm.weight.trim() ? Number.parseFloat(editForm.weight.trim()) : null;

    if (!normalizedName) {
      showToast('Pet name is required.', 'error');
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

    startTransition(async () => {
      let photoPath = editingPet.photo_url;

      if (editPhotoFile) {
        try {
          const upload = await uploadCompressedImage(editPhotoFile, 'pet-photos');
          photoPath = upload.path;
        } catch {
          showToast('Pet photo upload failed.', 'error');
          return;
        }
      }

      const response = await fetch(`/api/user/pets/${editingPet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: normalizedName,
          breed: normalizedBreed || null,
          age: parsedAge,
          weight: parsedWeight,
          gender: normalizedGender || null,
          vaccinationStatus: normalizedVaccinationStatus || null,
          allergies: normalizedAllergies || null,
          behaviorNotes: normalizedBehaviorNotes || null,
          photoUrl: photoPath ?? null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        showToast(payload?.error ?? 'Unable to update pet profile.', 'error');
        return;
      }

      const payload = (await response.json().catch(() => null)) as { pet?: Pet } | null;
      if (!payload?.pet) {
        showToast('Pet updated but response was invalid.', 'error');
        return;
      }

      setPets((current) => current.map((pet) => (pet.id === editingPet.id ? payload.pet! : pet)));
      closeEdit();
      showToast('Pet profile updated.', 'success');
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-ink">Pet Profiles</h1>
          <Link
            href="/dashboard/user"
            className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink"
          >
            Back to Dashboard
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pets.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-sm text-[#6b6b6b] sm:col-span-2 xl:col-span-3">
              No pet profiles added yet.
            </li>
          ) : (
            pets.map((pet) => (
              <li key={pet.id} className="rounded-xl border border-[#f2dfcf] p-3 text-sm">
                {photoUrls[pet.id] ? (
                  <img src={photoUrls[pet.id]} alt={`${pet.name} photo`} className="mb-3 h-36 w-full rounded-xl object-cover" />
                ) : null}
                <div className="font-semibold text-ink">{pet.name}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6b6b6b]">
                  {pet.breed ? <span>Breed: {pet.breed}</span> : null}
                  {pet.age !== null ? <span>Age: {pet.age}</span> : null}
                  {pet.weight !== null ? <span>Weight: {pet.weight} kg</span> : null}
                  {pet.gender ? <span>Gender: {pet.gender}</span> : null}
                  {pet.vaccination_status ? <span>Vaccination: {pet.vaccination_status}</span> : null}
                  {pet.allergies ? <span>Allergies: {pet.allergies}</span> : null}
                  {pet.behavior_notes ? <span>Notes: {pet.behavior_notes}</span> : null}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => startEdit(pet)}
                    className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-3 py-1.5 text-xs font-semibold text-ink"
                  >
                    Edit
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {editingPet && editForm ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-ink">Edit Pet Profile</h3>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-xs font-semibold text-ink"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input
                value={editForm.name}
                onChange={(event) => setEditForm((current) => (current ? { ...current, name: event.target.value } : current))}
                placeholder="Pet name *"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              />
              <input
                value={editForm.breed}
                onChange={(event) => setEditForm((current) => (current ? { ...current, breed: event.target.value } : current))}
                placeholder="Breed"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                max={40}
                value={editForm.age}
                onChange={(event) => setEditForm((current) => (current ? { ...current, age: event.target.value } : current))}
                placeholder="Age"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0.1}
                max={300}
                step={0.1}
                value={editForm.weight}
                onChange={(event) => setEditForm((current) => (current ? { ...current, weight: event.target.value } : current))}
                placeholder="Weight (kg)"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              />
              <select
                value={editForm.gender}
                onChange={(event) => setEditForm((current) => (current ? { ...current, gender: event.target.value } : current))}
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              >
                <option value="">Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <input
                value={editForm.vaccinationStatus}
                onChange={(event) =>
                  setEditForm((current) => (current ? { ...current, vaccinationStatus: event.target.value } : current))
                }
                placeholder="Vaccination status"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              />
              <input
                value={editForm.allergies}
                onChange={(event) => setEditForm((current) => (current ? { ...current, allergies: event.target.value } : current))}
                placeholder="Allergies"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm lg:col-span-2"
              />
              <input
                value={editForm.behaviorNotes}
                onChange={(event) =>
                  setEditForm((current) => (current ? { ...current, behaviorNotes: event.target.value } : current))
                }
                placeholder="Behavior notes"
                className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm lg:col-span-3"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-full border border-[#f2dfcf] bg-white px-3 py-2 text-xs text-ink">
                {editPhotoFile ? `Photo selected: ${editPhotoFile.name}` : 'Change Photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => setEditPhotoFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <button
                type="button"
                onClick={savePetEdits}
                disabled={isPending}
                className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60"
              >
                {isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
