import ProviderDashboardClient from '@/components/dashboard/ProviderDashboardClient';
import { requireRole, requireAuthenticatedUser } from '@/lib/auth/session';
import { getProviderDashboard } from '@/lib/provider-management/service';

export default async function ProviderDashboardPage() {
  await requireRole(['provider']);

  const { supabase, user } = await requireAuthenticatedUser();
  const dashboard = await getProviderDashboard(supabase, user.id);

  return <ProviderDashboardClient initialDashboard={dashboard} />;
}
