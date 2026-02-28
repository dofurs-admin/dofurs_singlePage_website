import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/),
  address: z.string().trim().min(5).max(300),
  age: z.number().int().min(13).max(120),
  gender: z.enum(['male', 'female', 'other']),
  photoUrl: z.string().trim().min(1).max(500).nullable().optional(),
});

export async function GET() {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, phone, name, email, address, age, gender, photo_url, created_at, role_id, roles(name)')
    .eq('id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const { user, role, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (!role) {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const normalizedPhone = parsed.data.phone.trim();

  const { data: existingPhoneProfile, error: existingPhoneProfileError } = await supabase
    .from('users')
    .select('id')
    .eq('phone', normalizedPhone)
    .neq('id', user.id)
    .maybeSingle();

  if (existingPhoneProfileError) {
    return NextResponse.json({ error: existingPhoneProfileError.message }, { status: 500 });
  }

  if (existingPhoneProfile) {
    return NextResponse.json({ error: 'This phone number is already in use.' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('users')
    .update({
      name: parsed.data.name.trim(),
      phone: normalizedPhone,
      address: parsed.data.address.trim(),
      age: parsed.data.age,
      gender: parsed.data.gender,
      photo_url: parsed.data.photoUrl ?? null,
    })
    .eq('id', user.id)
    .select('id, phone, name, email, address, age, gender, photo_url')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, profile: data });
}
