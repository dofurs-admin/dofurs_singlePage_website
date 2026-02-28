import AdminDashboardClient from '@/components/dashboard/AdminDashboardClient';
import { requireAuthenticatedUser, requireRole } from '@/lib/auth/session';

export default async function AdminDashboardPage() {
  await requireAuthenticatedUser();
  await requireRole(['admin']);

  const { supabase } = await requireAuthenticatedUser();

  const [bookingsResult, providersResult] = await Promise.all([
    supabase.from('bookings').select('id, provider_id, booking_start, status').order('booking_start', { ascending: false }).limit(100),
    supabase.from('providers').select('id, name').order('name', { ascending: true }),
  ]);

  return <AdminDashboardClient initialBookings={bookingsResult.data ?? []} providers={providersResult.data ?? []} />;
}
