import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';

const petSchema = z.object({
  name: z.string().min(1).max(120),
  breed: z.string().max(120).nullable().optional(),
  age: z.number().int().min(0).nullable().optional(),
  weight: z.number().min(0).nullable().optional(),
  gender: z.string().max(20).nullable().optional(),
  vaccinationStatus: z.string().max(120).nullable().optional(),
  allergies: z.string().max(500).nullable().optional(),
  behaviorNotes: z.string().max(800).nullable().optional(),
  photoUrl: z.string().min(1).max(500).nullable().optional(),
});

export async function GET() {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { data, error } = await supabase.from('pets').select('*').eq('user_id', user.id).order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pets: data ?? [] });
}

export async function POST(request: Request) {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const payload = await request.json().catch(() => null);
  const parsed = petSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('pets')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      breed: parsed.data.breed ?? null,
      age: parsed.data.age ?? null,
      weight: parsed.data.weight ?? null,
      gender: parsed.data.gender ?? null,
      vaccination_status: parsed.data.vaccinationStatus ?? null,
      allergies: parsed.data.allergies ?? null,
      behavior_notes: parsed.data.behaviorNotes ?? null,
      photo_url: parsed.data.photoUrl ?? null,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, pet: data });
}
