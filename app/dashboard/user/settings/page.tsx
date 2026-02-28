import UserSettingsClient from '@/components/dashboard/UserSettingsClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';

export default async function UserSettingsPage() {
  const { supabase, user } = await requireAuthenticatedUser();

  const { data: profile } = await supabase
    .from('users')
    .select('id, phone, name, email, address, age, gender, photo_url')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return (
      <div className="rounded-3xl border border-[#f2dfcf] bg-white p-6 text-sm text-red-600 shadow-soft-md">
        Could not load your settings profile right now. Please sign in again.
      </div>
    );
  }

  return <UserSettingsClient initialProfile={profile} />;
}
