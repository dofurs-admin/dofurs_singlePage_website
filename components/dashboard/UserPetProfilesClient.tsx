'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/components/ui/ToastProvider';
import { uploadCompressedImage } from '@/lib/storage/upload-client';
import { calculateAgeFromDOB } from '@/lib/utils/date';
import Modal from '@/components/ui/Modal';
import PetHeroHeader from './PetHeroHeader';
import PetStepper from './PetStepper';
import SectionCard from './SectionCard';
import FormField from './FormField';
import VaccinationCard from './VaccinationCard';
import MedicalRecordCard from './MedicalRecordCard';
import StickyFooter from './StickyFooter';
import EmptyState from './EmptyState';
import SegmentedControl from './SegmentedControl';
import ProgressRing from './ProgressRing';
import PetPassportViewModal from './PetPassportViewModal';

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
  dateOfBirth: string;
  gender: string;
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

const ENERGY_LEVEL_OPTIONS = ['very_low', 'low', 'moderate', 'high', 'very_high'];
const SIZE_CATEGORY_OPTIONS = ['toy', 'small', 'medium', 'large', 'giant'];
const CAPITALIZE_PET_FIELDS: ReadonlyArray<keyof PassportDraft['pet']> = [
  'name',
  'breed',
  'gender',
  'allergies',
  'microchipNumber',
  'color',
  'sizeCategory',
  'socialWithDogs',
  'socialWithCats',
  'socialWithChildren',
];

function capitalizeFirstLetter(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toTitleCaseLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .map((part) => capitalizeFirstLetter(part))
    .join(' ');
}

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

function calculateCompletionFromDraft(draftData: PassportDraft): number {
  const age = draftData.pet.age.trim() ? Number.parseInt(draftData.pet.age, 10) : null;
  const weight = draftData.pet.weight.trim() ? Number.parseFloat(draftData.pet.weight) : null;
  const basicComplete =
    draftData.pet.name.trim().length > 0 &&
    (age === null || (Number.isFinite(age) && age >= 0 && age <= 40)) &&
    (weight === null || (Number.isFinite(weight) && weight > 0 && weight <= 300));

  const biteCount = draftData.pet.biteIncidentsCount.trim() ? Number.parseInt(draftData.pet.biteIncidentsCount, 10) : 0;
  const behaviorTouched =
    draftData.pet.aggressionLevel.trim().length > 0 ||
    draftData.pet.socialWithDogs.trim().length > 0 ||
    draftData.pet.socialWithCats.trim().length > 0 ||
    draftData.pet.socialWithChildren.trim().length > 0 ||
    draftData.pet.isBiteHistory ||
    draftData.pet.houseTrained ||
    draftData.pet.leashTrained ||
    draftData.pet.crateTrained ||
    draftData.pet.separationAnxiety;
  const behaviorComplete = behaviorTouched && Number.isFinite(biteCount) && biteCount >= 0;

  const vaccinationsTouched = draftData.vaccinations.length > 0;
  const vaccinationsComplete =
    vaccinationsTouched &&
    draftData.vaccinations.every((row) => {
      if (!row.vaccineName.trim() || !row.administeredDate) {
        return false;
      }
      if (row.nextDueDate && row.nextDueDate < row.administeredDate) {
        return false;
      }
      return true;
    });

  const medicalTouched = draftData.medicalRecords.length > 0;
  const medicalComplete = medicalTouched && draftData.medicalRecords.every((row) => row.conditionName.trim().length > 0);

  const feedingComplete =
    draftData.feedingInfo.foodType.trim().length > 0 ||
    draftData.feedingInfo.brandName.trim().length > 0 ||
    draftData.feedingInfo.feedingSchedule.trim().length > 0 ||
    draftData.feedingInfo.foodAllergies.trim().length > 0 ||
    draftData.feedingInfo.specialDietNotes.trim().length > 0 ||
    draftData.feedingInfo.treatsAllowed !== true;

  const groomingComplete =
    draftData.groomingInfo.coatType.trim().length > 0 ||
    draftData.groomingInfo.groomingFrequency.trim().length > 0 ||
    draftData.groomingInfo.lastGroomingDate.trim().length > 0 ||
    draftData.groomingInfo.nailTrimFrequency.trim().length > 0 ||
    draftData.groomingInfo.mattingProne;

  const phonePattern = /^[0-9+()\-\s]{7,20}$/;
  const emergencyPhone = draftData.emergencyInfo.emergencyContactPhone.trim();
  const preferredPhone = draftData.emergencyInfo.preferredVetPhone.trim();
  const emergencyTouched =
    draftData.emergencyInfo.emergencyContactName.trim().length > 0 ||
    emergencyPhone.length > 0 ||
    draftData.emergencyInfo.preferredVetClinic.trim().length > 0 ||
    preferredPhone.length > 0;
  const emergencyComplete =
    emergencyTouched &&
    (!emergencyPhone || phonePattern.test(emergencyPhone)) &&
    (!preferredPhone || phonePattern.test(preferredPhone));

  const stepCompletions = [basicComplete, behaviorComplete, vaccinationsComplete, medicalComplete, feedingComplete, groomingComplete, emergencyComplete];
  const completedCount = stepCompletions.filter(Boolean).length;
  return Math.round((completedCount / 7) * 100);
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

function preferNonEmpty(current: string, fallback: string) {
  return current.trim().length > 0 ? current : fallback;
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
  const [petCompletions, setPetCompletions] = useState<Record<number, number>>({});
  const [expandedVaccinations, setExpandedVaccinations] = useState<Record<number, boolean>>({});
  const [expandedMedicalRecords, setExpandedMedicalRecords] = useState<Record<number, boolean>>({});
  const [selectedPetId, setSelectedPetId] = useState<number | null>(initialPets[0]?.id ?? null);
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<PassportDraft>(emptyDraft());
  const [newPet, setNewPet] = useState<PetCreateForm>({ name: '', breed: '', dateOfBirth: '', gender: '' });
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
  const [showCreatePetModal, setShowCreatePetModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewModalData, setViewModalData] = useState<FullPetProfile | null>(null);
  const [isLoadingViewData, setIsLoadingViewData] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const selectedPet = useMemo(() => pets.find((pet) => pet.id === selectedPetId) ?? null, [pets, selectedPetId]);

  const draftStorageKey = selectedPetId ? `pet-passport-draft-${selectedPetId}` : null;

  const stepCompletion = useMemo(() => {
    // Calculate age from dateOfBirth instead of using draft.pet.age
    const age = draft.pet.dateOfBirth ? calculateAgeFromDOB(draft.pet.dateOfBirth) : null;
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
    let active = true;

    async function hydrateCompletions() {
      const entries = await Promise.all(
        pets.map(async (pet): Promise<[number, number]> => {
          try {
            const response = await fetch(`/api/user/pets/${pet.id}/passport`);
            if (!response.ok) {
              return [pet.id, 0];
            }

            const payload = (await response.json().catch(() => null)) as { profile?: FullPetProfile } | null;
            
            if (!payload?.profile) {
              return [pet.id, 0];
            }

            const profileDraft = mapProfileToDraft(payload.profile);
            const completion = calculateCompletionFromDraft(profileDraft);
            return [pet.id, completion];
          } catch {
            return [pet.id, 0];
          }
        }),
      );

      if (!active) {
        return;
      }

      const next: Record<number, number> = {};
      entries.forEach(([id, completion]) => {
        next[id] = completion;
      });
      setPetCompletions(next);
    }

    hydrateCompletions();

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

      const profileDraft = mapProfileToDraft(payload.profile);
      const baseDraft = {
        ...profileDraft,
        pet: {
          ...profileDraft.pet,
          name: preferNonEmpty(profileDraft.pet.name, selectedPet?.name ?? ''),
          breed: preferNonEmpty(profileDraft.pet.breed, selectedPet?.breed ?? ''),
          age: preferNonEmpty(profileDraft.pet.age, selectedPet?.age !== null && selectedPet?.age !== undefined ? String(selectedPet.age) : ''),
          gender: preferNonEmpty(profileDraft.pet.gender, selectedPet?.gender ?? ''),
        },
      };
      const localDraftRaw = window.localStorage.getItem(`pet-passport-draft-${selectedPetId}`);

      if (localDraftRaw) {
        const parsedLocal = JSON.parse(localDraftRaw) as PassportDraft;
        const mergedDraft = {
          ...baseDraft,
          ...parsedLocal,
          pet: {
            ...baseDraft.pet,
            ...parsedLocal.pet,
            name: preferNonEmpty(parsedLocal.pet?.name ?? '', baseDraft.pet.name),
            breed: preferNonEmpty(parsedLocal.pet?.breed ?? '', baseDraft.pet.breed),
            age: preferNonEmpty(parsedLocal.pet?.age ?? '', baseDraft.pet.age),
            gender: preferNonEmpty(parsedLocal.pet?.gender ?? '', baseDraft.pet.gender),
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
  }, [selectedPetId, selectedPet, showToast]);

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

  function persistDraftLocally(showSuccessToast = false) {
    if (!draftStorageKey) {
      return;
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    setLastDraftSavedAt(new Date().toISOString());
    setSaveStatus('draft-saved');
    if (showSuccessToast) {
      showToast('Draft saved locally.', 'success');
    }
  }

  function saveDraftLocally() {
    persistDraftLocally(true);
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

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        persistDraftLocally(false);
        const nextStep = Math.min(STEPS.length - 1, stepIndex + 1);
        setStepIndex(nextStep);
        setHighlightStepIndex(nextStep);
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        persistDraftLocally(false);
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
  }, [selectedPetId, stepIndex, draftStorageKey, draft]);

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
      const dateOfBirth = draft.pet.dateOfBirth.trim() ? draft.pet.dateOfBirth : null;
      const weight = draft.pet.weight.trim() ? Number.parseFloat(draft.pet.weight) : null;

      if (dateOfBirth) {
        const age = calculateAgeFromDOB(dateOfBirth);
        if (age === null || age < 0 || age > 150) {
          nextErrors['pet.dateOfBirth'] = 'Date of birth is invalid.';
        }
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
      setSelectedPetId(payload.pet.id);
      setNewPet({ name: '', breed: '', dateOfBirth: '', gender: '' });
      setNewPetPhotoFile(null);
      setShowCreatePetModal(false);
      showToast('Pet profile created.', 'success');
    });
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
        
        // If the deleted pet was selected, switch to another pet or clear selection
        if (selectedPetId === petId) {
          const remainingPets = pets.filter((pet) => pet.id !== petId);
          if (remainingPets.length > 0) {
            setSelectedPetId(remainingPets[0].id);
          } else {
            setSelectedPetId(null);
          }
        }
        
        showToast(`${petName}'s profile deleted successfully.`, 'success');
      } catch {
        showToast('An error occurred while deleting the pet profile.', 'error');
      }
    });
  }

  async function openViewModal(petId: number) {
    setIsLoadingViewData(true);
    setShowViewModal(true);
    setViewModalData(null);

    try {
      const response = await fetch(`/api/user/pets/${petId}/passport`);
      if (!response.ok) {
        showToast('Unable to load pet passport.', 'error');
        setShowViewModal(false);
        return;
      }

      const data = await response.json();
      const profile = data.profile as FullPetProfile;
      setViewModalData(profile);
    } catch {
      showToast('Error loading pet data.', 'error');
      setShowViewModal(false);
    } finally {
      setIsLoadingViewData(false);
    }
  }

  function openEditModal(petId: number) {
    if (selectedPetId !== petId) {
      if (!canLeaveCurrentContext()) {
        return;
      }
      setSelectedPetId(petId);
      setStepIndex(0);
      setHighlightStepIndex(0);
    }
    setIsEditMode(true);
    setShowEditModal(true);
  }

  function closeEditModal() {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Close without saving?')) {
        return;
      }
    }
    setShowEditModal(false);
    setIsEditMode(false);
  }

  function buildStepPayload() {
    const basePayload = { stepIndex };

    if (stepIndex === 0) {
      // Calculate age from dateOfBirth if present
      const dateOfBirth = draft.pet.dateOfBirth || null;
      const calculatedAge = dateOfBirth ? calculateAgeFromDOB(dateOfBirth) : null;
      
      return {
        ...basePayload,
        pet: {
          name: draft.pet.name.trim(),
          breed: draft.pet.breed.trim() || null,
          dateOfBirth: dateOfBirth,
          age: calculatedAge,
          weight: draft.pet.weight.trim() ? Number.parseFloat(draft.pet.weight) : null,
          gender: draft.pet.gender.trim() || null,
          allergies: draft.pet.allergies.trim() || null,
          photoUrl: draft.pet.photoUrl.trim() || null,
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

  function saveCurrentStepOnly() {
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
                  age: calculateAgeFromDOB(draft.pet.dateOfBirth) ?? pet.age,
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
    const normalizedValue =
      typeof value === 'string' && CAPITALIZE_PET_FIELDS.includes(key)
        ? (capitalizeFirstLetter(value) as PassportDraft['pet'][K])
        : value;

    setDraft((current) => ({
      ...current,
      pet: {
        ...current.pet,
        [key]: normalizedValue,
      },
    }));
  }

  function updateNewPetField<K extends keyof PetCreateForm>(key: K, value: PetCreateForm[K], capitalize = false) {
    const normalizedValue =
      capitalize && typeof value === 'string' ? (capitalizeFirstLetter(value) as PetCreateForm[K]) : value;

    setNewPet((current) => ({
      ...current,
      [key]: normalizedValue,
    }));
  }

  function updateVaccinationField<K extends keyof VaccinationDraft>(index: number, key: K, value: VaccinationDraft[K], capitalize = false) {
    const normalizedValue =
      capitalize && typeof value === 'string' ? (capitalizeFirstLetter(value) as VaccinationDraft[K]) : value;

    setDraft((current) => ({
      ...current,
      vaccinations: current.vaccinations.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: normalizedValue } : item)),
    }));
  }

  function updateMedicalField<K extends keyof MedicalDraft>(index: number, key: K, value: MedicalDraft[K], capitalize = false) {
    const normalizedValue =
      capitalize && typeof value === 'string' ? (capitalizeFirstLetter(value) as MedicalDraft[K]) : value;

    setDraft((current) => ({
      ...current,
      medicalRecords: current.medicalRecords.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: normalizedValue } : item)),
    }));
  }

  function updateFeedingField<K extends keyof PassportDraft['feedingInfo']>(key: K, value: PassportDraft['feedingInfo'][K], capitalize = false) {
    const normalizedValue =
      capitalize && typeof value === 'string' ? (capitalizeFirstLetter(value) as PassportDraft['feedingInfo'][K]) : value;

    setDraft((current) => ({
      ...current,
      feedingInfo: {
        ...current.feedingInfo,
        [key]: normalizedValue,
      },
    }));
  }

  function updateGroomingField<K extends keyof PassportDraft['groomingInfo']>(key: K, value: PassportDraft['groomingInfo'][K], capitalize = false) {
    const normalizedValue =
      capitalize && typeof value === 'string' ? (capitalizeFirstLetter(value) as PassportDraft['groomingInfo'][K]) : value;

    setDraft((current) => ({
      ...current,
      groomingInfo: {
        ...current.groomingInfo,
        [key]: normalizedValue,
      },
    }));
  }

  function updateEmergencyField<K extends keyof PassportDraft['emergencyInfo']>(key: K, value: PassportDraft['emergencyInfo'][K], capitalize = false) {
    const normalizedValue =
      capitalize && typeof value === 'string' ? (capitalizeFirstLetter(value) as PassportDraft['emergencyInfo'][K]) : value;

    setDraft((current) => ({
      ...current,
      emergencyInfo: {
        ...current.emergencyInfo,
        [key]: normalizedValue,
      },
    }));
  }

  function jumpToStepWithHighlight(targetStepIndex: number) {
    setStepIndex(targetStepIndex);
    setHighlightStepIndex(targetStepIndex);
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goToNextStepWithAutoDraftSave() {
    persistDraftLocally(false);
    jumpToStepWithHighlight(Math.min(STEPS.length - 1, stepIndex + 1));
  }

  function goToPreviousStepWithAutoDraftSave() {
    persistDraftLocally(false);
    jumpToStepWithHighlight(Math.max(0, stepIndex - 1));
  }

  function handleNextOrComplete() {
    const isLastStep = stepIndex === STEPS.length - 1;

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
        const calculatedAge = draft.pet.dateOfBirth ? calculateAgeFromDOB(draft.pet.dateOfBirth) : null;
        setPets((current) =>
          current.map((pet) =>
            pet.id === selectedPetId
              ? {
                  ...pet,
                  name: draft.pet.name.trim() || pet.name,
                  breed: draft.pet.breed.trim() || null,
                  age: calculatedAge,
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
      
      if (isLastStep) {
        showToast('Passport completed! All sections saved successfully.', 'success');
        setStepIndex(0);
        setHighlightStepIndex(0);
        setIsEditMode(false);
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        showToast('Step saved.', 'success');
        const nextStep = Math.min(STEPS.length - 1, stepIndex + 1);
        setStepIndex(nextStep);
        setHighlightStepIndex(nextStep);
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function jumpToFirstError() {
    const firstErrorPath = Object.keys(fieldErrors)[0];
    if (!firstErrorPath) {
      return;
    }

    jumpToStepWithHighlight(stepIndexFromFieldPath(firstErrorPath));
  }

  function vaccinationStatus(nextDueDate: string) {
    if (!nextDueDate) {
      return 'up-to-date' as const;
    }

    const today = new Date();
    const dueDate = new Date(nextDueDate);
    const diffInDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays < 0) {
      return 'overdue' as const;
    }
    if (diffInDays <= 14) {
      return 'due-soon' as const;
    }
    return 'up-to-date' as const;
  }

  const stepDescriptions = [
    'Capture your pet’s core identity and profile details.',
    'Document temperament and social compatibility preferences.',
    'Track immunization history and due dates clearly.',
    'Maintain conditions, treatments, and care notes.',
    'Define food preferences, schedule, and restrictions.',
    'Record coat care and routine grooming needs.',
    'Store emergency contacts and preferred vet details.',
  ] as const;

  return (
    <div className="space-y-10 pb-32">
      <section className="rounded-2xl border border-neutral-200/60 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-950">Pet Passport</h1>
            <p className="mt-1 text-sm text-neutral-600">Guided profile setup for medical, behavior, care, and emergency details.</p>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-neutral-200/70 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1">
            Back to Dashboard
          </Link>
        </div>
      </section>

      {pets.length === 0 ? (
        <SectionCard title="Create a New Pet" description="Start with essentials. You can complete passport sections after creating the profile.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormField
              label="Pet name"
              value={newPet.name}
              onChange={(event) => updateNewPetField('name', event.target.value, true)}
              placeholder="Pet name *"
            />
            <SegmentedControl
              label="Pet type"
              options={[
                { label: 'Dog', value: 'Dog', icon: '🐶' },
                { label: 'Cat', value: 'Cat', icon: '🐱' },
              ]}
              value={newPet.breed}
              onChange={(value) => setNewPet((current) => ({ ...current, breed: value }))}
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
              onChange={(event) => updateNewPetField('gender', event.target.value, true)}
              placeholder="Gender"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-xl border border-neutral-200/60 px-4 py-2 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm">
              {newPetPhotoFile ? `Photo selected: ${newPetPhotoFile.name}` : 'Upload pet photo'}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => setNewPetPhotoFile(event.target.files?.[0] ?? null)} />
            </label>
            <button
              type="button"
              onClick={createPetProfile}
              disabled={isPending}
              className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 focus-visible:ring-offset-1 disabled:opacity-60"
            >
              {isPending ? 'Creating...' : 'Create & Open Passport'}
            </button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Select Pet" description="Choose which pet profile to continue editing.">
        {pets.length === 0 ? (
          <EmptyState
            icon="🐾"
            title="No pets yet"
            description="Create your first pet profile above to begin the passport experience."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pets.map((pet) => {
              const completion = petCompletions[pet.id] ?? 0;
              const completionStatus = completion === 100 ? 'complete' : completion >= 70 ? 'high' : completion >= 40 ? 'medium' : 'low';
              const statusConfig = {
                complete: { label: 'Complete', color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
                high: { label: 'Almost there', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
                medium: { label: 'In progress', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
                low: { label: 'Getting started', color: 'text-neutral-600', bgColor: 'bg-neutral-50', borderColor: 'border-neutral-200' }
              };
              const status = statusConfig[completionStatus];
              
              return (
                <li
                  key={pet.id}
                  className="group rounded-2xl border border-neutral-200/60 bg-white overflow-hidden shadow-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Pet Photo */}
                  <div className="relative h-36 overflow-hidden">
                    {photoUrls[pet.id] ? (
                      <Image
                        src={photoUrls[pet.id]}
                        alt={`${pet.name} photo`}
                        width={720}
                        height={360}
                        unoptimized
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 text-4xl">🐾</div>
                    )}
                    {/* Passport Completion Badge */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                      <div className={`flex items-center gap-2 rounded-lg ${status.bgColor} ${status.borderColor} border backdrop-blur-sm px-2.5 py-1.5`}>
                        <div className="relative">
                          <ProgressRing percentage={completion} radius={14} circumference={88} strokeWidth={2} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-medium text-neutral-600 uppercase tracking-wide">Passport</span>
                          <span className={`text-xs font-bold ${status.color} leading-none`}>{status.label}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pet Details */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-neutral-950 text-lg leading-tight">{pet.name}</h3>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600">
                          {pet.breed ? <span>{pet.breed}</span> : null}
                          {pet.age !== null ? <span>{pet.age}y</span> : null}
                          {pet.weight !== null ? <span>{pet.weight}kg</span> : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-2xl font-bold text-neutral-900">{completion}%</span>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wide">Complete</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3 space-y-1.5">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ease-out ${
                            completionStatus === 'complete' ? 'bg-emerald-500' :
                            completionStatus === 'high' ? 'bg-blue-500' :
                            completionStatus === 'medium' ? 'bg-amber-500' :
                            'bg-neutral-400'
                          }`}
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openViewModal(pet.id)}
                        className="flex-1 rounded-xl border border-emerald-200/70 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-1"
                      >
                        👁️ View
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(pet.id)}
                        className="flex-1 rounded-xl border border-blue-200/70 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-1"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePetProfile(pet.id, pet.name)}
                        disabled={isPending}
                        className="rounded-xl border border-red-200/70 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:ring-offset-1 disabled:opacity-60"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
            <li
              className="flex items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-4 shadow-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-coral"
            >
              <button
                type="button"
                onClick={() => setShowCreatePetModal(true)}
                className="flex flex-col items-center gap-3"
              >
                <div className="text-4xl font-semibold text-neutral-400">+</div>
                <span className="text-xs font-semibold text-neutral-600">Add Pet</span>
              </button>
            </li>
          </ul>
        )}
      </SectionCard>

      <Modal
        isOpen={showCreatePetModal}
        onClose={() => setShowCreatePetModal(false)}
        title="Create a New Pet"
        description="Start with essentials. You can complete passport sections after creating the profile."
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Pet name"
              value={newPet.name}
              onChange={(event) => updateNewPetField('name', event.target.value, true)}
              placeholder="Pet name *"
            />
            <SegmentedControl
              label="Pet type"
              options={[
                { label: 'Dog', value: 'Dog', icon: '🐶' },
                { label: 'Cat', value: 'Cat', icon: '🐱' },
              ]}
              value={newPet.breed}
              onChange={(value) => setNewPet((current) => ({ ...current, breed: value }))}
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
              onChange={(event) => updateNewPetField('gender', event.target.value, true)}
              placeholder="Gender"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-xl border border-neutral-200/60 px-4 py-2 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm">
              {newPetPhotoFile ? `Photo selected: ${newPetPhotoFile.name}` : 'Upload pet photo'}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => setNewPetPhotoFile(event.target.files?.[0] ?? null)} />
            </label>
            <button
              type="button"
              onClick={createPetProfile}
              disabled={isPending}
              className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 focus-visible:ring-offset-1 disabled:opacity-60"
            >
              {isPending ? 'Creating...' : 'Create & Open Passport'}
            </button>
          </div>
        </div>
      </Modal>

      {selectedPet && showEditModal ? (
        <Modal isOpen={showEditModal} onClose={closeEditModal} title={`Edit ${selectedPet.name}'s Passport`} size="xl">
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
            <PetHeroHeader
              petName={selectedPet.name}
              breed={selectedPet.breed}
              age={selectedPet.age}
              photoUrl={photoUrls[selectedPet.id]}
              completionPercent={completionPercent}
              lastSavedAt={lastDraftSavedAt}
            />

            <section className="rounded-2xl border border-neutral-200/60 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-neutral-900">Completion Checklist</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {STEPS.map((step, index) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => jumpToStepWithHighlight(index)}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1 ${stepCompletion[index] ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800' : 'border-neutral-200/70 bg-white text-neutral-600'}`}
                >
                  <span>{step}</span>
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${stepCompletion[index] ? 'bg-emerald-500 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                    {stepCompletion[index] ? '✓' : '•'}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <SectionCard title="Pet Passport Editor" description={stepDescriptions[stepIndex]} highlight={highlightStepIndex === stepIndex}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-neutral-600" role="status" aria-live="polite">
                {saveStatus === 'saving' ? 'Saving to cloud…' : null}
                {saveStatus === 'saved' ? 'Saved successfully.' : null}
                {saveStatus === 'draft-saved' && lastDraftSavedAt ? `Draft auto-saved at ${new Date(lastDraftSavedAt).toLocaleTimeString()}` : null}
                {saveStatus === 'error' ? 'Last save failed. Please retry.' : null}
                {saveStatus === 'idle' ? 'Use Save Step to persist each section.' : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {!isEditMode ? (
                  <button
                    type="button"
                    onClick={() => setIsEditMode(true)}
                    className="rounded-xl border border-neutral-200/70 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditMode(false)}
                    className="rounded-xl border border-neutral-200/70 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveDraftLocally}
                  disabled={!isEditMode}
                  className="rounded-xl border border-neutral-200/70 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1 disabled:opacity-60"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={saveCurrentStepOnly}
                  disabled={!selectedPetId || isPending || !isEditMode}
                  className="rounded-xl bg-coral px-3 py-1.5 text-xs font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 focus-visible:ring-offset-1 disabled:opacity-60"
                >
                  {isPending ? 'Saving...' : 'Save Step'}
                </button>
                {Object.keys(fieldErrors).length > 0 ? (
                  <button
                    type="button"
                    onClick={jumpToFirstError}
                    disabled={!isEditMode}
                    className="rounded-xl border border-neutral-200/70 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1 disabled:opacity-60"
                  >
                    Jump to Error
                  </button>
                ) : null}
              </div>
            </div>

            {isEditMode ? (
              <PetStepper
                steps={[...STEPS]}
                currentStep={stepIndex}
                completedSteps={stepCompletion}
                onStepClick={jumpToStepWithHighlight}
              />
            ) : null}

            {isLoadingProfile ? <p className="text-sm text-neutral-600">Loading profile...</p> : null}
            {!selectedPet ? <p className="text-sm text-neutral-600">Select a pet to start.</p> : null}
            {!isEditMode && selectedPet && !isLoadingProfile ? <p className="text-sm text-neutral-600">Click &quot;Edit&quot; to update this pet&apos;s passport information.</p> : null}

            {selectedPet && !isLoadingProfile && isEditMode ? (
              <div
                key={`editor-step-${stepIndex}`}
                ref={editorRef}
                className="grid gap-4 rounded-2xl border border-neutral-200/60 bg-neutral-50/40 p-4 opacity-100 transition-all duration-150 ease-out sm:grid-cols-2 lg:grid-cols-3"
              >
                {stepIndex === 0 ? (
                  <>
                    <FormField label="Pet name" disabled={!isEditMode} value={draft.pet.name} onChange={(event) => updatePetField('name', event.target.value)} error={getFieldError('pet.name') ?? undefined} />
                    <FormField label="Breed" disabled={!isEditMode} value={draft.pet.breed} onChange={(event) => updatePetField('breed', event.target.value)} />
                    <FormField label="Date of birth" disabled={!isEditMode} type="date" value={draft.pet.dateOfBirth} onChange={(event) => updatePetField('dateOfBirth', event.target.value)} />
                    <FormField label="Age" type="number" disabled={true} min={0} max={40} value={draft.pet.dateOfBirth ? String(calculateAgeFromDOB(draft.pet.dateOfBirth) ?? '') : ''} onChange={() => {}} />
                    <FormField label="Weight (kg)" disabled={!isEditMode} type="number" min={0} step={0.1} value={draft.pet.weight} onChange={(event) => updatePetField('weight', event.target.value)} error={getFieldError('pet.weight') ?? undefined} />
                    <FormField label="Gender" disabled={!isEditMode} value={draft.pet.gender} onChange={(event) => updatePetField('gender', event.target.value)} />
                    <FormField label="Microchip number" disabled={!isEditMode} value={draft.pet.microchipNumber} onChange={(event) => updatePetField('microchipNumber', event.target.value)} />
                    <FormField label="Color" disabled={!isEditMode} value={draft.pet.color} onChange={(event) => updatePetField('color', event.target.value)} />
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-900">Size category</label>
                      <select
                        disabled={!isEditMode}
                        value={draft.pet.sizeCategory}
                        onChange={(event) => updatePetField('sizeCategory', event.target.value)}
                        className="w-full rounded-xl border border-neutral-200/60 bg-white px-4 py-3 text-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="">Select size</option>
                        {SIZE_CATEGORY_OPTIONS.map((option) => (
                          <option key={option} value={option}>{toTitleCaseLabel(option)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-900">Energy level</label>
                      <select
                        disabled={!isEditMode}
                        value={draft.pet.energyLevel}
                        onChange={(event) => updatePetField('energyLevel', event.target.value)}
                        className="w-full rounded-xl border border-neutral-200/60 bg-white px-4 py-3 text-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="">Select level</option>
                        {ENERGY_LEVEL_OPTIONS.map((option) => (
                          <option key={option} value={option}>{toTitleCaseLabel(option)}</option>
                        ))}
                      </select>
                    </div>
                    <FormField label="Allergies" disabled={!isEditMode} value={draft.pet.allergies} onChange={(event) => updatePetField('allergies', event.target.value)} className="lg:col-span-2" />
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed" style={{pointerEvents: !isEditMode ? 'none' : 'auto', opacity: !isEditMode ? 0.6 : 1}}><input type="checkbox" disabled={!isEditMode} checked={draft.pet.neuteredSpayed} onChange={(event) => updatePetField('neuteredSpayed', event.target.checked)} /> Neutered/Spayed</label>
                  </>
                ) : null}

                {stepIndex === 1 ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-900">Aggression level</label>
                      <select disabled={!isEditMode} value={draft.pet.aggressionLevel} onChange={(event) => updatePetField('aggressionLevel', event.target.value)} className="w-full rounded-xl border border-neutral-200/60 bg-white px-4 py-3 text-sm transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 disabled:cursor-not-allowed">
                        <option value="">Select level</option>
                        {AGGRESSION_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <FormField label="Bite incidents count" disabled={!isEditMode} type="number" min={0} value={draft.pet.biteIncidentsCount} onChange={(event) => updatePetField('biteIncidentsCount', event.target.value)} error={getFieldError('pet.biteIncidentsCount') ?? undefined} />
                    <FormField label="Social with dogs" disabled={!isEditMode} value={draft.pet.socialWithDogs} onChange={(event) => updatePetField('socialWithDogs', event.target.value)} />
                    <FormField label="Social with cats" disabled={!isEditMode} value={draft.pet.socialWithCats} onChange={(event) => updatePetField('socialWithCats', event.target.value)} />
                    <FormField label="Social with children" disabled={!isEditMode} value={draft.pet.socialWithChildren} onChange={(event) => updatePetField('socialWithChildren', event.target.value)} />
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed" style={{pointerEvents: !isEditMode ? 'none' : 'auto', opacity: !isEditMode ? 0.6 : 1}}><input type="checkbox" disabled={!isEditMode} checked={draft.pet.isBiteHistory} onChange={(event) => updatePetField('isBiteHistory', event.target.checked)} /> Bite history</label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed" style={{pointerEvents: !isEditMode ? 'none' : 'auto', opacity: !isEditMode ? 0.6 : 1}}><input type="checkbox" disabled={!isEditMode} checked={draft.pet.houseTrained} onChange={(event) => updatePetField('houseTrained', event.target.checked)} /> House trained</label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed" style={{pointerEvents: !isEditMode ? 'none' : 'auto', opacity: !isEditMode ? 0.6 : 1}}><input type="checkbox" disabled={!isEditMode} checked={draft.pet.leashTrained} onChange={(event) => updatePetField('leashTrained', event.target.checked)} /> Leash trained</label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed" style={{pointerEvents: !isEditMode ? 'none' : 'auto', opacity: !isEditMode ? 0.6 : 1}}><input type="checkbox" disabled={!isEditMode} checked={draft.pet.crateTrained} onChange={(event) => updatePetField('crateTrained', event.target.checked)} /> Crate trained</label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed" style={{pointerEvents: !isEditMode ? 'none' : 'auto', opacity: !isEditMode ? 0.6 : 1}}><input type="checkbox" disabled={!isEditMode} checked={draft.pet.separationAnxiety} onChange={(event) => updatePetField('separationAnxiety', event.target.checked)} /> Separation anxiety</label>
                  </>
                ) : null}

                {stepIndex === 2 ? (
                  <div className="space-y-3 sm:col-span-2 lg:col-span-3">
                    {draft.vaccinations.length === 0 ? (
                      <EmptyState icon="💉" title="No vaccination records" description="Add the first vaccine record to start tracking due dates." />
                    ) : null}

                    {draft.vaccinations.map((row, index) => (
                      <VaccinationCard
                        key={`${row.id ?? 'new'}-${index}`}
                        vaccineName={row.vaccineName || 'Untitled vaccine'}
                        brandName={row.brandName}
                        administeredDate={row.administeredDate || new Date().toISOString().slice(0, 10)}
                        nextDueDate={row.nextDueDate || undefined}
                        status={vaccinationStatus(row.nextDueDate)}
                        isExpanded={Boolean(expandedVaccinations[index])}
                        onToggleExpand={() => setExpandedVaccinations((current) => ({ ...current, [index]: !current[index] }))}
                        onDelete={() => removeVaccinationRow(index)}
                        onEdit={() => setExpandedVaccinations((current) => ({ ...current, [index]: true }))}
                      >
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <FormField label="Vaccine name" disabled={!isEditMode} value={row.vaccineName} onChange={(event) => updateVaccinationField(index, 'vaccineName', event.target.value, true)} error={getFieldError(`vaccinations.${index}.vaccineName`) ?? undefined} />
                          <FormField label="Brand" disabled={!isEditMode} value={row.brandName} onChange={(event) => updateVaccinationField(index, 'brandName', event.target.value, true)} />
                          <FormField label="Batch" disabled={!isEditMode} value={row.batchNumber} onChange={(event) => updateVaccinationField(index, 'batchNumber', event.target.value, true)} />
                          <FormField label="Dose number" disabled={!isEditMode} type="number" min={1} value={row.doseNumber} onChange={(event) => updateVaccinationField(index, 'doseNumber', event.target.value)} />
                          <FormField label="Administered" disabled={!isEditMode} type="date" value={row.administeredDate} onChange={(event) => updateVaccinationField(index, 'administeredDate', event.target.value)} error={getFieldError(`vaccinations.${index}.administeredDate`) ?? undefined} />
                          <FormField label="Next due" disabled={!isEditMode} type="date" value={row.nextDueDate} onChange={(event) => updateVaccinationField(index, 'nextDueDate', event.target.value)} error={getFieldError(`vaccinations.${index}.nextDueDate`) ?? undefined} />
                          <FormField label="Veterinarian" disabled={!isEditMode} value={row.veterinarianName} onChange={(event) => updateVaccinationField(index, 'veterinarianName', event.target.value, true)} />
                          <FormField label="Clinic" disabled={!isEditMode} value={row.clinicName} onChange={(event) => updateVaccinationField(index, 'clinicName', event.target.value, true)} />
                          <FormField label="Certificate URL" disabled={!isEditMode} value={row.certificateUrl} onChange={(event) => setDraft((current) => ({ ...current, vaccinations: current.vaccinations.map((item, itemIndex) => itemIndex === index ? { ...item, certificateUrl: event.target.value } : item) }))} className="lg:col-span-2" />
                          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed" style={{pointerEvents: !isEditMode ? 'none' : 'auto', opacity: !isEditMode ? 0.6 : 1}}><input type="checkbox" disabled={!isEditMode} checked={row.reminderEnabled} onChange={(event) => updateVaccinationField(index, 'reminderEnabled', event.target.checked)} /> Reminder enabled</label>
                          <button type="button" disabled={!isEditMode} onClick={() => setDraft((current) => ({ ...current, vaccinations: [...current.vaccinations, { ...row, id: undefined }] }))} className="rounded-xl border border-neutral-200/70 px-3 py-2 text-xs font-semibold text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1 disabled:opacity-60">Duplicate</button>
                        </div>
                      </VaccinationCard>
                    ))}

                    <button type="button" disabled={!isEditMode} onClick={() => setDraft((current) => ({ ...current, vaccinations: [...current.vaccinations, { vaccineName: '', brandName: '', batchNumber: '', doseNumber: '', administeredDate: '', nextDueDate: '', veterinarianName: '', clinicName: '', certificateUrl: '', reminderEnabled: true }] }))} className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 focus-visible:ring-offset-1 disabled:opacity-60">Add Vaccination</button>
                  </div>
                ) : null}

                {stepIndex === 3 ? (
                  <div className="space-y-3 sm:col-span-2 lg:col-span-3">
                    {draft.medicalRecords.length === 0 ? (
                      <EmptyState icon="🩺" title="No medical records" description="Add a condition record to keep treatment history complete." />
                    ) : null}

                    {draft.medicalRecords.map((row, index) => (
                      <MedicalRecordCard
                        key={`${row.id ?? 'new'}-${index}`}
                        conditionName={row.conditionName || 'Untitled condition'}
                        ongoing={row.ongoing}
                        diagnosisDate={row.diagnosisDate || undefined}
                        medications={row.medications || undefined}
                        vetName={row.vetName || undefined}
                        isExpanded={Boolean(expandedMedicalRecords[index])}
                        onToggleExpand={() => setExpandedMedicalRecords((current) => ({ ...current, [index]: !current[index] }))}
                        onDelete={() => removeMedicalRow(index)}
                        onEdit={() => setExpandedMedicalRecords((current) => ({ ...current, [index]: true }))}
                      >
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <FormField label="Condition name" disabled={!isEditMode} value={row.conditionName} onChange={(event) => updateMedicalField(index, 'conditionName', event.target.value, true)} error={getFieldError(`medicalRecords.${index}.conditionName`) ?? undefined} />
                          <FormField label="Diagnosis date" disabled={!isEditMode} type="date" value={row.diagnosisDate} onChange={(event) => updateMedicalField(index, 'diagnosisDate', event.target.value)} />
                          <FormField label="Medications" disabled={!isEditMode} value={row.medications} onChange={(event) => updateMedicalField(index, 'medications', event.target.value, true)} />
                          <FormField label="Vet name" disabled={!isEditMode} value={row.vetName} onChange={(event) => updateMedicalField(index, 'vetName', event.target.value, true)} />
                          <FormField label="Special care" disabled={!isEditMode} value={row.specialCareInstructions} onChange={(event) => updateMedicalField(index, 'specialCareInstructions', event.target.value, true)} className="lg:col-span-2" />
                          <FormField label="Document URL" disabled={!isEditMode} value={row.documentUrl} onChange={(event) => setDraft((current) => ({ ...current, medicalRecords: current.medicalRecords.map((item, itemIndex) => itemIndex === index ? { ...item, documentUrl: event.target.value } : item) }))} />
                          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed" style={{pointerEvents: !isEditMode ? 'none' : 'auto', opacity: !isEditMode ? 0.6 : 1}}><input type="checkbox" disabled={!isEditMode} checked={row.ongoing} onChange={(event) => updateMedicalField(index, 'ongoing', event.target.checked)} /> Ongoing condition</label>
                        </div>
                      </MedicalRecordCard>
                    ))}

                    <button type="button" disabled={!isEditMode} onClick={() => setDraft((current) => ({ ...current, medicalRecords: [...current.medicalRecords, { conditionName: '', diagnosisDate: '', ongoing: false, medications: '', specialCareInstructions: '', vetName: '', documentUrl: '' }] }))} className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 focus-visible:ring-offset-1 disabled:opacity-60">Add Medical Record</button>
                  </div>
                ) : null}

                {stepIndex === 4 ? (
                  <>
                    <FormField label="Food type" disabled={!isEditMode} value={draft.feedingInfo.foodType} onChange={(event) => updateFeedingField('foodType', event.target.value, true)} />
                    <FormField label="Brand name" disabled={!isEditMode} value={draft.feedingInfo.brandName} onChange={(event) => updateFeedingField('brandName', event.target.value, true)} />
                    <FormField label="Feeding schedule" disabled={!isEditMode} value={draft.feedingInfo.feedingSchedule} onChange={(event) => updateFeedingField('feedingSchedule', event.target.value, true)} className="lg:col-span-2" />
                    <FormField label="Food allergies" disabled={!isEditMode} value={draft.feedingInfo.foodAllergies} onChange={(event) => updateFeedingField('foodAllergies', event.target.value, true)} />
                    <FormField label="Special diet notes" disabled={!isEditMode} value={draft.feedingInfo.specialDietNotes} onChange={(event) => updateFeedingField('specialDietNotes', event.target.value, true)} className="lg:col-span-2" />
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed" style={{pointerEvents: !isEditMode ? 'none' : 'auto', opacity: !isEditMode ? 0.6 : 1}}><input type="checkbox" disabled={!isEditMode} checked={draft.feedingInfo.treatsAllowed} onChange={(event) => setDraft((current) => ({ ...current, feedingInfo: { ...current.feedingInfo, treatsAllowed: event.target.checked } }))} /> Treats allowed</label>
                  </>
                ) : null}

                {stepIndex === 5 ? (
                  <>
                    <FormField label="Coat type" disabled={!isEditMode} value={draft.groomingInfo.coatType} onChange={(event) => updateGroomingField('coatType', event.target.value, true)} />
                    <FormField label="Grooming frequency" disabled={!isEditMode} value={draft.groomingInfo.groomingFrequency} onChange={(event) => updateGroomingField('groomingFrequency', event.target.value, true)} />
                    <FormField label="Last grooming" disabled={!isEditMode} type="date" value={draft.groomingInfo.lastGroomingDate} onChange={(event) => setDraft((current) => ({ ...current, groomingInfo: { ...current.groomingInfo, lastGroomingDate: event.target.value } }))} />
                    <FormField label="Nail trim frequency" disabled={!isEditMode} value={draft.groomingInfo.nailTrimFrequency} onChange={(event) => updateGroomingField('nailTrimFrequency', event.target.value, true)} />
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/60 bg-white px-3 py-3 text-sm text-neutral-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed" style={{pointerEvents: !isEditMode ? 'none' : 'auto', opacity: !isEditMode ? 0.6 : 1}}><input type="checkbox" disabled={!isEditMode} checked={draft.groomingInfo.mattingProne} onChange={(event) => setDraft((current) => ({ ...current, groomingInfo: { ...current.groomingInfo, mattingProne: event.target.checked } }))} /> Matting prone</label>
                  </>
                ) : null}

                {stepIndex === 6 ? (
                  <>
                    <FormField label="Emergency contact name" disabled={!isEditMode} value={draft.emergencyInfo.emergencyContactName} onChange={(event) => updateEmergencyField('emergencyContactName', event.target.value, true)} />
                    <FormField
                      label="Emergency contact phone"
                      disabled={!isEditMode}
                      value={draft.emergencyInfo.emergencyContactPhone}
                      onChange={(event) => setDraft((current) => ({ ...current, emergencyInfo: { ...current.emergencyInfo, emergencyContactPhone: event.target.value } }))}
                      onBlur={(event) => setDraft((current) => ({ ...current, emergencyInfo: { ...current.emergencyInfo, emergencyContactPhone: normalizePhoneInput(event.target.value) } }))}
                      error={getFieldError('emergencyInfo.emergencyContactPhone') ?? undefined}
                    />
                    <FormField label="Preferred vet clinic" disabled={!isEditMode} value={draft.emergencyInfo.preferredVetClinic} onChange={(event) => updateEmergencyField('preferredVetClinic', event.target.value, true)} />
                    <FormField
                      label="Preferred vet phone"
                      disabled={!isEditMode}
                      value={draft.emergencyInfo.preferredVetPhone}
                      onChange={(event) => setDraft((current) => ({ ...current, emergencyInfo: { ...current.emergencyInfo, preferredVetPhone: event.target.value } }))}
                      onBlur={(event) => setDraft((current) => ({ ...current, emergencyInfo: { ...current.emergencyInfo, preferredVetPhone: normalizePhoneInput(event.target.value) } }))}
                      error={getFieldError('emergencyInfo.preferredVetPhone') ?? undefined}
                    />
                  </>
                ) : null}
              </div>
            ) : null}

          </SectionCard>

          <StickyFooter
            isEnabled={Boolean(selectedPet) && isEditMode}
            stepNumber={stepIndex + 1}
            totalSteps={STEPS.length}
            savingStatus={saveStatus === 'draft-saved' ? 'saved' : saveStatus}
            draftSaved={saveStatus === 'draft-saved'}
            isLoading={isPending}
            onSaveDraft={saveDraftLocally}
            onPrevious={goToPreviousStepWithAutoDraftSave}
            onNextOrSave={handleNextOrComplete}
            isPreviousDisabled={stepIndex === 0}
            isNextDisabled={false}
          />
          </div>
        </Modal>
      ) : null}

      {/* View Passport Modal */}
      <PetPassportViewModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        data={viewModalData}
        photoUrl={viewModalData ? photoUrls[viewModalData.pet.id] : null}
        isLoading={isLoadingViewData}
      />
    </div>
  );
}
