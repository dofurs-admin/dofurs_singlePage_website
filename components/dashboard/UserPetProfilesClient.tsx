'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/components/ui/ToastProvider';
import { uploadCompressedImage } from '@/lib/storage/upload-client';

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
  aggression_level?:
    | 'friendly'
    | 'docile'
    | 'mild_aggression'
    | 'aggressive'
    | 'sometimes_nervous'
    | 'nervous_but_manageable'
    | 'not_sure'
    | 'other'
    | null;
};

type VaccinationDraft = {
  id?: string;
  vaccineName: string;
  brandName: string;
  batchNumber: string;
  doseNumber: string;
  administeredDate: string;
  nextDueDate: string;
  veterinarianName: string;
  clinicName: string;
  certificateUrl: string;
  reminderEnabled: boolean;
};

type MedicalDraft = {
  id?: string;
  conditionName: string;
  diagnosisDate: string;
  ongoing: boolean;
  medications: string;
  specialCareInstructions: string;
  vetName: string;
  documentUrl: string;
};

type PassportDraft = {
  pet: {
    id?: number;
    name: string;
    breed: string;
    age: string;
    weight: string;
    gender: string;
    allergies: string;
    photoUrl: string;
    dateOfBirth: string;
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
  vaccinations: VaccinationDraft[];
  medicalRecords: MedicalDraft[];
  feedingInfo: {
    foodType: string;
    brandName: string;
    feedingSchedule: string;
    foodAllergies: string;
    specialDietNotes: string;
    treatsAllowed: boolean;
  };
  groomingInfo: {
    coatType: string;
    mattingProne: boolean;
    groomingFrequency: string;
    lastGroomingDate: string;
    nailTrimFrequency: string;
  };
  emergencyInfo: {
    emergencyContactName: string;
    emergencyContactPhone: string;
    preferredVetClinic: string;
    preferredVetPhone: string;
  };
};

type FullPetProfile = {
  pet: Pet & {
    microchip_number: string | null;
    neutered_spayed: boolean;
    color: string | null;
    size_category: string | null;
    energy_level: string | null;
    is_bite_history: boolean;
    bite_incidents_count: number;
    house_trained: boolean;
    leash_trained: boolean;
    crate_trained: boolean;
    social_with_dogs: string | null;
    social_with_cats: string | null;
    social_with_children: string | null;
    separation_anxiety: boolean;
  };
  vaccinations: Array<{
    id: string;
    vaccine_name: string;
    brand_name: string | null;
    batch_number: string | null;
    dose_number: number | null;
    administered_date: string;
    next_due_date: string | null;
    veterinarian_name: string | null;
    clinic_name: string | null;
    certificate_url: string | null;
    reminder_enabled: boolean;
  }>;
  medicalRecords: Array<{
    id: string;
    condition_name: string;
    diagnosis_date: string | null;
    ongoing: boolean;
    medications: string | null;
    special_care_instructions: string | null;
    vet_name: string | null;
    document_url: string | null;
  }>;
  feedingInfo: {
    food_type: string | null;
    brand_name: string | null;
    feeding_schedule: string | null;
    food_allergies: string | null;
    special_diet_notes: string | null;
    treats_allowed: boolean;
  } | null;
  groomingInfo: {
    coat_type: string | null;
    matting_prone: boolean;
    grooming_frequency: string | null;
    last_grooming_date: string | null;
    nail_trim_frequency: string | null;
  } | null;
  emergencyInfo: {
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    preferred_vet_clinic: string | null;
    preferred_vet_phone: string | null;
  } | null;
};

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

type PetCreateForm = {
  name: string;
  breed: string;
  age: string;
  weight: string;
  gender: string;
  allergies: string;
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

const AGGRESSION_OPTIONS = [
  'friendly',
  'docile',
  'mild_aggression',
  'aggressive',
  'sometimes_nervous',
  'nervous_but_manageable',
  'not_sure',
  'other',
];

function emptyDraft(): PassportDraft {
  return {
    pet: {
      name: '',
      breed: '',
      age: '',
      weight: '',
      gender: '',
      allergies: '',
      photoUrl: '',
      dateOfBirth: '',
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
    feedingInfo: {
      foodType: '',
      brandName: '',
      feedingSchedule: '',
      foodAllergies: '',
      specialDietNotes: '',
      treatsAllowed: true,
    },
    groomingInfo: {
      coatType: '',
      mattingProne: false,
      groomingFrequency: '',
      lastGroomingDate: '',
      nailTrimFrequency: '',
    },
    emergencyInfo: {
      emergencyContactName: '',
      emergencyContactPhone: '',
      preferredVetClinic: '',
      preferredVetPhone: '',
    },
  };
}

function mapProfileToDraft(profile: FullPetProfile): PassportDraft {
  return {
    pet: {
      id: profile.pet.id,
      name: profile.pet.name,
      breed: profile.pet.breed ?? '',
      age: profile.pet.age !== null ? String(profile.pet.age) : '',
      weight: profile.pet.weight !== null ? String(profile.pet.weight) : '',
      gender: profile.pet.gender ?? '',
      allergies: profile.pet.allergies ?? '',
      photoUrl: profile.pet.photo_url ?? '',
      dateOfBirth: profile.pet.date_of_birth ?? '',
      microchipNumber: profile.pet.microchip_number ?? '',
      neuteredSpayed: profile.pet.neutered_spayed,
      color: profile.pet.color ?? '',
      sizeCategory: profile.pet.size_category ?? '',
      energyLevel: profile.pet.energy_level ?? '',
      aggressionLevel: profile.pet.aggression_level ?? '',
      isBiteHistory: profile.pet.is_bite_history,
      biteIncidentsCount: String(profile.pet.bite_incidents_count ?? 0),
      houseTrained: profile.pet.house_trained,
      leashTrained: profile.pet.leash_trained,
      crateTrained: profile.pet.crate_trained,
      socialWithDogs: profile.pet.social_with_dogs ?? '',
      socialWithCats: profile.pet.social_with_cats ?? '',
      socialWithChildren: profile.pet.social_with_children ?? '',
      separationAnxiety: profile.pet.separation_anxiety,
    },
    vaccinations: profile.vaccinations.map((item) => ({
      id: item.id,
      vaccineName: item.vaccine_name,
      brandName: item.brand_name ?? '',
      batchNumber: item.batch_number ?? '',
      doseNumber: item.dose_number !== null ? String(item.dose_number) : '',
      administeredDate: item.administered_date,
      nextDueDate: item.next_due_date ?? '',
      veterinarianName: item.veterinarian_name ?? '',
      clinicName: item.clinic_name ?? '',
      certificateUrl: item.certificate_url ?? '',
      reminderEnabled: item.reminder_enabled,
    })),
    medicalRecords: profile.medicalRecords.map((item) => ({
      id: item.id,
      conditionName: item.condition_name,
      diagnosisDate: item.diagnosis_date ?? '',
      ongoing: item.ongoing,
      medications: item.medications ?? '',
      specialCareInstructions: item.special_care_instructions ?? '',
      vetName: item.vet_name ?? '',
      documentUrl: item.document_url ?? '',
    })),
    feedingInfo: {
      foodType: profile.feedingInfo?.food_type ?? '',
      brandName: profile.feedingInfo?.brand_name ?? '',
      feedingSchedule: profile.feedingInfo?.feeding_schedule ?? '',
      foodAllergies: profile.feedingInfo?.food_allergies ?? '',
      specialDietNotes: profile.feedingInfo?.special_diet_notes ?? '',
      treatsAllowed: profile.feedingInfo?.treats_allowed ?? true,
    },
    groomingInfo: {
      coatType: profile.groomingInfo?.coat_type ?? '',
      mattingProne: profile.groomingInfo?.matting_prone ?? false,
      groomingFrequency: profile.groomingInfo?.grooming_frequency ?? '',
      lastGroomingDate: profile.groomingInfo?.last_grooming_date ?? '',
      nailTrimFrequency: profile.groomingInfo?.nail_trim_frequency ?? '',
    },
    emergencyInfo: {
      emergencyContactName: profile.emergencyInfo?.emergency_contact_name ?? '',
      emergencyContactPhone: profile.emergencyInfo?.emergency_contact_phone ?? '',
      preferredVetClinic: profile.emergencyInfo?.preferred_vet_clinic ?? '',
      preferredVetPhone: profile.emergencyInfo?.preferred_vet_phone ?? '',
    },
  };
}

function normalizePhoneInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const sanitized = trimmed.replace(/[^0-9+]/g, '');
  if (!sanitized) {
    return '';
  }

  const hasPlus = sanitized.startsWith('+');
  const digits = sanitized.replace(/\D/g, '');
  if (!digits) {
    return hasPlus ? '+' : '';
  }

  const chunks = digits.match(/.{1,3}/g) ?? [digits];
  return `${hasPlus ? '+' : ''}${chunks.join(' ')}`;
}

function stepIndexFromFieldPath(path: string) {
  if (path.startsWith('pet.')) {
    return path === 'pet.biteIncidentsCount' ? 1 : 0;
  }
  if (path.startsWith('vaccinations.')) {
    return 2;
  }
  if (path.startsWith('medicalRecords.')) {
    return 3;
  }
  if (path.startsWith('feedingInfo.')) {
    return 4;
  }
  if (path.startsWith('groomingInfo.')) {
    return 5;
  }
  if (path.startsWith('emergencyInfo.')) {
    return 6;
  }
  return 0;
}

export default function UserPetProfilesClient({ initialPets }: { initialPets: Pet[] }) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [pets, setPets] = useState(initialPets);
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
  const [selectedPetId, setSelectedPetId] = useState<number | null>(initialPets[0]?.id ?? null);
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<PassportDraft>(emptyDraft());
  const [newPet, setNewPet] = useState<PetCreateForm>({ name: '', breed: '', age: '', weight: '', gender: '', allergies: '' });
  const [newPetPhotoFile, setNewPetPhotoFile] = useState<File | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [reminders, setReminders] = useState<ReminderGroup[]>([]);
  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreferences>({
    daysAhead: 7,
    inAppEnabled: true,
    emailEnabled: false,
    whatsappEnabled: false,
  });
  const [deletedVaccinationIds, setDeletedVaccinationIds] = useState<string[]>([]);
  const [deletedMedicalRecordIds, setDeletedMedicalRecordIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'draft-saved' | 'error'>('idle');
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [highlightStepIndex, setHighlightStepIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const selectedPet = useMemo(() => pets.find((pet) => pet.id === selectedPetId) ?? null, [pets, selectedPetId]);

  const draftStorageKey = selectedPetId ? `pet-passport-draft-${selectedPetId}` : null;

  const stepCompletion = useMemo(() => {
    const age = draft.pet.age.trim() ? Number.parseInt(draft.pet.age, 10) : null;
    const weight = draft.pet.weight.trim() ? Number.parseFloat(draft.pet.weight) : null;
    const basicComplete =
      draft.pet.name.trim().length > 0 &&
      (age === null || (Number.isFinite(age) && age >= 0 && age <= 40)) &&
      (weight === null || (Number.isFinite(weight) && weight > 0 && weight <= 300));

    const biteCount = draft.pet.biteIncidentsCount.trim() ? Number.parseInt(draft.pet.biteIncidentsCount, 10) : 0;
    const behaviorTouched =
      draft.pet.aggressionLevel.trim().length > 0 ||
      draft.pet.socialWithDogs.trim().length > 0 ||
      draft.pet.socialWithCats.trim().length > 0 ||
      draft.pet.socialWithChildren.trim().length > 0 ||
      draft.pet.isBiteHistory ||
      draft.pet.houseTrained ||
      draft.pet.leashTrained ||
      draft.pet.crateTrained ||
      draft.pet.separationAnxiety;
    const behaviorComplete = behaviorTouched && Number.isFinite(biteCount) && biteCount >= 0;

    const vaccinationsTouched = draft.vaccinations.length > 0;
    const vaccinationsComplete =
      vaccinationsTouched &&
      draft.vaccinations.every((row) => {
        if (!row.vaccineName.trim() || !row.administeredDate) {
          return false;
        }
        if (row.nextDueDate && row.nextDueDate < row.administeredDate) {
          return false;
        }
        return true;
      });

    const medicalTouched = draft.medicalRecords.length > 0;
    const medicalComplete = medicalTouched && draft.medicalRecords.every((row) => row.conditionName.trim().length > 0);

    const feedingComplete =
      draft.feedingInfo.foodType.trim().length > 0 ||
      draft.feedingInfo.brandName.trim().length > 0 ||
      draft.feedingInfo.feedingSchedule.trim().length > 0 ||
      draft.feedingInfo.foodAllergies.trim().length > 0 ||
      draft.feedingInfo.specialDietNotes.trim().length > 0 ||
      draft.feedingInfo.treatsAllowed !== true;

    const groomingComplete =
      draft.groomingInfo.coatType.trim().length > 0 ||
      draft.groomingInfo.groomingFrequency.trim().length > 0 ||
      draft.groomingInfo.lastGroomingDate.trim().length > 0 ||
      draft.groomingInfo.nailTrimFrequency.trim().length > 0 ||
      draft.groomingInfo.mattingProne;

    const phonePattern = /^[0-9+()\-\s]{7,20}$/;
    const emergencyPhone = draft.emergencyInfo.emergencyContactPhone.trim();
    const preferredPhone = draft.emergencyInfo.preferredVetPhone.trim();
    const emergencyTouched =
      draft.emergencyInfo.emergencyContactName.trim().length > 0 ||
      emergencyPhone.length > 0 ||
      draft.emergencyInfo.preferredVetClinic.trim().length > 0 ||
      preferredPhone.length > 0;
    const emergencyComplete =
      emergencyTouched &&
      (!emergencyPhone || phonePattern.test(emergencyPhone)) &&
      (!preferredPhone || phonePattern.test(preferredPhone));

    return [basicComplete, behaviorComplete, vaccinationsComplete, medicalComplete, feedingComplete, groomingComplete, emergencyComplete];
  }, [draft]);

  const completionPercent = useMemo(() => {
    const completedCount = stepCompletion.filter(Boolean).length;
    return Math.round((completedCount / STEPS.length) * 100);
  }, [stepCompletion]);

  const missingSteps = useMemo(() => {
    return STEPS.map((label, index) => ({ label, index })).filter((item) => !stepCompletion[item.index]);
  }, [stepCompletion]);

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

  useEffect(() => {
    if (!selectedPetId) {
      setDraft(emptyDraft());
      return;
    }

    let active = true;

    async function loadProfile() {
      setIsLoadingProfile(true);

      const response = await fetch(`/api/user/pets/${selectedPetId}/passport`);
      if (!response.ok) {
        if (active) {
          showToast('Unable to load pet passport.', 'error');
          setIsLoadingProfile(false);
        }
        return;
      }

      const payload = (await response.json().catch(() => null)) as { profile?: FullPetProfile } | null;

      if (!active || !payload?.profile) {
        return;
      }

      const baseDraft = mapProfileToDraft(payload.profile);
      const localDraftRaw = window.localStorage.getItem(`pet-passport-draft-${selectedPetId}`);

      if (localDraftRaw) {
        const parsedLocal = JSON.parse(localDraftRaw) as PassportDraft;
        const mergedDraft = {
          ...baseDraft,
          ...parsedLocal,
          pet: {
            ...baseDraft.pet,
            ...parsedLocal.pet,
          },
        };
        setDraft(mergedDraft);
      } else {
        setDraft(baseDraft);
      }

      setDeletedVaccinationIds([]);
      setDeletedMedicalRecordIds([]);
      setSavedSnapshot(
        JSON.stringify({
          draft: baseDraft,
          deletedVaccinationIds: [],
          deletedMedicalRecordIds: [],
        }),
      );
      setHasUnsavedChanges(false);
      setFieldErrors({});
      setSaveStatus('idle');

      setIsLoadingProfile(false);
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [selectedPetId, showToast]);

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

    async function loadReminders() {
      const response = await fetch('/api/user/pets/upcoming-vaccinations');
      if (!response.ok || !active) {
        return;
      }
      const payload = (await response.json().catch(() => null)) as {
        reminders?: ReminderGroup[];
        daysAhead?: number;
        channels?: Omit<ReminderPreferences, 'daysAhead'>;
      } | null;
      if (payload?.reminders && active) {
        setReminders(payload.reminders);
      }

      if (payload?.daysAhead && payload?.channels && active) {
        setReminderPreferences({
          daysAhead: payload.daysAhead,
          inAppEnabled: payload.channels.inAppEnabled,
          emailEnabled: payload.channels.emailEnabled,
          whatsappEnabled: payload.channels.whatsappEnabled,
        });
      }
    }

    loadReminderPreferences();
    loadReminders();

    return () => {
      active = false;
    };
  }, []);

  async function saveReminderPreferences() {
    const response = await fetch('/api/user/pets/reminder-preferences', {
      method: 'PUT',
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
  }

  function saveDraftLocally() {
    if (!draftStorageKey) {
      return;
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    setLastDraftSavedAt(new Date().toISOString());
    setSaveStatus('draft-saved');
    showToast('Draft saved locally.', 'success');
  }

  useEffect(() => {
    if (!draftStorageKey || !selectedPetId) {
      return;
    }

    const handle = window.setTimeout(() => {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      setLastDraftSavedAt(new Date().toISOString());
      setSaveStatus('draft-saved');
    }, 900);

    return () => {
      window.clearTimeout(handle);
    };
  }, [draft, draftStorageKey, selectedPetId]);

  useEffect(() => {
    if (!selectedPetId || !savedSnapshot) {
      return;
    }

    const currentSnapshot = JSON.stringify({
      draft,
      deletedVaccinationIds,
      deletedMedicalRecordIds,
    });

    setHasUnsavedChanges(currentSnapshot !== savedSnapshot);
  }, [draft, deletedVaccinationIds, deletedMedicalRecordIds, savedSnapshot, selectedPetId]);

  useEffect(() => {
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', beforeUnloadHandler);
    return () => {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    };
  }, [hasUnsavedChanges]);

  function getFieldError(path: string) {
    return fieldErrors[path] ?? null;
  }

  function inputBaseClass(path: string) {
    return `rounded-xl border px-3 py-2 text-sm ${getFieldError(path) ? 'border-[#e76f51] bg-[#fff7f0]' : 'border-[#f2dfcf]'}`;
  }

  function isTypingTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!selectedPetId || isTypingTarget(event.target) || !event.altKey) {
        return;
      }

      const hasPendingChanges = hasUnsavedChanges;
      const allowNavigate =
        !hasPendingChanges || window.confirm('You have unsaved changes. Continue and discard unsaved progress?');

      if (!allowNavigate) {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const nextStep = Math.min(STEPS.length - 1, stepIndex + 1);
        setStepIndex(nextStep);
        setHighlightStepIndex(nextStep);
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const nextStep = Math.max(0, stepIndex - 1);
        setStepIndex(nextStep);
        setHighlightStepIndex(nextStep);
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [selectedPetId, stepIndex, hasUnsavedChanges]);

  useEffect(() => {
    if (!selectedPetId || isLoadingProfile || !editorRef.current) {
      return;
    }

    const focusable = editorRef.current.querySelector<HTMLInputElement | HTMLSelectElement>('input, select');
    focusable?.focus();
  }, [selectedPetId, stepIndex, isLoadingProfile]);

  useEffect(() => {
    if (highlightStepIndex === null || highlightStepIndex !== stepIndex) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightStepIndex(null);
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [highlightStepIndex, stepIndex]);

  function validateCurrentStep() {
    const nextErrors: Record<string, string> = {};

    if (stepIndex === 0 && !draft.pet.name.trim()) {
      nextErrors['pet.name'] = 'Pet name is required.';
    }

    if (stepIndex === 0) {
      const age = draft.pet.age.trim() ? Number.parseInt(draft.pet.age, 10) : null;
      const weight = draft.pet.weight.trim() ? Number.parseFloat(draft.pet.weight) : null;

      if (age !== null && (!Number.isFinite(age) || age < 0 || age > 40)) {
        nextErrors['pet.age'] = 'Age must be between 0 and 40.';
      }

      if (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 300)) {
        nextErrors['pet.weight'] = 'Weight must be between 0.1 and 300 kg.';
      }
    }

    if (stepIndex === 1) {
      const biteCount = draft.pet.biteIncidentsCount.trim() ? Number.parseInt(draft.pet.biteIncidentsCount, 10) : 0;
      if (!Number.isFinite(biteCount) || biteCount < 0) {
        nextErrors['pet.biteIncidentsCount'] = 'Bite incidents must be 0 or greater.';
      }
    }

    if (stepIndex === 2) {
      const seenVaccinations = new Set<string>();
      for (const [index, row] of draft.vaccinations.entries()) {
        if (!row.vaccineName.trim() || !row.administeredDate) {
          nextErrors[`vaccinations.${index}.vaccineName`] = 'Vaccine name is required.';
          nextErrors[`vaccinations.${index}.administeredDate`] = 'Administered date is required.';
        }

        if (row.nextDueDate && row.nextDueDate < row.administeredDate) {
          nextErrors[`vaccinations.${index}.nextDueDate`] = 'Next due date cannot be before administered date.';
        }

        if (row.vaccineName.trim() && row.administeredDate) {
          const dedupeKey = `${row.vaccineName.trim().toLowerCase()}|${row.administeredDate}`;
          if (seenVaccinations.has(dedupeKey)) {
            nextErrors[`vaccinations.${index}.vaccineName`] = 'Duplicate vaccine entry for this date.';
          }
          seenVaccinations.add(dedupeKey);
        }
      }
    }

    if (stepIndex === 3) {
      for (const [index, row] of draft.medicalRecords.entries()) {
        if (!row.conditionName.trim()) {
          nextErrors[`medicalRecords.${index}.conditionName`] = 'Condition name is required.';
        }
      }
    }

    if (stepIndex === 6) {
      const phonePattern = /^[0-9+()\-\s]{7,20}$/;
      const emergencyPhone = draft.emergencyInfo.emergencyContactPhone.trim();
      const preferredVetPhone = draft.emergencyInfo.preferredVetPhone.trim();

      if (emergencyPhone && !phonePattern.test(emergencyPhone)) {
        nextErrors['emergencyInfo.emergencyContactPhone'] = 'Invalid emergency contact phone format.';
      }

      if (preferredVetPhone && !phonePattern.test(preferredVetPhone)) {
        nextErrors['emergencyInfo.preferredVetPhone'] = 'Invalid preferred vet phone format.';
      }
    }

    setFieldErrors(nextErrors);

    const firstError = Object.values(nextErrors)[0];
    if (firstError) {
      showToast(firstError, 'error');
      return false;
    }

    return true;
  }

  function canLeaveCurrentContext() {
    if (!hasUnsavedChanges) {
      return true;
    }

    return window.confirm('You have unsaved changes. Continue and discard unsaved progress?');
  }

  function selectPetWithGuard(nextPetId: number) {
    if (selectedPetId === nextPetId) {
      return;
    }

    if (!canLeaveCurrentContext()) {
      return;
    }

    setSelectedPetId(nextPetId);
    setStepIndex(0);
    setHighlightStepIndex(0);
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
      } catch {
        showToast('Photo upload failed.', 'error');
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
          age: newPet.age.trim() ? Number.parseInt(newPet.age, 10) : null,
          weight: newPet.weight.trim() ? Number.parseFloat(newPet.weight) : null,
          gender: newPet.gender.trim() || null,
          allergies: newPet.allergies.trim() || null,
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
      setSelectedPetId(payload.pet.id);
      setNewPet({ name: '', breed: '', age: '', weight: '', gender: '', allergies: '' });
      setNewPetPhotoFile(null);
      showToast('Pet profile created.', 'success');
    });
  }

  function buildStepPayload() {
    const basePayload = { stepIndex };

    if (stepIndex === 0) {
      return {
        ...basePayload,
        pet: {
          name: draft.pet.name.trim(),
          breed: draft.pet.breed.trim() || null,
          age: draft.pet.age.trim() ? Number.parseInt(draft.pet.age, 10) : null,
          weight: draft.pet.weight.trim() ? Number.parseFloat(draft.pet.weight) : null,
          gender: draft.pet.gender.trim() || null,
          allergies: draft.pet.allergies.trim() || null,
          photoUrl: draft.pet.photoUrl.trim() || null,
          dateOfBirth: draft.pet.dateOfBirth || null,
          microchipNumber: draft.pet.microchipNumber.trim() || null,
          neuteredSpayed: draft.pet.neuteredSpayed,
          color: draft.pet.color.trim() || null,
          sizeCategory: draft.pet.sizeCategory.trim() || null,
          energyLevel: draft.pet.energyLevel.trim() || null,
        },
      };
    }

    if (stepIndex === 1) {
      return {
        ...basePayload,
        pet: {
          aggressionLevel: draft.pet.aggressionLevel || null,
          isBiteHistory: draft.pet.isBiteHistory,
          biteIncidentsCount: draft.pet.biteIncidentsCount.trim() ? Number.parseInt(draft.pet.biteIncidentsCount, 10) : 0,
          houseTrained: draft.pet.houseTrained,
          leashTrained: draft.pet.leashTrained,
          crateTrained: draft.pet.crateTrained,
          socialWithDogs: draft.pet.socialWithDogs.trim() || null,
          socialWithCats: draft.pet.socialWithCats.trim() || null,
          socialWithChildren: draft.pet.socialWithChildren.trim() || null,
          separationAnxiety: draft.pet.separationAnxiety,
        },
      };
    }

    if (stepIndex === 2) {
      return {
        ...basePayload,
        vaccinations: [
          ...draft.vaccinations.map((item) => ({
            id: item.id,
            vaccineName: item.vaccineName.trim(),
            brandName: item.brandName.trim() || null,
            batchNumber: item.batchNumber.trim() || null,
            doseNumber: item.doseNumber.trim() ? Number.parseInt(item.doseNumber, 10) : null,
            administeredDate: item.administeredDate,
            nextDueDate: item.nextDueDate || null,
            veterinarianName: item.veterinarianName.trim() || null,
            clinicName: item.clinicName.trim() || null,
            certificateUrl: item.certificateUrl.trim() || null,
            reminderEnabled: item.reminderEnabled,
            _delete: false,
          })),
          ...deletedVaccinationIds.map((id) => ({ id, _delete: true })),
        ],
      };
    }

    if (stepIndex === 3) {
      return {
        ...basePayload,
        medicalRecords: [
          ...draft.medicalRecords.map((item) => ({
            id: item.id,
            conditionName: item.conditionName.trim(),
            diagnosisDate: item.diagnosisDate || null,
            ongoing: item.ongoing,
            medications: item.medications.trim() || null,
            specialCareInstructions: item.specialCareInstructions.trim() || null,
            vetName: item.vetName.trim() || null,
            documentUrl: item.documentUrl.trim() || null,
            _delete: false,
          })),
          ...deletedMedicalRecordIds.map((id) => ({ id, _delete: true })),
        ],
      };
    }

    if (stepIndex === 4) {
      return {
        ...basePayload,
        feedingInfo: {
          foodType: draft.feedingInfo.foodType.trim() || null,
          brandName: draft.feedingInfo.brandName.trim() || null,
          feedingSchedule: draft.feedingInfo.feedingSchedule.trim() || null,
          foodAllergies: draft.feedingInfo.foodAllergies.trim() || null,
          specialDietNotes: draft.feedingInfo.specialDietNotes.trim() || null,
          treatsAllowed: draft.feedingInfo.treatsAllowed,
        },
      };
    }

    if (stepIndex === 5) {
      return {
        ...basePayload,
        groomingInfo: {
          coatType: draft.groomingInfo.coatType.trim() || null,
          mattingProne: draft.groomingInfo.mattingProne,
          groomingFrequency: draft.groomingInfo.groomingFrequency.trim() || null,
          lastGroomingDate: draft.groomingInfo.lastGroomingDate || null,
          nailTrimFrequency: draft.groomingInfo.nailTrimFrequency.trim() || null,
        },
      };
    }

    return {
      ...basePayload,
      emergencyInfo: {
        emergencyContactName: draft.emergencyInfo.emergencyContactName.trim() || null,
        emergencyContactPhone: draft.emergencyInfo.emergencyContactPhone.trim() || null,
        preferredVetClinic: draft.emergencyInfo.preferredVetClinic.trim() || null,
        preferredVetPhone: draft.emergencyInfo.preferredVetPhone.trim() || null,
      },
    };
  }

  function saveCurrentStep() {
    if (!selectedPetId) {
      showToast('Create or select a pet first.', 'error');
      return;
    }

    if (!validateCurrentStep()) {
      return;
    }

    const payload = buildStepPayload();

    startTransition(async () => {
      setSaveStatus('saving');
      const previousPets = pets;
      if (stepIndex === 0 && selectedPetId) {
        setPets((current) =>
          current.map((pet) =>
            pet.id === selectedPetId
              ? {
                  ...pet,
                  name: draft.pet.name.trim() || pet.name,
                  breed: draft.pet.breed.trim() || null,
                  age: draft.pet.age.trim() ? Number.parseInt(draft.pet.age, 10) : null,
                  weight: draft.pet.weight.trim() ? Number.parseFloat(draft.pet.weight) : null,
                  gender: draft.pet.gender.trim() || null,
                  allergies: draft.pet.allergies.trim() || null,
                }
              : pet,
          ),
        );
      }

      const response = await fetch(`/api/user/pets/${selectedPetId}/passport`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setSaveStatus('error');
        if (stepIndex === 0) {
          setPets(previousPets);
        }
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        showToast(body?.error ?? 'Unable to save this step.', 'error');
        return;
      }

      const body = (await response.json().catch(() => null)) as { profile?: FullPetProfile } | null;
      if (body?.profile) {
        const normalizedDraft = mapProfileToDraft(body.profile);
        setDraft(normalizedDraft);
        setPets((current) =>
          current.map((pet) =>
            pet.id === selectedPetId
              ? {
                  ...pet,
                  name: body.profile!.pet.name,
                  breed: body.profile!.pet.breed,
                  age: body.profile!.pet.age,
                  weight: body.profile!.pet.weight,
                  gender: body.profile!.pet.gender,
                  allergies: body.profile!.pet.allergies,
                  photo_url: body.profile!.pet.photo_url,
                }
              : pet,
          ),
        );
        setSavedSnapshot(
          JSON.stringify({
            draft: normalizedDraft,
            deletedVaccinationIds: [],
            deletedMedicalRecordIds: [],
          }),
        );
      }

      if (draftStorageKey) {
        window.localStorage.removeItem(draftStorageKey);
      }
      setFieldErrors({});
      setDeletedVaccinationIds([]);
      setDeletedMedicalRecordIds([]);
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      showToast('Step saved.', 'success');
    });
  }

  function removeVaccinationRow(index: number) {
    setDraft((current) => {
      const target = current.vaccinations[index];
      if (target?.id) {
        setDeletedVaccinationIds((prev) => (prev.includes(target.id!) ? prev : [...prev, target.id!]));
      }

      return {
        ...current,
        vaccinations: current.vaccinations.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }

  function removeMedicalRow(index: number) {
    setDraft((current) => {
      const target = current.medicalRecords[index];
      if (target?.id) {
        setDeletedMedicalRecordIds((prev) => (prev.includes(target.id!) ? prev : [...prev, target.id!]));
      }

      return {
        ...current,
        medicalRecords: current.medicalRecords.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }

  function updatePetField<K extends keyof PassportDraft['pet']>(key: K, value: PassportDraft['pet'][K]) {
    setDraft((current) => ({
      ...current,
      pet: {
        ...current.pet,
        [key]: value,
      },
    }));
  }

  function jumpToStepWithHighlight(targetStepIndex: number) {
    if (targetStepIndex !== stepIndex && !canLeaveCurrentContext()) {
      return;
    }

    setStepIndex(targetStepIndex);
    setHighlightStepIndex(targetStepIndex);
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function jumpToFirstError() {
    const firstErrorPath = Object.keys(fieldErrors)[0];
    if (!firstErrorPath) {
      return;
    }

    jumpToStepWithHighlight(stepIndexFromFieldPath(firstErrorPath));
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-ink">Pet Profiles</h1>
          <Link
            href="/dashboard"
            className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink"
          >
            Back to Dashboard
          </Link>
        </div>
        <p className="mt-2 text-sm text-[#6b6b6b]">Manage full medical and behavioral passports with reminders and step-by-step saves.</p>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-base font-semibold text-ink">Create New Pet</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            value={newPet.name}
            onChange={(event) => setNewPet((current) => ({ ...current, name: event.target.value }))}
            placeholder="Pet name *"
            className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
          />
          <input
            value={newPet.breed}
            onChange={(event) => setNewPet((current) => ({ ...current, breed: event.target.value }))}
            placeholder="Breed"
            className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
          />
          <input
            value={newPet.age}
            onChange={(event) => setNewPet((current) => ({ ...current, age: event.target.value }))}
            type="number"
            min={0}
            max={40}
            placeholder="Age"
            className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
          />
          <input
            value={newPet.weight}
            onChange={(event) => setNewPet((current) => ({ ...current, weight: event.target.value }))}
            type="number"
            step={0.1}
            min={0}
            placeholder="Weight (kg)"
            className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
          />
          <input
            value={newPet.gender}
            onChange={(event) => setNewPet((current) => ({ ...current, gender: event.target.value }))}
            placeholder="Gender"
            className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
          />
          <input
            value={newPet.allergies}
            onChange={(event) => setNewPet((current) => ({ ...current, allergies: event.target.value }))}
            placeholder="Allergies"
            className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-full border border-[#f2dfcf] px-3 py-2 text-xs text-ink">
            {newPetPhotoFile ? `Photo selected: ${newPetPhotoFile.name}` : 'Upload Photo'}
            <input type="file" accept="image/*" className="hidden" onChange={(event) => setNewPetPhotoFile(event.target.files?.[0] ?? null)} />
          </label>
          <button
            type="button"
            onClick={createPetProfile}
            disabled={isPending}
            className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60"
          >
            {isPending ? 'Creating...' : 'Create & Open Passport'}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-base font-semibold text-ink">Upcoming Vaccine Reminders ({reminderPreferences.daysAhead} days)</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs text-[#6b6b6b] lg:col-span-2">
            Window (days)
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
              className="mt-1 w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={reminderPreferences.inAppEnabled}
              onChange={(event) =>
                setReminderPreferences((current) => ({ ...current, inAppEnabled: event.target.checked }))
              }
            />
            In-app
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={reminderPreferences.emailEnabled}
              onChange={(event) =>
                setReminderPreferences((current) => ({ ...current, emailEnabled: event.target.checked }))
              }
            />
            Email
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={reminderPreferences.whatsappEnabled}
              onChange={(event) =>
                setReminderPreferences((current) => ({ ...current, whatsappEnabled: event.target.checked }))
              }
            />
            WhatsApp
          </label>
        </div>
        <div className="mt-2">
          <button
            type="button"
            onClick={saveReminderPreferences}
            className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink"
          >
            Save Reminder Preferences
          </button>
        </div>
        <ul className="mt-3 grid gap-2 text-sm">
          {reminders.length === 0 ? <li className="text-[#6b6b6b]">No upcoming reminders.</li> : null}
          {reminders.map((group) => (
            <li key={group.petId} className="rounded-xl border border-[#f2dfcf] p-3">
              <div className="font-semibold text-ink">{group.petName}</div>
              <div className="mt-1 text-xs text-[#6b6b6b]">
                {group.vaccinations.map((vax) => `${vax.vaccineName} (${new Date(vax.nextDueDate).toLocaleDateString()})`).join(' • ')}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-base font-semibold text-ink">Select Pet</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pets.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-sm text-[#6b6b6b] sm:col-span-2 xl:col-span-3">
              No pet profiles added yet. Create one to begin passport setup.
            </li>
          ) : (
            pets.map((pet) => (
              <li
                key={pet.id}
                className={`rounded-xl border p-3 text-sm ${selectedPetId === pet.id ? 'border-[#e76f51] bg-[#fff7f0]' : 'border-[#f2dfcf]'}`}
              >
                {photoUrls[pet.id] ? (
                  <Image
                    src={photoUrls[pet.id]}
                    alt={`${pet.name} photo`}
                    width={720}
                    height={360}
                    unoptimized
                    className="mb-3 h-36 w-full rounded-xl object-cover"
                  />
                ) : null}
                <div className="font-semibold text-ink">{pet.name}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6b6b6b]">
                  {pet.breed ? <span>Breed: {pet.breed}</span> : null}
                  {pet.age !== null ? <span>Age: {pet.age}</span> : null}
                  {pet.weight !== null ? <span>Weight: {pet.weight} kg</span> : null}
                  {pet.gender ? <span>Gender: {pet.gender}</span> : null}
                  {pet.allergies ? <span>Allergies: {pet.allergies}</span> : null}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => selectPetWithGuard(pet.id)}
                    className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-3 py-1.5 text-xs font-semibold text-ink"
                  >
                    Open Passport
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Pet Passport Editor</h2>
            <p className="mt-1 text-xs text-[#6b6b6b]" role="status" aria-live="polite">
              {saveStatus === 'saving' ? 'Saving to cloud…' : null}
              {saveStatus === 'saved' ? 'Saved successfully.' : null}
              {saveStatus === 'draft-saved' && lastDraftSavedAt ? `Draft auto-saved at ${new Date(lastDraftSavedAt).toLocaleTimeString()}` : null}
              {saveStatus === 'error' ? 'Last save failed. Please retry.' : null}
              {saveStatus === 'idle' ? 'Use Save Step to persist each section.' : null}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveDraftLocally}
              className="rounded-full border border-[#f2dfcf] px-4 py-2 text-xs font-semibold text-ink"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={saveCurrentStep}
              disabled={!selectedPetId || isPending}
              className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60"
            >
              {isPending ? 'Saving...' : 'Save Step'}
            </button>
            {saveStatus === 'error' ? (
              <button
                type="button"
                onClick={saveCurrentStep}
                disabled={!selectedPetId || isPending}
                className="rounded-full border border-[#f2dfcf] px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60"
              >
                Retry Save
              </button>
            ) : null}
            {Object.keys(fieldErrors).length > 0 ? (
              <button
                type="button"
                onClick={jumpToFirstError}
                className="rounded-full border border-[#f2dfcf] px-4 py-2 text-xs font-semibold text-ink"
              >
                Jump to First Error
              </button>
            ) : null}
          </div>
        </div>

        {saveStatus === 'saving' ? <div className="mt-3 h-1 w-full animate-pulse rounded-full bg-[#f2dfcf]" /> : null}

        <div className="mt-4 rounded-xl border border-[#f2dfcf] bg-[#fffdfa] p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-ink">Profile Completion</span>
            <span className="font-semibold text-[#6b6b6b]">{completionPercent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f2dfcf]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent} aria-label="Pet passport completion progress">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] transition-all duration-300 ease-out" style={{ width: `${completionPercent}%` }} />
          </div>
          <div className="mt-2 text-[11px] text-[#6b6b6b]">
            {missingSteps.length === 0 ? (
              <p>Everything is complete. Great job.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-1">
                <span>What’s missing:</span>
                {missingSteps.slice(0, 3).map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => jumpToStepWithHighlight(item.index)}
                    className="rounded-full border border-[#f2dfcf] bg-white px-2 py-0.5 text-[11px] font-semibold text-ink"
                  >
                    {item.label}
                  </button>
                ))}
                {missingSteps.length > 3 ? <span>…</span> : null}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {STEPS.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => jumpToStepWithHighlight(index)}
              aria-current={index === stepIndex ? 'step' : undefined}
              aria-label={`${step} ${stepCompletion[index] ? 'completed' : 'not completed'}`}
              title={stepCompletion[index] ? `${step} completed` : `${step} not completed`}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                index === stepIndex ? 'border-[#e76f51] bg-[#fff7f0] text-ink' : 'border-[#f2dfcf] text-[#6b6b6b]'
              }`}
            >
              {index + 1}. {step}{' '}
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  stepCompletion[index] ? 'bg-[#e76f51] text-white' : 'bg-[#f2dfcf] text-[#6b6b6b]'
                }`}
              >
                {stepCompletion[index] ? '✓' : '•'}
              </span>
            </button>
          ))}
        </div>
        {selectedPet ? <p className="mt-2 text-[11px] text-[#6b6b6b]">Shortcut: press Alt + ← / → to move between steps.</p> : null}

        {isLoadingProfile ? <p className="mt-4 text-sm text-[#6b6b6b]">Loading profile...</p> : null}

        {selectedPet && isLoadingProfile ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-xl border border-[#f2dfcf] bg-[#fff7f0]" />
            ))}
          </div>
        ) : null}

        {!selectedPet ? <p className="mt-4 text-sm text-[#6b6b6b]">Select a pet to start.</p> : null}

        {selectedPet && !isLoadingProfile ? (
          <div
            ref={editorRef}
            className={`mt-4 grid gap-3 rounded-2xl p-2 transition-shadow duration-500 sm:grid-cols-2 lg:grid-cols-3 ${
              highlightStepIndex === stepIndex ? 'ring-2 ring-[#f4a261]/70' : ''
            }`}
          >
            {stepIndex === 0 ? (
              <>
                <input value={draft.pet.name} onChange={(event) => updatePetField('name', event.target.value)} placeholder="Pet name *" aria-invalid={Boolean(getFieldError('pet.name'))} className={inputBaseClass('pet.name')} />
                <input value={draft.pet.breed} onChange={(event) => updatePetField('breed', event.target.value)} placeholder="Breed" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input type="number" min={0} max={40} value={draft.pet.age} onChange={(event) => updatePetField('age', event.target.value)} placeholder="Age" aria-invalid={Boolean(getFieldError('pet.age'))} className={inputBaseClass('pet.age')} />
                <input type="number" min={0} step={0.1} value={draft.pet.weight} onChange={(event) => updatePetField('weight', event.target.value)} placeholder="Weight (kg)" aria-invalid={Boolean(getFieldError('pet.weight'))} className={inputBaseClass('pet.weight')} />
                <input value={draft.pet.gender} onChange={(event) => updatePetField('gender', event.target.value)} placeholder="Gender" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.pet.dateOfBirth} onChange={(event) => updatePetField('dateOfBirth', event.target.value)} type="date" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.pet.microchipNumber} onChange={(event) => updatePetField('microchipNumber', event.target.value)} placeholder="Microchip Number" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.pet.color} onChange={(event) => updatePetField('color', event.target.value)} placeholder="Color" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.pet.sizeCategory} onChange={(event) => updatePetField('sizeCategory', event.target.value)} placeholder="Size Category" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.pet.energyLevel} onChange={(event) => updatePetField('energyLevel', event.target.value)} placeholder="Energy Level" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.pet.allergies} onChange={(event) => updatePetField('allergies', event.target.value)} placeholder="Allergies" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm lg:col-span-2" />
                <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm">
                  <input type="checkbox" checked={draft.pet.neuteredSpayed} onChange={(event) => updatePetField('neuteredSpayed', event.target.checked)} /> Neutered/Spayed
                </label>
                {getFieldError('pet.name') ? <p className="text-xs text-[#e76f51] sm:col-span-2 lg:col-span-3">{getFieldError('pet.name')}</p> : null}
                {getFieldError('pet.age') ? <p className="text-xs text-[#e76f51] sm:col-span-2 lg:col-span-3">{getFieldError('pet.age')}</p> : null}
                {getFieldError('pet.weight') ? <p className="text-xs text-[#e76f51] sm:col-span-2 lg:col-span-3">{getFieldError('pet.weight')}</p> : null}
              </>
            ) : null}

            {stepIndex === 1 ? (
              <>
                <select value={draft.pet.aggressionLevel} onChange={(event) => updatePetField('aggressionLevel', event.target.value)} className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm">
                  <option value="">Aggression level</option>
                  {AGGRESSION_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
                  ))}
                </select>
                <input type="number" min={0} value={draft.pet.biteIncidentsCount} onChange={(event) => updatePetField('biteIncidentsCount', event.target.value)} placeholder="Bite incidents count" aria-invalid={Boolean(getFieldError('pet.biteIncidentsCount'))} className={inputBaseClass('pet.biteIncidentsCount')} />
                <input value={draft.pet.socialWithDogs} onChange={(event) => updatePetField('socialWithDogs', event.target.value)} placeholder="Social with dogs" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.pet.socialWithCats} onChange={(event) => updatePetField('socialWithCats', event.target.value)} placeholder="Social with cats" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.pet.socialWithChildren} onChange={(event) => updatePetField('socialWithChildren', event.target.value)} placeholder="Social with children" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"><input type="checkbox" checked={draft.pet.isBiteHistory} onChange={(event) => updatePetField('isBiteHistory', event.target.checked)} /> Bite history</label>
                <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"><input type="checkbox" checked={draft.pet.houseTrained} onChange={(event) => updatePetField('houseTrained', event.target.checked)} /> House trained</label>
                <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"><input type="checkbox" checked={draft.pet.leashTrained} onChange={(event) => updatePetField('leashTrained', event.target.checked)} /> Leash trained</label>
                <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"><input type="checkbox" checked={draft.pet.crateTrained} onChange={(event) => updatePetField('crateTrained', event.target.checked)} /> Crate trained</label>
                <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"><input type="checkbox" checked={draft.pet.separationAnxiety} onChange={(event) => updatePetField('separationAnxiety', event.target.checked)} /> Separation anxiety</label>
                {getFieldError('pet.biteIncidentsCount') ? <p className="text-xs text-[#e76f51] sm:col-span-2 lg:col-span-3">{getFieldError('pet.biteIncidentsCount')}</p> : null}
              </>
            ) : null}

            {stepIndex === 2 ? (
              <div className="sm:col-span-2 lg:col-span-3 grid gap-3">
                {draft.vaccinations.map((row, index) => (
                  <div key={`${row.id ?? 'new'}-${index}`} className="grid gap-2 rounded-xl border border-[#f2dfcf] p-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input value={row.vaccineName} onChange={(event) => setDraft((current) => ({ ...current, vaccinations: current.vaccinations.map((item, itemIndex) => itemIndex === index ? { ...item, vaccineName: event.target.value } : item) }))} placeholder="Vaccine name *" aria-invalid={Boolean(getFieldError(`vaccinations.${index}.vaccineName`))} className={inputBaseClass(`vaccinations.${index}.vaccineName`)} />
                    <input value={row.brandName} onChange={(event) => setDraft((current) => ({ ...current, vaccinations: current.vaccinations.map((item, itemIndex) => itemIndex === index ? { ...item, brandName: event.target.value } : item) }))} placeholder="Brand name" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                    <input value={row.batchNumber} onChange={(event) => setDraft((current) => ({ ...current, vaccinations: current.vaccinations.map((item, itemIndex) => itemIndex === index ? { ...item, batchNumber: event.target.value } : item) }))} placeholder="Batch number" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                    <input value={row.doseNumber} type="number" min={1} onChange={(event) => setDraft((current) => ({ ...current, vaccinations: current.vaccinations.map((item, itemIndex) => itemIndex === index ? { ...item, doseNumber: event.target.value } : item) }))} placeholder="Dose number" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                    <input value={row.administeredDate} type="date" onChange={(event) => setDraft((current) => ({ ...current, vaccinations: current.vaccinations.map((item, itemIndex) => itemIndex === index ? { ...item, administeredDate: event.target.value } : item) }))} aria-invalid={Boolean(getFieldError(`vaccinations.${index}.administeredDate`))} className={inputBaseClass(`vaccinations.${index}.administeredDate`)} />
                    <input value={row.nextDueDate} type="date" onChange={(event) => setDraft((current) => ({ ...current, vaccinations: current.vaccinations.map((item, itemIndex) => itemIndex === index ? { ...item, nextDueDate: event.target.value } : item) }))} aria-invalid={Boolean(getFieldError(`vaccinations.${index}.nextDueDate`))} className={inputBaseClass(`vaccinations.${index}.nextDueDate`)} />
                    <input value={row.veterinarianName} onChange={(event) => setDraft((current) => ({ ...current, vaccinations: current.vaccinations.map((item, itemIndex) => itemIndex === index ? { ...item, veterinarianName: event.target.value } : item) }))} placeholder="Veterinarian name" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                    <input value={row.clinicName} onChange={(event) => setDraft((current) => ({ ...current, vaccinations: current.vaccinations.map((item, itemIndex) => itemIndex === index ? { ...item, clinicName: event.target.value } : item) }))} placeholder="Clinic name" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                    <input value={row.certificateUrl} onChange={(event) => setDraft((current) => ({ ...current, vaccinations: current.vaccinations.map((item, itemIndex) => itemIndex === index ? { ...item, certificateUrl: event.target.value } : item) }))} placeholder="Certificate URL" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm lg:col-span-2" />
                    <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm">
                      <input type="checkbox" checked={row.reminderEnabled} onChange={(event) => setDraft((current) => ({ ...current, vaccinations: current.vaccinations.map((item, itemIndex) => itemIndex === index ? { ...item, reminderEnabled: event.target.checked } : item) }))} /> Reminder enabled
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => removeVaccinationRow(index)} className="rounded-full border border-[#f2dfcf] px-3 py-2 text-xs font-semibold text-ink w-fit">Remove</button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            vaccinations: [...current.vaccinations, { ...row, id: undefined }],
                          }))
                        }
                        className="rounded-full border border-[#f2dfcf] px-3 py-2 text-xs font-semibold text-ink w-fit"
                      >
                        Duplicate
                      </button>
                    </div>
                    {getFieldError(`vaccinations.${index}.vaccineName`) ? <p className="text-xs text-[#e76f51] sm:col-span-2 lg:col-span-4">{getFieldError(`vaccinations.${index}.vaccineName`)}</p> : null}
                    {getFieldError(`vaccinations.${index}.administeredDate`) ? <p className="text-xs text-[#e76f51] sm:col-span-2 lg:col-span-4">{getFieldError(`vaccinations.${index}.administeredDate`)}</p> : null}
                    {getFieldError(`vaccinations.${index}.nextDueDate`) ? <p className="text-xs text-[#e76f51] sm:col-span-2 lg:col-span-4">{getFieldError(`vaccinations.${index}.nextDueDate`)}</p> : null}
                  </div>
                ))}
                <button type="button" onClick={() => setDraft((current) => ({ ...current, vaccinations: [...current.vaccinations, { vaccineName: '', brandName: '', batchNumber: '', doseNumber: '', administeredDate: '', nextDueDate: '', veterinarianName: '', clinicName: '', certificateUrl: '', reminderEnabled: true }] }))} className="w-fit rounded-full border border-[#f2dfcf] px-4 py-2 text-xs font-semibold text-ink">Add Vaccination</button>
              </div>
            ) : null}

            {stepIndex === 3 ? (
              <div className="sm:col-span-2 lg:col-span-3 grid gap-3">
                {draft.medicalRecords.map((row, index) => (
                  <div key={`${row.id ?? 'new'}-${index}`} className="grid gap-2 rounded-xl border border-[#f2dfcf] p-3 sm:grid-cols-2">
                    <input value={row.conditionName} onChange={(event) => setDraft((current) => ({ ...current, medicalRecords: current.medicalRecords.map((item, itemIndex) => itemIndex === index ? { ...item, conditionName: event.target.value } : item) }))} placeholder="Condition name *" aria-invalid={Boolean(getFieldError(`medicalRecords.${index}.conditionName`))} className={inputBaseClass(`medicalRecords.${index}.conditionName`)} />
                    <input value={row.diagnosisDate} type="date" onChange={(event) => setDraft((current) => ({ ...current, medicalRecords: current.medicalRecords.map((item, itemIndex) => itemIndex === index ? { ...item, diagnosisDate: event.target.value } : item) }))} className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                    <input value={row.medications} onChange={(event) => setDraft((current) => ({ ...current, medicalRecords: current.medicalRecords.map((item, itemIndex) => itemIndex === index ? { ...item, medications: event.target.value } : item) }))} placeholder="Medications" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                    <input value={row.vetName} onChange={(event) => setDraft((current) => ({ ...current, medicalRecords: current.medicalRecords.map((item, itemIndex) => itemIndex === index ? { ...item, vetName: event.target.value } : item) }))} placeholder="Vet name" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                    <input value={row.specialCareInstructions} onChange={(event) => setDraft((current) => ({ ...current, medicalRecords: current.medicalRecords.map((item, itemIndex) => itemIndex === index ? { ...item, specialCareInstructions: event.target.value } : item) }))} placeholder="Special care instructions" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm lg:col-span-2" />
                    <input value={row.documentUrl} onChange={(event) => setDraft((current) => ({ ...current, medicalRecords: current.medicalRecords.map((item, itemIndex) => itemIndex === index ? { ...item, documentUrl: event.target.value } : item) }))} placeholder="Document URL" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                    <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"><input type="checkbox" checked={row.ongoing} onChange={(event) => setDraft((current) => ({ ...current, medicalRecords: current.medicalRecords.map((item, itemIndex) => itemIndex === index ? { ...item, ongoing: event.target.checked } : item) }))} /> Ongoing condition</label>
                    <button type="button" onClick={() => removeMedicalRow(index)} className="rounded-full border border-[#f2dfcf] px-3 py-2 text-xs font-semibold text-ink w-fit">Remove</button>
                    {getFieldError(`medicalRecords.${index}.conditionName`) ? <p className="text-xs text-[#e76f51] sm:col-span-2">{getFieldError(`medicalRecords.${index}.conditionName`)}</p> : null}
                  </div>
                ))}
                <button type="button" onClick={() => setDraft((current) => ({ ...current, medicalRecords: [...current.medicalRecords, { conditionName: '', diagnosisDate: '', ongoing: false, medications: '', specialCareInstructions: '', vetName: '', documentUrl: '' }] }))} className="w-fit rounded-full border border-[#f2dfcf] px-4 py-2 text-xs font-semibold text-ink">Add Medical Record</button>
              </div>
            ) : null}

            {stepIndex === 4 ? (
              <>
                <input value={draft.feedingInfo.foodType} onChange={(event) => setDraft((current) => ({ ...current, feedingInfo: { ...current.feedingInfo, foodType: event.target.value } }))} placeholder="Food type" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.feedingInfo.brandName} onChange={(event) => setDraft((current) => ({ ...current, feedingInfo: { ...current.feedingInfo, brandName: event.target.value } }))} placeholder="Brand name" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.feedingInfo.feedingSchedule} onChange={(event) => setDraft((current) => ({ ...current, feedingInfo: { ...current.feedingInfo, feedingSchedule: event.target.value } }))} placeholder="Feeding schedule" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm lg:col-span-2" />
                <input value={draft.feedingInfo.foodAllergies} onChange={(event) => setDraft((current) => ({ ...current, feedingInfo: { ...current.feedingInfo, foodAllergies: event.target.value } }))} placeholder="Food allergies" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.feedingInfo.specialDietNotes} onChange={(event) => setDraft((current) => ({ ...current, feedingInfo: { ...current.feedingInfo, specialDietNotes: event.target.value } }))} placeholder="Special diet notes" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm lg:col-span-2" />
                <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"><input type="checkbox" checked={draft.feedingInfo.treatsAllowed} onChange={(event) => setDraft((current) => ({ ...current, feedingInfo: { ...current.feedingInfo, treatsAllowed: event.target.checked } }))} /> Treats allowed</label>
              </>
            ) : null}

            {stepIndex === 5 ? (
              <>
                <input value={draft.groomingInfo.coatType} onChange={(event) => setDraft((current) => ({ ...current, groomingInfo: { ...current.groomingInfo, coatType: event.target.value } }))} placeholder="Coat type" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.groomingInfo.groomingFrequency} onChange={(event) => setDraft((current) => ({ ...current, groomingInfo: { ...current.groomingInfo, groomingFrequency: event.target.value } }))} placeholder="Grooming frequency" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.groomingInfo.lastGroomingDate} type="date" onChange={(event) => setDraft((current) => ({ ...current, groomingInfo: { ...current.groomingInfo, lastGroomingDate: event.target.value } }))} className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input value={draft.groomingInfo.nailTrimFrequency} onChange={(event) => setDraft((current) => ({ ...current, groomingInfo: { ...current.groomingInfo, nailTrimFrequency: event.target.value } }))} placeholder="Nail trim frequency" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <label className="flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"><input type="checkbox" checked={draft.groomingInfo.mattingProne} onChange={(event) => setDraft((current) => ({ ...current, groomingInfo: { ...current.groomingInfo, mattingProne: event.target.checked } }))} /> Matting prone</label>
              </>
            ) : null}

            {stepIndex === 6 ? (
              <>
                <input value={draft.emergencyInfo.emergencyContactName} onChange={(event) => setDraft((current) => ({ ...current, emergencyInfo: { ...current.emergencyInfo, emergencyContactName: event.target.value } }))} placeholder="Emergency contact name" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input
                  value={draft.emergencyInfo.emergencyContactPhone}
                  onChange={(event) => setDraft((current) => ({ ...current, emergencyInfo: { ...current.emergencyInfo, emergencyContactPhone: event.target.value } }))}
                  onBlur={(event) =>
                    setDraft((current) => ({
                      ...current,
                      emergencyInfo: { ...current.emergencyInfo, emergencyContactPhone: normalizePhoneInput(event.target.value) },
                    }))
                  }
                  placeholder="Emergency contact phone"
                  aria-invalid={Boolean(getFieldError('emergencyInfo.emergencyContactPhone'))}
                  className={inputBaseClass('emergencyInfo.emergencyContactPhone')}
                />
                <input value={draft.emergencyInfo.preferredVetClinic} onChange={(event) => setDraft((current) => ({ ...current, emergencyInfo: { ...current.emergencyInfo, preferredVetClinic: event.target.value } }))} placeholder="Preferred vet clinic" className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm" />
                <input
                  value={draft.emergencyInfo.preferredVetPhone}
                  onChange={(event) => setDraft((current) => ({ ...current, emergencyInfo: { ...current.emergencyInfo, preferredVetPhone: event.target.value } }))}
                  onBlur={(event) =>
                    setDraft((current) => ({
                      ...current,
                      emergencyInfo: { ...current.emergencyInfo, preferredVetPhone: normalizePhoneInput(event.target.value) },
                    }))
                  }
                  placeholder="Preferred vet phone"
                  aria-invalid={Boolean(getFieldError('emergencyInfo.preferredVetPhone'))}
                  className={inputBaseClass('emergencyInfo.preferredVetPhone')}
                />
                {getFieldError('emergencyInfo.emergencyContactPhone') ? <p className="text-xs text-[#e76f51] sm:col-span-2 lg:col-span-3">{getFieldError('emergencyInfo.emergencyContactPhone')}</p> : null}
                {getFieldError('emergencyInfo.preferredVetPhone') ? <p className="text-xs text-[#e76f51] sm:col-span-2 lg:col-span-3">{getFieldError('emergencyInfo.preferredVetPhone')}</p> : null}
              </>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => jumpToStepWithHighlight(Math.max(0, stepIndex - 1))}
            disabled={stepIndex === 0}
            className="rounded-full border border-[#f2dfcf] px-4 py-2 text-xs font-semibold text-ink disabled:opacity-50"
          >
            Previous
          </button>
          <div className="text-xs text-[#6b6b6b]">Step {stepIndex + 1} of {STEPS.length}</div>
          <button
            type="button"
            onClick={() => jumpToStepWithHighlight(Math.min(STEPS.length - 1, stepIndex + 1))}
            disabled={stepIndex === STEPS.length - 1}
            className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink disabled:opacity-50"
          >
            Next
          </button>
        </div>

        <p className="mt-3 text-[11px] text-[#6b6b6b]">Keyboard shortcuts: <span className="font-semibold">Alt + →</span> next step, <span className="font-semibold">Alt + ←</span> previous step.</p>
      </section>
    </div>
  );
}
