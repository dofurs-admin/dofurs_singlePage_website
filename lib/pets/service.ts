import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AddMedicalRecordInput,
  AddVaccinationInput,
  CreatePetInput,
  FullPetProfile,
  PassportAuditEventInput,
  Pet,
  PetEmergencyInfo,
  PetFeedingInfo,
  PetGroomingInfo,
  PetMedicalRecord,
  PetReminderPreferences,
  PetVaccination,
  UpcomingVaccinationGroup,
  UpdateMedicalRecordInput,
  UpdatePetInput,
  UpsertReminderPreferencesInput,
  UpdateVaccinationInput,
  UpsertEmergencyInfoInput,
  UpsertFeedingInfoInput,
  UpsertGroomingInfoInput,
} from './types';

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function createPet(supabase: SupabaseClient, userId: string, input: CreatePetInput) {
  const { data, error } = await supabase
    .from('pets')
    .insert({
      user_id: userId,
      ...input,
    })
    .select('*')
    .single<Pet>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updatePet(supabase: SupabaseClient, userId: string, petId: number, input: UpdatePetInput) {
  const { data, error } = await supabase
    .from('pets')
    .update(input)
    .eq('id', petId)
    .eq('user_id', userId)
    .select('*')
    .single<Pet>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getPetById(supabase: SupabaseClient, userId: string, petId: number) {
  const { data, error } = await supabase.from('pets').select('*').eq('id', petId).eq('user_id', userId).single<Pet>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getFullPetProfile(supabase: SupabaseClient, userId: string, petId: number): Promise<FullPetProfile> {
  const { data, error } = await supabase
    .from('pets')
    .select(
      `
      *,
      pet_vaccinations(*),
      pet_medical_records(*),
      pet_feeding_info(*),
      pet_grooming_info(*),
      pet_emergency_info(*)
    `,
    )
    .eq('id', petId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Pet not found');
  }

  const feedingRaw = Array.isArray(data.pet_feeding_info) ? data.pet_feeding_info[0] : data.pet_feeding_info;
  const groomingRaw = Array.isArray(data.pet_grooming_info) ? data.pet_grooming_info[0] : data.pet_grooming_info;
  const emergencyRaw = Array.isArray(data.pet_emergency_info) ? data.pet_emergency_info[0] : data.pet_emergency_info;

  return {
    pet: {
      ...(data as Pet),
    },
    vaccinations: ((data.pet_vaccinations ?? []) as PetVaccination[]).sort((a, b) =>
      a.administered_date > b.administered_date ? -1 : 1,
    ),
    medicalRecords: ((data.pet_medical_records ?? []) as PetMedicalRecord[]).sort((a, b) =>
      a.created_at > b.created_at ? -1 : 1,
    ),
    feedingInfo: (feedingRaw as PetFeedingInfo | null) ?? null,
    groomingInfo: (groomingRaw as PetGroomingInfo | null) ?? null,
    emergencyInfo: (emergencyRaw as PetEmergencyInfo | null) ?? null,
  };
}

export async function addVaccination(supabase: SupabaseClient, userId: string, input: AddVaccinationInput) {
  await getPetById(supabase, userId, input.pet_id);

  const { data, error } = await supabase
    .from('pet_vaccinations')
    .insert({
      ...input,
      reminder_enabled: input.reminder_enabled ?? true,
    })
    .select('*')
    .single<PetVaccination>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateVaccination(
  supabase: SupabaseClient,
  userId: string,
  vaccinationId: string,
  input: UpdateVaccinationInput,
) {
  const ownership = await supabase
    .from('pet_vaccinations')
    .select('id, pets!inner(user_id)')
    .eq('id', vaccinationId)
    .eq('pets.user_id', userId)
    .single();

  if (ownership.error || !ownership.data) {
    throw ownership.error ?? new Error('Vaccination not found');
  }

  const { data, error } = await supabase
    .from('pet_vaccinations')
    .update(input)
    .eq('id', vaccinationId)
    .select('*')
    .single<PetVaccination>();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteVaccination(supabase: SupabaseClient, userId: string, vaccinationId: string) {
  const ownership = await supabase
    .from('pet_vaccinations')
    .select('id, pets!inner(user_id)')
    .eq('id', vaccinationId)
    .eq('pets.user_id', userId)
    .single();

  if (ownership.error || !ownership.data) {
    throw ownership.error ?? new Error('Vaccination not found');
  }

  const { error } = await supabase.from('pet_vaccinations').delete().eq('id', vaccinationId);

  if (error) {
    throw error;
  }
}

export async function addMedicalRecord(supabase: SupabaseClient, userId: string, input: AddMedicalRecordInput) {
  await getPetById(supabase, userId, input.pet_id);

  const { data, error } = await supabase
    .from('pet_medical_records')
    .insert({
      ...input,
      ongoing: input.ongoing ?? false,
    })
    .select('*')
    .single<PetMedicalRecord>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateMedicalRecord(
  supabase: SupabaseClient,
  userId: string,
  medicalRecordId: string,
  input: UpdateMedicalRecordInput,
) {
  const ownership = await supabase
    .from('pet_medical_records')
    .select('id, pets!inner(user_id)')
    .eq('id', medicalRecordId)
    .eq('pets.user_id', userId)
    .single();

  if (ownership.error || !ownership.data) {
    throw ownership.error ?? new Error('Medical record not found');
  }

  const { data, error } = await supabase
    .from('pet_medical_records')
    .update(input)
    .eq('id', medicalRecordId)
    .select('*')
    .single<PetMedicalRecord>();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteMedicalRecord(supabase: SupabaseClient, userId: string, medicalRecordId: string) {
  const ownership = await supabase
    .from('pet_medical_records')
    .select('id, pets!inner(user_id)')
    .eq('id', medicalRecordId)
    .eq('pets.user_id', userId)
    .single();

  if (ownership.error || !ownership.data) {
    throw ownership.error ?? new Error('Medical record not found');
  }

  const { error } = await supabase.from('pet_medical_records').delete().eq('id', medicalRecordId);

  if (error) {
    throw error;
  }
}

export async function upsertFeedingInfo(supabase: SupabaseClient, userId: string, input: UpsertFeedingInfoInput) {
  await getPetById(supabase, userId, input.pet_id);

  const { data, error } = await supabase
    .from('pet_feeding_info')
    .upsert(
      {
        ...input,
        treats_allowed: input.treats_allowed ?? true,
      },
      { onConflict: 'pet_id' },
    )
    .select('*')
    .single<PetFeedingInfo>();

  if (error) {
    throw error;
  }

  return data;
}

export async function upsertGroomingInfo(supabase: SupabaseClient, userId: string, input: UpsertGroomingInfoInput) {
  await getPetById(supabase, userId, input.pet_id);

  const { data, error } = await supabase
    .from('pet_grooming_info')
    .upsert(
      {
        ...input,
        matting_prone: input.matting_prone ?? false,
      },
      { onConflict: 'pet_id' },
    )
    .select('*')
    .single<PetGroomingInfo>();

  if (error) {
    throw error;
  }

  return data;
}

export async function upsertEmergencyInfo(supabase: SupabaseClient, userId: string, input: UpsertEmergencyInfoInput) {
  await getPetById(supabase, userId, input.pet_id);

  const { data, error } = await supabase
    .from('pet_emergency_info')
    .upsert(input, { onConflict: 'pet_id' })
    .select('*')
    .single<PetEmergencyInfo>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getUpcomingVaccinations(
  supabase: SupabaseClient,
  userId: string,
  daysAhead = 7,
): Promise<UpcomingVaccinationGroup[]> {
  const lastDate = new Date();
  lastDate.setDate(lastDate.getDate() + daysAhead);

  const { data, error } = await supabase
    .from('pet_vaccinations')
    .select('id, vaccine_name, next_due_date, reminder_enabled, clinic_name, veterinarian_name, pets!inner(id, name, user_id)')
    .eq('reminder_enabled', true)
    .not('next_due_date', 'is', null)
    .lte('next_due_date', toIsoDate(lastDate))
    .eq('pets.user_id', userId)
    .order('next_due_date', { ascending: true });

  if (error) {
    throw error;
  }

  const grouped = new Map<number, UpcomingVaccinationGroup>();

  for (const record of data ?? []) {
    const petInfo = Array.isArray(record.pets) ? record.pets[0] : record.pets;

    if (!petInfo || !record.next_due_date) {
      continue;
    }

    if (!grouped.has(petInfo.id)) {
      grouped.set(petInfo.id, {
        petId: petInfo.id,
        petName: petInfo.name,
        vaccinations: [],
      });
    }

    grouped.get(petInfo.id)!.vaccinations.push({
      vaccinationId: record.id,
      vaccineName: record.vaccine_name,
      nextDueDate: record.next_due_date,
      reminderEnabled: record.reminder_enabled,
      clinicName: record.clinic_name,
      veterinarianName: record.veterinarian_name,
    });
  }

  return Array.from(grouped.values());
}

export async function getReminderPreferences(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('pet_reminder_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<PetReminderPreferences>();

  if (error) {
    throw error;
  }

  return (
    data ?? {
      id: '',
      user_id: userId,
      days_ahead: 7,
      in_app_enabled: true,
      email_enabled: false,
      whatsapp_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  );
}

export async function upsertReminderPreferences(
  supabase: SupabaseClient,
  userId: string,
  input: UpsertReminderPreferencesInput,
) {
  const payload = {
    user_id: userId,
    days_ahead: input.days_ahead,
    in_app_enabled: input.in_app_enabled,
    email_enabled: input.email_enabled,
    whatsapp_enabled: input.whatsapp_enabled,
  };

  const { data, error } = await supabase
    .from('pet_reminder_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single<PetReminderPreferences>();

  if (error) {
    throw error;
  }

  return data;
}

export async function logPassportAuditEvent(
  supabase: SupabaseClient,
  userId: string,
  input: PassportAuditEventInput,
) {
  const { error } = await supabase.from('pet_passport_audit_events').insert({
    user_id: userId,
    pet_id: input.pet_id,
    action: input.action,
    step_index: input.step_index ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw error;
  }
}
