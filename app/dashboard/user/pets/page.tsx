import { requireAuthenticatedUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function UserPetProfilesPage() {
  await requireAuthenticatedUser();
  
  // Pet management is now integrated in the main dashboard
  redirect('/dashboard/user');
}
