import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import {
  addMedicalRecord,
  addVaccination,
  deleteMedicalRecord,
  deleteVaccination,
  getFullPetProfile,
  logPassportAuditEvent,
  updateMedicalRecord,
  updatePet,
  updateVaccination,
  upsertEmergencyInfo,
  upsertFeedingInfo,
  upsertGroomingInfo,
} from '@/lib/pets/service';
import { AGGRESSION_LEVELS } from '@/lib/pets/types';
import { normalizeOptionalString, validateEmergencyPhones, validateVaccinationPatch } from '@/lib/pets/passport-validation';

const vaccinationUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  _delete: z.literal(false).optional(),
  vaccineName: z.string().min(1).max(150),
  brandName: z.string().max(150).nullable().optional(),
  batchNumber: z.string().max(120).nullable().optional(),
  doseNumber: z.number().int().positive().nullable().optional(),
  administeredDate: z.string().date(),
  nextDueDate: z.string().date().nullable().optional(),
  veterinarianName: z.string().max(150).nullable().optional(),
  clinicName: z.string().max(150).nullable().optional(),
  certificateUrl: z.string().max(500).nullable().optional(),
  reminderEnabled: z.boolean().optional(),
});

const vaccinationDeleteSchema = z.object({
  id: z.string().uuid(),
  _delete: z.literal(true),
});

const medicalUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  _delete: z.literal(false).optional(),
  conditionName: z.string().min(1).max(150),
  diagnosisDate: z.string().date().nullable().optional(),
  ongoing: z.boolean().optional(),
  medications: z.string().max(500).nullable().optional(),
  specialCareInstructions: z.string().max(800).nullable().optional(),
  vetName: z.string().max(150).nullable().optional(),
  documentUrl: z.string().max(500).nullable().optional(),
});

const medicalDeleteSchema = z.object({
  id: z.string().uuid(),
  _delete: z.literal(true),
});

const passportUpdateSchema = z.object({
  stepIndex: z.number().int().min(0).max(6).optional(),
  pet: z
    .object({
      name: z.string().min(1).max(120).optional(),
      breed: z.string().max(120).nullable().optional(),
      age: z.number().int().min(0).nullable().optional(),
      weight: z.number().min(0).nullable().optional(),
      gender: z.string().max(20).nullable().optional(),
      allergies: z.string().max(500).nullable().optional(),
      photoUrl: z.string().max(500).nullable().optional(),
      dateOfBirth: z.string().date().nullable().optional(),
      microchipNumber: z.string().max(120).nullable().optional(),
      neuteredSpayed: z.boolean().optional(),
      color: z.string().max(80).nullable().optional(),
      sizeCategory: z.string().max(60).nullable().optional(),
      energyLevel: z.string().max(60).nullable().optional(),
      aggressionLevel: z.enum(AGGRESSION_LEVELS).nullable().optional(),
      isBiteHistory: z.boolean().optional(),
      biteIncidentsCount: z.number().int().min(0).optional(),
      houseTrained: z.boolean().optional(),
      leashTrained: z.boolean().optional(),
      crateTrained: z.boolean().optional(),
      socialWithDogs: z.string().max(200).nullable().optional(),
      socialWithCats: z.string().max(200).nullable().optional(),
      socialWithChildren: z.string().max(200).nullable().optional(),
      separationAnxiety: z.boolean().optional(),
    })
    .optional(),
  vaccinations: z.array(z.union([vaccinationUpsertSchema, vaccinationDeleteSchema])).optional(),
  medicalRecords: z.array(z.union([medicalUpsertSchema, medicalDeleteSchema])).optional(),
  feedingInfo: z
    .object({
      foodType: z.string().max(120).nullable().optional(),
      brandName: z.string().max(150).nullable().optional(),
      feedingSchedule: z.string().max(300).nullable().optional(),
      foodAllergies: z.string().max(300).nullable().optional(),
      specialDietNotes: z.string().max(600).nullable().optional(),
      treatsAllowed: z.boolean().optional(),
    })
    .optional(),
  groomingInfo: z
    .object({
      coatType: z.string().max(100).nullable().optional(),
      mattingProne: z.boolean().optional(),
      groomingFrequency: z.string().max(150).nullable().optional(),
      lastGroomingDate: z.string().date().nullable().optional(),
      nailTrimFrequency: z.string().max(150).nullable().optional(),
    })
    .optional(),
  emergencyInfo: z
    .object({
      emergencyContactName: z.string().max(150).nullable().optional(),
      emergencyContactPhone: z.string().max(40).nullable().optional(),
      preferredVetClinic: z.string().max(150).nullable().optional(),
      preferredVetPhone: z.string().max(40).nullable().optional(),
    })
    .optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const petId = Number(id);

  if (!Number.isFinite(petId) || petId <= 0) {
    return NextResponse.json({ error: 'Invalid pet ID' }, { status: 400 });
  }

  try {
    const profile = await getFullPetProfile(supabase, user.id, petId);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const petId = Number(id);

  if (!Number.isFinite(petId) || petId <= 0) {
    return NextResponse.json({ error: 'Invalid pet ID' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = passportUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const data = parsed.data;

    if (data.vaccinations) {
      const vaccinationError = validateVaccinationPatch(data.vaccinations);
      if (vaccinationError) {
        return NextResponse.json({ error: vaccinationError }, { status: 400 });
      }
    }

    if (data.emergencyInfo) {
      const phoneError = validateEmergencyPhones(data.emergencyInfo);
      if (phoneError) {
        return NextResponse.json({ error: phoneError }, { status: 400 });
      }
    }

    if (data.pet) {
      await updatePet(supabase, user.id, petId, {
        name: data.pet.name?.trim(),
        breed: normalizeOptionalString(data.pet.breed),
        age: data.pet.age,
        weight: data.pet.weight,
        gender: normalizeOptionalString(data.pet.gender),
        allergies: normalizeOptionalString(data.pet.allergies),
        photo_url: normalizeOptionalString(data.pet.photoUrl),
        date_of_birth: data.pet.dateOfBirth,
        microchip_number: normalizeOptionalString(data.pet.microchipNumber),
        neutered_spayed: data.pet.neuteredSpayed,
        color: normalizeOptionalString(data.pet.color),
        size_category: normalizeOptionalString(data.pet.sizeCategory),
        energy_level: normalizeOptionalString(data.pet.energyLevel),
        aggression_level: data.pet.aggressionLevel,
        is_bite_history: data.pet.isBiteHistory,
        bite_incidents_count: data.pet.biteIncidentsCount,
        house_trained: data.pet.houseTrained,
        leash_trained: data.pet.leashTrained,
        crate_trained: data.pet.crateTrained,
        social_with_dogs: normalizeOptionalString(data.pet.socialWithDogs),
        social_with_cats: normalizeOptionalString(data.pet.socialWithCats),
        social_with_children: normalizeOptionalString(data.pet.socialWithChildren),
        separation_anxiety: data.pet.separationAnxiety,
      });
    }

    if (data.vaccinations) {
      for (const vaccination of data.vaccinations) {
        if (vaccination._delete && vaccination.id) {
          await deleteVaccination(supabase, user.id, vaccination.id);
          continue;
        }

        if (vaccination.id) {
          await updateVaccination(supabase, user.id, vaccination.id, {
            vaccine_name: vaccination.vaccineName.trim(),
            brand_name: normalizeOptionalString(vaccination.brandName),
            batch_number: normalizeOptionalString(vaccination.batchNumber),
            dose_number: vaccination.doseNumber,
            administered_date: vaccination.administeredDate,
            next_due_date: vaccination.nextDueDate,
            veterinarian_name: normalizeOptionalString(vaccination.veterinarianName),
            clinic_name: normalizeOptionalString(vaccination.clinicName),
            certificate_url: normalizeOptionalString(vaccination.certificateUrl),
            reminder_enabled: vaccination.reminderEnabled,
          });
        } else {
          await addVaccination(supabase, user.id, {
            pet_id: petId,
            vaccine_name: vaccination.vaccineName.trim(),
            brand_name: normalizeOptionalString(vaccination.brandName),
            batch_number: normalizeOptionalString(vaccination.batchNumber),
            dose_number: vaccination.doseNumber,
            administered_date: vaccination.administeredDate,
            next_due_date: vaccination.nextDueDate,
            veterinarian_name: normalizeOptionalString(vaccination.veterinarianName),
            clinic_name: normalizeOptionalString(vaccination.clinicName),
            certificate_url: normalizeOptionalString(vaccination.certificateUrl),
            reminder_enabled: vaccination.reminderEnabled,
          });
        }
      }
    }

    if (data.medicalRecords) {
      for (const medical of data.medicalRecords) {
        if (medical._delete && medical.id) {
          await deleteMedicalRecord(supabase, user.id, medical.id);
          continue;
        }

        if (medical.id) {
          await updateMedicalRecord(supabase, user.id, medical.id, {
            condition_name: medical.conditionName.trim(),
            diagnosis_date: medical.diagnosisDate,
            ongoing: medical.ongoing,
            medications: normalizeOptionalString(medical.medications),
            special_care_instructions: normalizeOptionalString(medical.specialCareInstructions),
            vet_name: normalizeOptionalString(medical.vetName),
            document_url: normalizeOptionalString(medical.documentUrl),
          });
          continue;
        }

        await addMedicalRecord(supabase, user.id, {
          pet_id: petId,
          condition_name: medical.conditionName.trim(),
          diagnosis_date: medical.diagnosisDate,
          ongoing: medical.ongoing,
          medications: normalizeOptionalString(medical.medications),
          special_care_instructions: normalizeOptionalString(medical.specialCareInstructions),
          vet_name: normalizeOptionalString(medical.vetName),
          document_url: normalizeOptionalString(medical.documentUrl),
        });
      }
    }

    if (data.feedingInfo) {
      await upsertFeedingInfo(supabase, user.id, {
        pet_id: petId,
        food_type: normalizeOptionalString(data.feedingInfo.foodType),
        brand_name: normalizeOptionalString(data.feedingInfo.brandName),
        feeding_schedule: normalizeOptionalString(data.feedingInfo.feedingSchedule),
        food_allergies: normalizeOptionalString(data.feedingInfo.foodAllergies),
        special_diet_notes: normalizeOptionalString(data.feedingInfo.specialDietNotes),
        treats_allowed: data.feedingInfo.treatsAllowed,
      });
    }

    if (data.groomingInfo) {
      await upsertGroomingInfo(supabase, user.id, {
        pet_id: petId,
        coat_type: normalizeOptionalString(data.groomingInfo.coatType),
        matting_prone: data.groomingInfo.mattingProne,
        grooming_frequency: normalizeOptionalString(data.groomingInfo.groomingFrequency),
        last_grooming_date: data.groomingInfo.lastGroomingDate,
        nail_trim_frequency: normalizeOptionalString(data.groomingInfo.nailTrimFrequency),
      });
    }

    if (data.emergencyInfo) {
      await upsertEmergencyInfo(supabase, user.id, {
        pet_id: petId,
        emergency_contact_name: normalizeOptionalString(data.emergencyInfo.emergencyContactName),
        emergency_contact_phone: normalizeOptionalString(data.emergencyInfo.emergencyContactPhone),
        preferred_vet_clinic: normalizeOptionalString(data.emergencyInfo.preferredVetClinic),
        preferred_vet_phone: normalizeOptionalString(data.emergencyInfo.preferredVetPhone),
      });
    }

    await logPassportAuditEvent(supabase, user.id, {
      pet_id: petId,
      action: 'passport.patch',
      step_index: data.stepIndex ?? null,
      metadata: {
        sectionsUpdated: {
          pet: Boolean(data.pet),
          vaccinations: Boolean(data.vaccinations),
          medicalRecords: Boolean(data.medicalRecords),
          feedingInfo: Boolean(data.feedingInfo),
          groomingInfo: Boolean(data.groomingInfo),
          emergencyInfo: Boolean(data.emergencyInfo),
        },
      },
    });

    const profile = await getFullPetProfile(supabase, user.id, petId);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update pet passport';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
