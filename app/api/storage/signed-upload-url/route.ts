import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

const uploadSchema = z.object({
  bucket: z.enum(['user-photos', 'pet-photos']),
  fileName: z.string().min(1),
});

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = uploadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const sanitizedName = parsed.data.fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const objectPath = `${user.id}/${Date.now()}-${sanitizedName}`;

  const { data, error } = await supabase.storage.from(parsed.data.bucket).createSignedUploadUrl(objectPath);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create signed upload URL' }, { status: 500 });
  }

  return NextResponse.json({
    bucket: parsed.data.bucket,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  });
}
