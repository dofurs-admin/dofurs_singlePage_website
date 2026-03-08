import AdminDashboardClient from '@/components/dashboard/AdminDashboardClient';
import { requireAuthenticatedUser, requireRole } from '@/lib/auth/session';
import {
  getAdminServiceModerationSummary,
  getPlatformDiscountAnalytics,
  listAdminProviderModerationItems,
  listPlatformDiscounts,
} from '@/lib/provider-management/service';

type AdminDashboardView = 'overview' | 'bookings' | 'users' | 'providers' | 'services' | 'access' | 'health';

type AdminDashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveAdminDashboardView(value: string | string[] | undefined): AdminDashboardView {
  const resolvedValue = Array.isArray(value) ? value[0] : value;

  switch (resolvedValue) {
    case 'bookings':
    case 'users':
    case 'providers':
    case 'services':
    case 'access':
    case 'health':
      return resolvedValue;
    default:
      return 'overview';
  }
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const role = await requireRole(['admin', 'staff']);
  const { supabase } = await requireAuthenticatedUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const view = resolveAdminDashboardView(resolvedSearchParams?.view);

  // Only load critical data for initial render, paginated
  const [
    bookingsResult,
    providersResult,
    moderationProviders,
    serviceCategoriesResult,
    catalogServicesResult,
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, user_id, provider_id, booking_start, booking_date, start_time, end_time, status, booking_status, booking_mode, service_type')
      .order('booking_start', { ascending: false })
      .limit(200),
    supabase.from('providers').select('id, name').order('name', { ascending: true }).limit(200),
    listAdminProviderModerationItems(supabase),
    supabase
      .from('service_categories')
      .select('*')
      .order('display_order', { ascending: true }),
    supabase
      .from('provider_services')
      .select('*')
      .order('display_order', { ascending: true }),
  ]);

  // Load analytics and config data in parallel (faster than heavy table data)
  const [serviceModerationSummary, platformDiscounts, discountAnalytics] = await Promise.all([
    getAdminServiceModerationSummary(supabase),
    listPlatformDiscounts(supabase),
    getPlatformDiscountAnalytics(supabase),
  ]);

  // Empty arrays for data that will be loaded on-demand by the client
  const providerAvailabilityResult = { data: [] };
  const providerServicesResult = { data: [] };
  const providerServicePincodesResult = { data: [] };

  return (
    <AdminDashboardClient
      canManageUserAccess={role === 'admin'}
      view={view}
      initialBookings={bookingsResult.data ?? []}
      providers={providersResult.data ?? []}
      moderationProviders={moderationProviders}
      initialAvailability={providerAvailabilityResult.data ?? []}
      initialServices={providerServicesResult.data ?? []}
      initialServicePincodes={providerServicePincodesResult.data ?? []}
      initialServiceSummary={serviceModerationSummary}
      initialDiscounts={platformDiscounts}
      initialDiscountAnalytics={discountAnalytics}
      initialServiceCategories={serviceCategoriesResult.data ?? []}
      initialCatalogServices={catalogServicesResult.data ?? []}
    />
  );
}
