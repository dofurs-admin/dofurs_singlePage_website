import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

const readSchema = z.object({
  bucket: z.enum(['user-photos', 'pet-photos', 'service-images']),
  path: z.string().min(1),
  expiresIn: z.number().int().min(60).max(3600).optional(),
});

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const adminSupabase = getSupabaseAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;

  let bearerUser = null;
  if (accessToken) {
    const { data: bearerData } = await adminSupabase.auth.getUser(accessToken);
    bearerUser = bearerData.user ?? null;
  }

  const authUser = user ?? session?.user ?? bearerUser;

  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = readSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const ownerPrefix = `${authUser.id}/`;
  const canAccess = parsed.data.path.startsWith(ownerPrefix);

  if (!canAccess) {
    const { data: dbUser } = await supabase
      .from('users')
      .select('roles(name)')
      .eq('id', authUser.id)
      .single();

    const roleName = (Array.isArray(dbUser?.roles) ? dbUser?.roles[0] : dbUser?.roles)?.name;
    if (roleName !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { data, error } = await adminSupabase
    .storage
    .from(parsed.data.bucket)
    .createSignedUrl(parsed.data.path, parsed.data.expiresIn ?? 300);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create signed read URL' }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
