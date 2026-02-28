import Link from 'next/link';
import { requireAuthenticatedUser } from '@/lib/auth/session';

export default async function UserProfilePage() {
  const { supabase, user } = await requireAuthenticatedUser();

  const { data: profile } = await supabase
    .from('users')
    .select('id, phone, name, email, address, age, gender, photo_url, created_at')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return (
      <div className="rounded-3xl border border-[#f2dfcf] bg-white p-6 text-sm text-red-600 shadow-soft-md">
        Could not load your profile right now. Please sign in again.
      </div>
    );
  }

  let profileImageUrl: string | null = null;

  if (profile.photo_url) {
    if (/^https?:\/\//i.test(profile.photo_url)) {
      profileImageUrl = profile.photo_url;
    } else {
      const signed = await supabase.storage.from('user-photos').createSignedUrl(profile.photo_url, 3600);
      profileImageUrl = signed.data?.signedUrl ?? null;
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-ink">Profile</h1>
          <Link
            href="/dashboard/user/settings"
            className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-4 py-2 text-xs font-semibold text-ink"
          >
            Edit in Settings
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <div className="mb-5 flex items-center gap-3">
          {profileImageUrl ? (
            <img src={profileImageUrl} alt="Profile" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fff2e7] text-base font-semibold text-ink">
              {(profile.name || 'U').slice(0, 1).toUpperCase()}
            </div>
          )}
          <p className="text-sm text-[#6b6b6b]">Profile photo can be changed from Settings.</p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[#6b6b6b]">Name</dt>
            <dd className="text-sm font-semibold text-ink">{profile.name || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#6b6b6b]">Email</dt>
            <dd className="text-sm font-semibold text-ink">{profile.email || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#6b6b6b]">Phone</dt>
            <dd className="text-sm font-semibold text-ink">{profile.phone || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#6b6b6b]">Age</dt>
            <dd className="text-sm font-semibold text-ink">{profile.age ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#6b6b6b]">Gender</dt>
            <dd className="text-sm font-semibold capitalize text-ink">{profile.gender || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#6b6b6b]">Address</dt>
            <dd className="text-sm font-semibold text-ink">{profile.address || '-'}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
