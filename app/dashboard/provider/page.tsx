import ProviderDashboardClient from '@/components/dashboard/ProviderDashboardClient';
import { requireRole, requireAuthenticatedUser } from '@/lib/auth/session';

export default async function ProviderDashboardPage() {
  await requireAuthenticatedUser();
  await requireRole(['provider', 'admin']);

  const { supabase, user } = await requireAuthenticatedUser();

  const { data: roleData } = await supabase.from('users').select('roles(name)').eq('id', user.id).single();
  const roleName = (Array.isArray(roleData?.roles) ? roleData?.roles[0] : roleData?.roles)?.name;

  let providerId: number | null = null;

  if (roleName === 'provider') {
    const providerIdClaim = user.app_metadata?.provider_id;
    providerId = typeof providerIdClaim === 'number' ? providerIdClaim : Number(providerIdClaim);
  }

  if (roleName === 'admin') {
    const { data: firstProvider } = await supabase.from('providers').select('id').order('id', { ascending: true }).limit(1).single();
    providerId = firstProvider?.id ?? null;
  }

  if (!providerId || Number.isNaN(providerId)) {
    return (
      <div className="rounded-3xl border border-[#f2dfcf] bg-white p-6 text-sm text-red-600 shadow-soft-md">
        Provider profile is not linked yet. Add provider_id to auth app metadata for this account.
      </div>
    );
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, provider_id, booking_start, booking_end, status')
    .eq('provider_id', providerId)
    .order('booking_start', { ascending: false });

  return <ProviderDashboardClient providerId={providerId} initialBookings={bookings ?? []} />;
}
