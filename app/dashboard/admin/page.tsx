import AdminDashboardClient from '@/components/dashboard/AdminDashboardClient';
import { requireAuthenticatedUser, requireRole } from '@/lib/auth/session';
import { listAdminProviderModerationItems } from '@/lib/provider-management/service';

export default async function AdminDashboardPage() {
  await requireAuthenticatedUser();
  await requireRole(['admin']);

  const { supabase } = await requireAuthenticatedUser();

  const [
    bookingsResult,
    providersResult,
    moderationProviders,
    providerDocumentsResult,
    providerAvailabilityResult,
    providerServicesResult,
    providerServicePincodesResult,
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, provider_id, booking_start, booking_date, start_time, end_time, status, booking_status, booking_mode, service_type')
      .order('booking_start', { ascending: false })
      .limit(200),
    supabase.from('providers').select('id, name').order('name', { ascending: true }),
    listAdminProviderModerationItems(supabase),
    supabase
      .from('provider_documents')
      .select('id, provider_id, document_type, document_url, verification_status, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('provider_availability')
      .select('id, provider_id, day_of_week, start_time, end_time, is_available, slot_duration_minutes, buffer_time_minutes')
      .order('provider_id', { ascending: true })
      .order('day_of_week', { ascending: true })
      .limit(5000),
    supabase
      .from('provider_services')
      .select('id, provider_id, service_type, base_price, surge_price, commission_percentage, service_duration_minutes, is_active')
      .order('provider_id', { ascending: true })
      .order('service_type', { ascending: true })
      .limit(5000),
    supabase
      .from('provider_service_pincodes')
      .select('provider_service_id, pincode, is_enabled')
      .limit(10000),
  ]);

  return (
    <AdminDashboardClient
      initialBookings={bookingsResult.data ?? []}
      providers={providersResult.data ?? []}
      moderationProviders={moderationProviders}
      providerDocuments={providerDocumentsResult.data ?? []}
      initialAvailability={providerAvailabilityResult.data ?? []}
      initialServices={providerServicesResult.data ?? []}
      initialServicePincodes={providerServicePincodesResult.data ?? []}
    />
  );
}
