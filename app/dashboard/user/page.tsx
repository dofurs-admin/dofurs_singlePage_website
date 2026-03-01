import UserDashboardClient from '@/components/dashboard/UserDashboardClient';
import { requireAuthenticatedUser } from '@/lib/auth/session';

export default async function UserDashboardPage() {
  const { supabase, user } = await requireAuthenticatedUser();

  const [petsResult, bookingsResult] = await Promise.all([
    supabase.from('pets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase
      .from('bookings')
      .select(
        'id, booking_start, booking_end, booking_date, start_time, end_time, status, booking_status, booking_mode, amount, payment_mode, service_type, provider_id',
      )
      .eq('user_id', user.id)
      .order('booking_start', { ascending: false }),
  ]);

  return (
    <UserDashboardClient
      initialPets={petsResult.data ?? []}
      initialBookings={bookingsResult.data ?? []}
    />
  );
}
