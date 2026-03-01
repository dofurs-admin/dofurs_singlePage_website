import UserOwnerProfileClient from '@/components/dashboard/UserOwnerProfileClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { getOwnerProfileAggregate } from '@/lib/owner-profile/service';

export default async function UserProfilePage() {
  const { supabase, user } = await requireAuthenticatedUser();

  let aggregate = await getOwnerProfileAggregate(supabase, user.id);

  if (!aggregate) {
    const { data: legacyProfile } = await supabase
      .from('users')
      .select('name, phone, photo_url, gender')
      .eq('id', user.id)
      .maybeSingle<{
        name: string | null;
        phone: string;
        photo_url: string | null;
        gender: string | null;
      }>();

    if (legacyProfile?.phone) {
      const fullName = legacyProfile.name?.trim() || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Pet Owner';

      await supabase.from('profiles').upsert(
        {
          id: user.id,
          full_name: fullName,
          phone_number: legacyProfile.phone,
          profile_photo_url: legacyProfile.photo_url,
          gender: legacyProfile.gender,
        },
        { onConflict: 'id' },
      );

      aggregate = await getOwnerProfileAggregate(supabase, user.id);
    }
  }

  if (!aggregate) {
    return (
      <div className="rounded-3xl border border-[#f2dfcf] bg-white p-6 text-sm text-red-600 shadow-soft-md">
        Could not load your owner profile right now. Complete profile setup first, then refresh this page.
      </div>
    );
  }

  return (
    <UserOwnerProfileClient
      userId={user.id}
      initialProfile={aggregate.profile}
      initialAddresses={aggregate.addresses}
      initialContacts={aggregate.emergencyContacts}
      initialPreferences={aggregate.preferences}
    />
  );
}
