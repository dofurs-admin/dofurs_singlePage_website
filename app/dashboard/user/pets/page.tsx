import UserPetProfilesClient from '@/components/dashboard/UserPetProfilesClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';

export default async function UserPetProfilesPage() {
  const { supabase, user } = await requireAuthenticatedUser();

  const { data: pets } = await supabase.from('pets').select('*').eq('user_id', user.id).order('created_at', { ascending: false });

  return <UserPetProfilesClient initialPets={pets ?? []} />;
}
