import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { AGGRESSION_LEVELS } from '@/lib/pets/types';
import { updatePet } from '@/lib/pets/service';

const petSchema = z.object({
  name: z.string().min(1).max(120),
  breed: z.string().max(120).nullable().optional(),
  age: z.number().int().min(0).nullable().optional(),
  weight: z.number().min(0).nullable().optional(),
  gender: z.string().max(20).nullable().optional(),
  allergies: z.string().max(500).nullable().optional(),
  photoUrl: z.string().min(1).max(500).nullable().optional(),
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
});

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
  const parsed = petSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const pet = await updatePet(supabase, user.id, petId, {
      name: parsed.data.name,
      breed: parsed.data.breed ?? null,
      age: parsed.data.age ?? null,
      weight: parsed.data.weight ?? null,
      gender: parsed.data.gender ?? null,
      allergies: parsed.data.allergies ?? null,
      photo_url: parsed.data.photoUrl ?? null,
      date_of_birth: parsed.data.dateOfBirth ?? null,
      microchip_number: parsed.data.microchipNumber ?? null,
      neutered_spayed: parsed.data.neuteredSpayed,
      color: parsed.data.color ?? null,
      size_category: parsed.data.sizeCategory ?? null,
      energy_level: parsed.data.energyLevel ?? null,
      aggression_level: parsed.data.aggressionLevel ?? null,
      is_bite_history: parsed.data.isBiteHistory,
      bite_incidents_count: parsed.data.biteIncidentsCount,
      house_trained: parsed.data.houseTrained,
      leash_trained: parsed.data.leashTrained,
      crate_trained: parsed.data.crateTrained,
      social_with_dogs: parsed.data.socialWithDogs ?? null,
      social_with_cats: parsed.data.socialWithCats ?? null,
      social_with_children: parsed.data.socialWithChildren ?? null,
      separation_anxiety: parsed.data.separationAnxiety,
    });

    return NextResponse.json({ success: true, pet });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update pet';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const petId = Number(id);

  if (!Number.isFinite(petId) || petId <= 0) {
    return NextResponse.json({ error: 'Invalid pet ID' }, { status: 400 });
  }

  const { error } = await supabase.from('pets').delete().eq('id', petId).eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
