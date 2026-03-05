'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Modal from '@/components/ui/Modal';
import PetStepper from './PetStepper';
import SectionCard from './SectionCard';
import FormField from './FormField';
import ProgressRing from './ProgressRing';
import { useToast } from '@/components/ui/ToastProvider';
import { calculateAgeFromDOB } from '@/lib/utils/date';
import { uploadCompressedImage } from '@/lib/storage/upload-client';
import { getPetFallbackIcon } from '@/lib/pets/icon-helpers';

type Pet = {
  id: number;
  name: string;
  breed: string | null;
  age: number | null;
  weight: number | null;
  gender: string | null;
  allergies: string | null;
  photo_url: string | null;
  date_of_birth?: string | null;
};

type FullPetProfile = {
  pet: Pet & {
    microchip_number?: string | null;
    neutered_spayed?: boolean;
    color?: string | null;
    size_category?: string | null;
    energy_level?: string | null;
    aggression_level?: string | null;
    is_bite_history?: boolean;
    bite_incidents_count?: number;
    house_trained?: boolean;
    leash_trained?: boolean;
    crate_trained?: boolean;
    social_with_dogs?: string | null;
    social_with_cats?: string | null;
    social_with_children?: string | null;
    separation_anxiety?: boolean;
    date_of_birth?: string | null;
  };
  vaccinations: unknown[];
  medicalRecords: unknown[];
  feedingInfo: Record<string, unknown> | null;
  groomingInfo: Record<string, unknown> | null;
  emergencyInfo: Record<string, unknown> | null;
};

type PetEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  pet: Pet | null;
  onSave: (updatedPet: Pet) => void;
  photoUrl?: string;
};

const STEPS = [
  'Basic Info',
  'Behavior & Aggression',
  'Vaccination History',
  'Medical Records',
  'Feeding Info',
  'Grooming Info',
  'Emergency Info',
] as const;

type PassportDraft = {
  pet: {
    name: string;
    breed: string;
    dateOfBirth: string;
    weight: string;
    gender: string;
    allergies: string;
    microchipNumber: string;
    neuteredSpayed: boolean;
    color: string;
    sizeCategory: string;
    energyLevel: string;
    aggressionLevel: string;
    isBiteHistory: boolean;
    biteIncidentsCount: string;
    houseTrained: boolean;
    leashTrained: boolean;
    crateTrained: boolean;
    socialWithDogs: string;
    socialWithCats: string;
    socialWithChildren: string;
    separationAnxiety: boolean;
  };
  vaccinations: unknown[];
  medicalRecords: unknown[];
  feedingInfo: Record<string, unknown>;
  groomingInfo: Record<string, unknown>;
  emergencyInfo: Record<string, unknown>;
};

function emptyDraft(): PassportDraft {
  return {
    pet: {
      name: '',
      breed: '',
      dateOfBirth: '',
      weight: '',
      gender: '',
      allergies: '',
      microchipNumber: '',
      neuteredSpayed: false,
      color: '',
      sizeCategory: '',
      energyLevel: '',
      aggressionLevel: '',
      isBiteHistory: false,
      biteIncidentsCount: '0',
      houseTrained: false,
      leashTrained: false,
      crateTrained: false,
      socialWithDogs: '',
      socialWithCats: '',
      socialWithChildren: '',
      separationAnxiety: false,
    },
    vaccinations: [],
    medicalRecords: [],
    feedingInfo: { foodType: '', brandName: '', feedingSchedule: '', foodAllergies: '', specialDietNotes: '', treatsAllowed: true },
    groomingInfo: { coatType: '', mattingProne: false, groomingFrequency: '', lastGroomingDate: '', nailTrimFrequency: '' },
    emergencyInfo: { emergencyContactName: '', emergencyContactPhone: '', preferredVetClinic: '', preferredVetPhone: '' },
  };
}

function calculateCompletion(profile: FullPetProfile): number {
  const basicComplete = profile.pet && profile.pet.name;
  const behaviorComplete = profile.pet?.aggression_level || profile.pet?.social_with_dogs;
  const vaccinationsComplete = profile.vaccinations && profile.vaccinations.length > 0;
  const medicalComplete = profile.medicalRecords && profile.medicalRecords.length > 0;
  const feedingComplete = typeof profile.feedingInfo?.food_type === 'string' && profile.feedingInfo.food_type.length > 0;
  const groomingComplete = typeof profile.groomingInfo?.coat_type === 'string' && profile.groomingInfo.coat_type.length > 0;
  const emergencyComplete =
    typeof profile.emergencyInfo?.emergency_contact_name === 'string' && profile.emergencyInfo.emergency_contact_name.length > 0;

  const completions = [basicComplete, behaviorComplete, vaccinationsComplete, medicalComplete, feedingComplete, groomingComplete, emergencyComplete];
  return Math.round((completions.filter(Boolean).length / 7) * 100);
}

export default function PetFullEditModal({ isOpen, onClose, pet, onSave, photoUrl }: PetEditModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<PassportDraft>(emptyDraft());
  const [completion, setCompletion] = useState(0);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(photoUrl ?? null);
  const [localPhotoObjectUrl, setLocalPhotoObjectUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setProfilePhotoPreview(photoUrl ?? null);
    setProfilePhotoFile(null);

    if (localPhotoObjectUrl) {
      URL.revokeObjectURL(localPhotoObjectUrl);
      setLocalPhotoObjectUrl(null);
    }
  }, [isOpen, photoUrl]);

  useEffect(() => {
    return () => {
      if (localPhotoObjectUrl) {
        URL.revokeObjectURL(localPhotoObjectUrl);
      }
    };
  }, [localPhotoObjectUrl]);

  // Load profile when modal opens
  useEffect(() => {
    if (!isOpen || !pet) return;

    const loadProfile = async () => {
      try {
        const response = await fetch(`/api/user/pets/${pet.id}/passport`);
        if (!response.ok) return;

        const data = await response.json();
        const profile: FullPetProfile = data.profile;

        // Initialize draft from profile
        setDraft({
          pet: {
            name: profile.pet.name || '',
            breed: profile.pet.breed || '',
            dateOfBirth: profile.pet.date_of_birth || '',
            weight: profile.pet.weight?.toString() || '',
            gender: profile.pet.gender || '',
            allergies: profile.pet.allergies || '',
            microchipNumber: profile.pet.microchip_number || '',
            neuteredSpayed: profile.pet.neutered_spayed || false,
            color: profile.pet.color || '',
            sizeCategory: profile.pet.size_category || '',
            energyLevel: profile.pet.energy_level || '',
            aggressionLevel: profile.pet.aggression_level || '',
            isBiteHistory: profile.pet.is_bite_history || false,
            biteIncidentsCount: profile.pet.bite_incidents_count?.toString() || '0',
            houseTrained: profile.pet.house_trained || false,
            leashTrained: profile.pet.leash_trained || false,
            crateTrained: profile.pet.crate_trained || false,
            socialWithDogs: profile.pet.social_with_dogs || '',
            socialWithCats: profile.pet.social_with_cats || '',
            socialWithChildren: profile.pet.social_with_children || '',
            separationAnxiety: profile.pet.separation_anxiety || false,
          },
          vaccinations: profile.vaccinations,
          medicalRecords: profile.medicalRecords,
          feedingInfo: profile.feedingInfo ?? {},
          groomingInfo: profile.groomingInfo ?? {},
          emergencyInfo: profile.emergencyInfo ?? {},
        });

        setCompletion(calculateCompletion(profile));
      } catch {
        showToast('Failed to load pet profile', 'error');
      }
    };

    loadProfile();
  }, [isOpen, pet, showToast]);

  function updatePetField<K extends keyof PassportDraft['pet']>(key: K, value: PassportDraft['pet'][K]) {
    setDraft((current) => ({
      ...current,
      pet: { ...current.pet, [key]: value },
    }));
  }

  async function saveCurrentStep() {
    if (!pet) return;

    const payload: { stepIndex: number; pet?: Record<string, unknown> } = { stepIndex };

    if (stepIndex === 0) {
      // Basic Info
      payload.pet = {
        name: draft.pet.name.trim() || undefined,
        breed: draft.pet.breed.trim() || null,
        dateOfBirth: draft.pet.dateOfBirth || null,
        weight: draft.pet.weight.trim() ? parseFloat(draft.pet.weight) : null,
        gender: draft.pet.gender.trim() || null,
        allergies: draft.pet.allergies.trim() || null,
        microchipNumber: draft.pet.microchipNumber.trim() || null,
        neuteredSpayed: draft.pet.neuteredSpayed,
        color: draft.pet.color.trim() || null,
        sizeCategory: draft.pet.sizeCategory.trim() || null,
      };
    } else if (stepIndex === 1) {
      // Behavior & Aggression
      payload.pet = {
        energyLevel: draft.pet.energyLevel.trim() || null,
        aggressionLevel: draft.pet.aggressionLevel.trim() || null,
        isBiteHistory: draft.pet.isBiteHistory,
        biteIncidentsCount: draft.pet.isBiteHistory ? parseInt(draft.pet.biteIncidentsCount) || 0 : 0,
        houseTrained: draft.pet.houseTrained,
        leashTrained: draft.pet.leashTrained,
        crateTrained: draft.pet.crateTrained,
        socialWithDogs: draft.pet.socialWithDogs.trim() || null,
        socialWithCats: draft.pet.socialWithCats.trim() || null,
        socialWithChildren: draft.pet.socialWithChildren.trim() || null,
        separationAnxiety: draft.pet.separationAnxiety,
      };
    }

    startTransition(async () => {
      try {
        setSaveStatus('saving');

        let uploadedPhotoPath: string | null | undefined = pet.photo_url;
        if (stepIndex === 0 && profilePhotoFile) {
          try {
            const uploaded = await uploadCompressedImage(profilePhotoFile, 'pet-photos');
            uploadedPhotoPath = uploaded.path;
            setProfilePhotoPreview(uploaded.signedUrl);
            setProfilePhotoFile(null);
          } catch (error) {
            setSaveStatus('error');
            showToast(error instanceof Error ? error.message : 'Pet photo upload failed.', 'error');
            return;
          }
        }

        if (stepIndex === 0 && payload.pet) {
          payload.pet.photoUrl = uploadedPhotoPath ?? null;
        }

        const response = await fetch(`/api/user/pets/${pet.id}/passport`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          setSaveStatus('error');
          showToast('Failed to save pet details', 'error');
          return;
        }

        const data = await response.json();
        if (data.profile) {
          setCompletion(calculateCompletion(data.profile));
          if (data.profile.pet) {
            onSave({
              id: data.profile.pet.id,
              name: data.profile.pet.name,
              breed: data.profile.pet.breed ?? null,
              age: data.profile.pet.age ?? null,
              weight: data.profile.pet.weight ?? null,
              gender: data.profile.pet.gender ?? null,
              allergies: data.profile.pet.allergies ?? null,
              photo_url: data.profile.pet.photo_url ?? null,
            });
          }
          setSaveStatus('saved');
          showToast('Step saved successfully!', 'success');

          // Move to next step
          if (stepIndex < STEPS.length - 1) {
            setTimeout(() => setStepIndex(stepIndex + 1), 1000);
          } else {
            onClose();
          }
        }
      } catch {
        setSaveStatus('error');
        showToast('An error occurred', 'error');
      }
    });
  }

  const age = draft.pet.dateOfBirth ? calculateAgeFromDOB(draft.pet.dateOfBirth) : null;

  if (!pet) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${pet.name}'s Passport`} size="xl">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-4">
        {/* Header with Progress */}
        <div className="rounded-2xl bg-gradient-to-br from-coral/10 via-orange-50/30 to-transparent border border-coral/10 p-6">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-white shadow-sm">
                {profilePhotoPreview ? (
                  <Image src={profilePhotoPreview} alt={pet.name} fill className="object-cover" unoptimized />
                ) : (
                  <span className="text-2xl">{getPetFallbackIcon(draft.pet.breed || pet.breed)}</span>
                )}
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-neutral-950 mb-1">{pet.name}</h3>
              {pet.breed && <p className="text-sm text-neutral-600 mb-4">{pet.breed}</p>}
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-2xl font-bold text-coral">{completion}%</div>
                  <div className="text-xs text-neutral-600 mt-0.5">Complete</div>
                </div>
                <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-coral to-orange-400 transition-all duration-500" style={{ width: `${completion}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Steps UI */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, idx) => (
            <button
              key={idx}
              onClick={() => setStepIndex(idx)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${stepIndex === idx ? 'border-coral bg-coral/5' : 'border-neutral-200 bg-white hover:border-coral/30'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-900">{step}</span>
                <span className={`text-xs font-bold ${stepIndex === idx ? 'text-coral' : 'text-neutral-500'}`}>{idx + 1}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Editor Section */}
        <SectionCard title={STEPS[stepIndex]} description={`Complete ${STEPS[stepIndex].toLowerCase()}`}>
          <div className="space-y-4">
            {stepIndex === 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-white">
                    {profilePhotoPreview ? (
                      <Image src={profilePhotoPreview} alt={`${pet.name} preview`} fill className="object-cover" unoptimized />
                    ) : (
                      <span className="text-lg">{getPetFallbackIcon(draft.pet.breed || pet.breed)}</span>
                    )}
                  </div>
                  <label className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50">
                    {profilePhotoFile ? `Selected: ${profilePhotoFile.name}` : 'Upload pet profile photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setProfilePhotoFile(file);

                        if (localPhotoObjectUrl) {
                          URL.revokeObjectURL(localPhotoObjectUrl);
                          setLocalPhotoObjectUrl(null);
                        }

                        if (!file) {
                          setProfilePhotoPreview(photoUrl ?? null);
                          return;
                        }

                        const objectUrl = URL.createObjectURL(file);
                        setLocalPhotoObjectUrl(objectUrl);
                        setProfilePhotoPreview(objectUrl);
                      }}
                    />
                  </label>
                </div>
                <FormField label="Pet Name *" value={draft.pet.name} onChange={(e) => updatePetField('name', e.target.value)} placeholder="Enter pet name" />
                <FormField label="Breed" value={draft.pet.breed} onChange={(e) => updatePetField('breed', e.target.value)} placeholder="e.g., Golden Retriever" />
                <FormField label="Date of Birth" type="date" value={draft.pet.dateOfBirth} onChange={(e) => updatePetField('dateOfBirth', e.target.value)} />
                <FormField label="Age" type="text" disabled value={age ? `${age} years` : ''} />
                <FormField label="Weight (kg)" type="number" step="0.1" value={draft.pet.weight} onChange={(e) => updatePetField('weight', e.target.value)} />
                <FormField label="Gender" value={draft.pet.gender} onChange={(e) => updatePetField('gender', e.target.value)} />
                <FormField label="Color" value={draft.pet.color} onChange={(e) => updatePetField('color', e.target.value)} />
                <FormField label="Allergies" value={draft.pet.allergies} onChange={(e) => updatePetField('allergies', e.target.value)} />
              </div>
            )}

            {stepIndex === 1 && (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Aggression Level" value={draft.pet.aggressionLevel} onChange={(e) => updatePetField('aggressionLevel', e.target.value)} />
                <FormField label="Energy Level" value={draft.pet.energyLevel} onChange={(e) => updatePetField('energyLevel', e.target.value)} />
                <FormField label="Social with Dogs" value={draft.pet.socialWithDogs} onChange={(e) => updatePetField('socialWithDogs', e.target.value)} />
                <FormField label="Social with Cats" value={draft.pet.socialWithCats} onChange={(e) => updatePetField('socialWithCats', e.target.value)} />
                <FormField label="Social with Children" value={draft.pet.socialWithChildren} onChange={(e) => updatePetField('socialWithChildren', e.target.value)} />
                <div className="flex items-end gap-4">
                  <div className="flex-1 flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={draft.pet.isBiteHistory} onChange={(e) => updatePetField('isBiteHistory', e.target.checked)} className="rounded" />
                      <span className="text-sm font-medium text-neutral-700">Bite History</span>
                    </label>
                  </div>
                  {draft.pet.isBiteHistory && (
                    <FormField label="Incidents" type="number" value={draft.pet.biteIncidentsCount} onChange={(e) => updatePetField('biteIncidentsCount', e.target.value)} className="flex-1" />
                  )}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.pet.houseTrained} onChange={(e) => updatePetField('houseTrained', e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium text-neutral-700">House Trained</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.pet.leashTrained} onChange={(e) => updatePetField('leashTrained', e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium text-neutral-700">Leash Trained</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.pet.crateTrained} onChange={(e) => updatePetField('crateTrained', e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium text-neutral-700">Crate Trained</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.pet.separationAnxiety} onChange={(e) => updatePetField('separationAnxiety', e.target.checked)} className="rounded" />
                  <span className="text-sm font-medium text-neutral-700">Separation Anxiety</span>
                </label>
              </div>
            )}

            {stepIndex > 1 && (
              <div className="text-center py-8">
                <p className="text-neutral-600 mb-4">This section can be added through the full profile editor</p>
                <p className="text-sm text-neutral-500">Save basic information first, then expand your pet&apos;s passport details</p>
              </div>
            )}

            {/* Save Status */}
            {saveStatus !== 'idle' && (
              <div className={`text-center text-sm p-3 rounded-lg ${saveStatus === 'saving' ? 'bg-blue-50 text-blue-700' : saveStatus === 'saved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved successfully!' : '✗ Error saving'}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-xl border border-neutral-200/70 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60"
              >
                Close
              </button>
              <div className="flex gap-3">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setStepIndex(stepIndex - 1)}
                    disabled={isPending}
                    className="rounded-xl border border-neutral-200/70 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60"
                  >
                    ← Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveCurrentStep}
                  disabled={isPending || !draft.pet.name.trim()}
                  className="rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-md disabled:opacity-60"
                >
                  {isPending ? 'Saving...' : stepIndex === STEPS.length - 1 ? 'Save & Close' : 'Save & Next'}
                </button>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </Modal>
  );
}
