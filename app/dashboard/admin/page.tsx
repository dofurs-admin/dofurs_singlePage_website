import AdminDashboardClient from '@/components/dashboard/AdminDashboardClient';
import { requireAuthenticatedUser, requireRole } from '@/lib/auth/session';
import {
  getAdminServiceModerationSummary,
  getPlatformDiscountAnalytics,
  listAdminProviderModerationItems,
  listPlatformDiscounts,
} from '@/lib/provider-management/service';

type AdminDashboardView = 'overview' | 'operations' | 'access' | 'services';

type AdminDashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveAdminDashboardView(value: string | string[] | undefined): AdminDashboardView {
  const resolvedValue = Array.isArray(value) ? value[0] : value;

  switch (resolvedValue) {
    case 'operations':
    case 'access':
    case 'services':
      return resolvedValue;
    default:
      return 'overview';
  }
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  await requireAuthenticatedUser();
  const role = await requireRole(['admin', 'staff']);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const view = resolveAdminDashboardView(resolvedSearchParams?.view);

  const { supabase } = await requireAuthenticatedUser();

  const [
    bookingsResult,
    providersResult,
    moderationProviders,
    providerDocumentsResult,
    providerAvailabilityResult,
    providerServicesResult,
    providerServicePincodesResult,
    serviceModerationSummary,
    platformDiscounts,
    discountAnalytics,
    serviceCategoriesResult,
    servicePackagesResult,
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
    getAdminServiceModerationSummary(supabase),
    listPlatformDiscounts(supabase),
    getPlatformDiscountAnalytics(supabase),
    supabase
      .from('service_categories')
      .select('*')
      .order('display_order', { ascending: true }),
    supabase
      .from('service_packages')
      .select('*')
      .order('display_order', { ascending: true }),
  ]);

  return (
    <AdminDashboardClient
      canManageUserAccess={role === 'admin'}
      view={view}
      initialBookings={bookingsResult.data ?? []}
      providers={providersResult.data ?? []}
      moderationProviders={moderationProviders}
      providerDocuments={providerDocumentsResult.data ?? []}
      initialAvailability={providerAvailabilityResult.data ?? []}
      initialServices={providerServicesResult.data ?? []}
      initialServicePincodes={providerServicePincodesResult.data ?? []}
      initialServiceSummary={serviceModerationSummary}
      initialDiscounts={platformDiscounts}
      initialDiscountAnalytics={discountAnalytics}
      initialServiceCategories={serviceCategoriesResult.data ?? []}
      initialServicePackages={servicePackagesResult.data ?? []}
    />
  );
}
