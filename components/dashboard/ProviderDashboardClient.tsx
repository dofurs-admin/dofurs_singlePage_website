'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { bookingTimelineLabel } from '@/lib/bookings/timeline';
import type { ProviderDashboard, ProviderReview } from '@/lib/provider-management/types';

const WEEK_DAYS = [
  { label: 'Sunday', day: 0 },
  { label: 'Monday', day: 1 },
  { label: 'Tuesday', day: 2 },
  { label: 'Wednesday', day: 3 },
  { label: 'Thursday', day: 4 },
  { label: 'Friday', day: 5 },
  { label: 'Saturday', day: 6 },
] as const;

type ReviewsPageResponse = {
  reviews: ProviderReview[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

type ProviderBooking = {
  id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  booking_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_mode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  service_type: string | null;
  provider_notes: string | null;
};

type ProviderBlockedDate = {
  id: string;
  provider_id: number;
  blocked_date: string;
  reason: string | null;
  created_at: string;
};

export default function ProviderDashboardClient({
  initialDashboard,
}: {
  initialDashboard: ProviderDashboard | null;
}) {
  const [dashboard, setDashboard] = useState<ProviderDashboard | null>(initialDashboard);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const [profileForm, setProfileForm] = useState({
    bio: initialDashboard?.provider.bio ?? '',
    profile_photo_url: initialDashboard?.provider.profile_photo_url ?? '',
    years_of_experience:
      initialDashboard?.provider.years_of_experience === null || initialDashboard?.provider.years_of_experience === undefined
        ? ''
        : String(initialDashboard.provider.years_of_experience),
    phone_number: initialDashboard?.provider.phone_number ?? '',
    email: initialDashboard?.provider.email ?? '',
    service_radius_km:
      initialDashboard?.provider.service_radius_km === null || initialDashboard?.provider.service_radius_km === undefined
        ? ''
        : String(initialDashboard.provider.service_radius_km),
  });

  const [detailsForm, setDetailsForm] = useState({
    license_number: initialDashboard?.professionalDetails?.license_number ?? '',
    specialization: initialDashboard?.professionalDetails?.specialization ?? '',
    teleconsult_enabled: initialDashboard?.professionalDetails?.teleconsult_enabled ?? false,
    emergency_service_enabled: initialDashboard?.professionalDetails?.emergency_service_enabled ?? false,
    equipment_details: initialDashboard?.professionalDetails?.equipment_details ?? '',
    insurance_document_url: initialDashboard?.professionalDetails?.insurance_document_url ?? '',
    registration_number: initialDashboard?.clinicDetails?.registration_number ?? '',
    gst_number: initialDashboard?.clinicDetails?.gst_number ?? '',
    address: initialDashboard?.clinicDetails?.address ?? '',
    city: initialDashboard?.clinicDetails?.city ?? '',
    state: initialDashboard?.clinicDetails?.state ?? '',
    pincode: initialDashboard?.clinicDetails?.pincode ?? '',
    number_of_doctors:
      initialDashboard?.clinicDetails?.number_of_doctors === null || initialDashboard?.clinicDetails?.number_of_doctors === undefined
        ? ''
        : String(initialDashboard.clinicDetails.number_of_doctors),
    hospitalization_available: initialDashboard?.clinicDetails?.hospitalization_available ?? false,
    emergency_services_available: initialDashboard?.clinicDetails?.emergency_services_available ?? false,
  });

  const [newAvailability, setNewAvailability] = useState({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '18:00',
    is_available: true,
  });
  const [availabilityDraft, setAvailabilityDraft] = useState<
    Record<string, { day_of_week: number; start_time: string; end_time: string; is_available: boolean }>
  >({});

  const [newDocument, setNewDocument] = useState({
    document_type: '',
    document_url: '',
  });
  const [documentDraft, setDocumentDraft] = useState<Record<string, { document_type: string; document_url: string }>>({});

  const [reviewResponses, setReviewResponses] = useState<Record<string, string>>({});
  const [reviewsPage, setReviewsPage] = useState<ReviewsPageResponse>({
    reviews: initialDashboard?.reviews ?? [],
    page: 1,
    pageSize: 10,
    total: initialDashboard?.reviews.length ?? 0,
    hasMore: false,
  });
  const [reviewFilter, setReviewFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [responseHistory, setResponseHistory] = useState<Record<string, Array<{ id: string; created_at: string; previous_response: string | null; new_response: string }>>>({});
  const [providerBookings, setProviderBookings] = useState<ProviderBooking[]>([]);
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'>('all');
  const [blockedDates, setBlockedDates] = useState<ProviderBlockedDate[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState({ blockedDate: '', reason: '' });

  useEffect(() => {
    if (!dashboard) {
      return;
    }

    setProfileForm({
      bio: dashboard.provider.bio ?? '',
      profile_photo_url: dashboard.provider.profile_photo_url ?? '',
      years_of_experience:
        dashboard.provider.years_of_experience === null || dashboard.provider.years_of_experience === undefined
          ? ''
          : String(dashboard.provider.years_of_experience),
      phone_number: dashboard.provider.phone_number ?? '',
      email: dashboard.provider.email ?? '',
      service_radius_km:
        dashboard.provider.service_radius_km === null || dashboard.provider.service_radius_km === undefined
          ? ''
          : String(dashboard.provider.service_radius_km),
    });

    setDetailsForm((current) => ({
      ...current,
      license_number: dashboard.professionalDetails?.license_number ?? '',
      specialization: dashboard.professionalDetails?.specialization ?? '',
      teleconsult_enabled: dashboard.professionalDetails?.teleconsult_enabled ?? false,
      emergency_service_enabled: dashboard.professionalDetails?.emergency_service_enabled ?? false,
      equipment_details: dashboard.professionalDetails?.equipment_details ?? '',
      insurance_document_url: dashboard.professionalDetails?.insurance_document_url ?? '',
      registration_number: dashboard.clinicDetails?.registration_number ?? '',
      gst_number: dashboard.clinicDetails?.gst_number ?? '',
      address: dashboard.clinicDetails?.address ?? '',
      city: dashboard.clinicDetails?.city ?? '',
      state: dashboard.clinicDetails?.state ?? '',
      pincode: dashboard.clinicDetails?.pincode ?? '',
      number_of_doctors:
        dashboard.clinicDetails?.number_of_doctors === null || dashboard.clinicDetails?.number_of_doctors === undefined
          ? ''
          : String(dashboard.clinicDetails.number_of_doctors),
      hospitalization_available: dashboard.clinicDetails?.hospitalization_available ?? false,
      emergency_services_available: dashboard.clinicDetails?.emergency_services_available ?? false,
    }));

    const nextAvailabilityDraft: Record<
      string,
      { day_of_week: number; start_time: string; end_time: string; is_available: boolean }
    > = {};

    for (const slot of dashboard.availability) {
      nextAvailabilityDraft[slot.id] = {
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_available: slot.is_available,
      };
    }

    setAvailabilityDraft(nextAvailabilityDraft);

    const nextDocumentDraft: Record<string, { document_type: string; document_url: string }> = {};

    for (const doc of dashboard.documents) {
      nextDocumentDraft[doc.id] = {
        document_type: doc.document_type ?? '',
        document_url: doc.document_url ?? '',
      };
    }

    setDocumentDraft(nextDocumentDraft);
  }, [dashboard]);

  useEffect(() => {
    void fetchReviews(1, reviewFilter);
  }, [reviewFilter]);

  useEffect(() => {
    void fetchProviderBookings(bookingFilter);
  }, [bookingFilter]);

  useEffect(() => {
    void fetchBlockedDates();
  }, []);

  const performanceSummary = useMemo(() => {
    if (!dashboard) {
      return null;
    }

    return {
      avgRating: dashboard.provider.average_rating,
      totalBookings: dashboard.provider.total_bookings,
      cancellationRate: dashboard.provider.cancellation_rate,
      noShowCount: dashboard.provider.no_show_count,
      performanceScore: dashboard.provider.performance_score,
      rankingScore: dashboard.provider.ranking_score,
      accountStatus: dashboard.provider.account_status,
    };
  }, [dashboard]);

  const bookingInsights = useMemo(() => {
    const active = providerBookings.filter((booking) => booking.booking_status === 'pending' || booking.booking_status === 'confirmed');
    const pending = providerBookings.filter((booking) => booking.booking_status === 'pending');
    const confirmed = providerBookings.filter((booking) => booking.booking_status === 'confirmed');
    const completed = providerBookings.filter((booking) => booking.booking_status === 'completed');
    const noShow = providerBookings.filter((booking) => booking.booking_status === 'no_show');

    const hourBuckets: Record<string, number> = {
      Morning: 0,
      Afternoon: 0,
      Evening: 0,
    };

    for (const booking of active) {
      const hour = Number(booking.start_time.split(':')[0] ?? '0');

      if (hour < 12) {
        hourBuckets.Morning += 1;
      } else if (hour < 17) {
        hourBuckets.Afternoon += 1;
      } else {
        hourBuckets.Evening += 1;
      }
    }

    return {
      active: active.length,
      pending: pending.length,
      confirmed: confirmed.length,
      completed: completed.length,
      noShow: noShow.length,
      hourBuckets,
    };
  }, [providerBookings]);

  const providerAlerts = useMemo(() => {
    const alerts: Array<{ level: 'info' | 'warning' | 'critical'; message: string }> = [];

    if (bookingInsights.pending >= 5) {
      alerts.push({ level: 'critical', message: `${bookingInsights.pending} pending bookings need quick confirmation.` });
    } else if (bookingInsights.pending >= 2) {
      alerts.push({ level: 'warning', message: `${bookingInsights.pending} pending bookings awaiting action.` });
    }

    if (bookingInsights.noShow >= 2) {
      alerts.push({ level: 'warning', message: 'No-show trend increasing this period.' });
    }

    if (blockedDates.length === 0) {
      alerts.push({ level: 'info', message: 'No blocked dates set. Add holidays to avoid accidental bookings.' });
    }

    if (performanceSummary && performanceSummary.avgRating < 4) {
      alerts.push({ level: 'warning', message: 'Average rating below 4.0 — review feedback and respond quickly.' });
    }

    if (alerts.length === 0) {
      alerts.push({ level: 'info', message: 'Operational health looks strong today.' });
    }

    return alerts;
  }, [bookingInsights.noShow, bookingInsights.pending, blockedDates.length, performanceSummary]);

  async function providerRequest<T>(path: string, init?: RequestInit, retries = 2): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(path, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
          },
          cache: 'no-store',
        });

        const payload = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? 'Request failed');
        }

        return payload as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Request failed');
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
          continue;
        }
      }
    }

    throw lastError ?? new Error('Request failed');
  }

  async function refreshDashboard() {
    const response = await providerRequest<{ dashboard: ProviderDashboard | null }>('/api/provider/dashboard');
    setDashboard(response.dashboard);
  }

  async function fetchReviews(page: number, filter: 'all' | '1' | '2' | '3' | '4' | '5') {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '10');

    if (filter !== 'all') {
      params.set('rating', filter);
    }

    try {
      const response = await providerRequest<ReviewsPageResponse>(`/api/provider/reviews?${params.toString()}`);
      setReviewsPage(response);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load reviews.', 'error');
    }
  }

  async function fetchProviderBookings(filter: 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show') {
    const params = new URLSearchParams();
    params.set('fromDate', new Date().toISOString().slice(0, 10));
    params.set('limit', '200');

    if (filter !== 'all') {
      params.set('status', filter);
    }

    try {
      const response = await providerRequest<{ bookings: ProviderBooking[] }>(`/api/provider/bookings?${params.toString()}`);
      setProviderBookings(response.bookings);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load booking queue.', 'error');
    }
  }

  async function fetchBlockedDates() {
    try {
      const response = await providerRequest<{ blockedDates: ProviderBlockedDate[] }>('/api/provider/blocked-dates');
      setBlockedDates(response.blockedDates);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load blocked dates.', 'error');
    }
  }

  function setProviderBookingStatus(
    bookingId: number,
    status: 'confirmed' | 'completed' | 'no_show' | 'cancelled',
    providerNotes?: string,
  ) {
    startTransition(async () => {
      try {
        await providerRequest(`/api/provider/bookings/${bookingId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status, providerNotes }),
        });
        await fetchProviderBookings(bookingFilter);
        showToast('Booking updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update booking status.', 'error');
      }
    });
  }

  function addBlockedDate() {
    if (!newBlockedDate.blockedDate) {
      showToast('Select a date to block.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        await providerRequest('/api/provider/blocked-dates', {
          method: 'POST',
          body: JSON.stringify({
            blockedDate: newBlockedDate.blockedDate,
            reason: newBlockedDate.reason.trim() || undefined,
          }),
        });
        setNewBlockedDate({ blockedDate: '', reason: '' });
        await fetchBlockedDates();
        showToast('Blocked date added.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to block date.', 'error');
      }
    });
  }

  function removeBlockedDate(id: string) {
    startTransition(async () => {
      try {
        await providerRequest(`/api/provider/blocked-dates/${encodeURIComponent(id)}`, { method: 'DELETE' });
        await fetchBlockedDates();
        showToast('Blocked date removed.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to remove blocked date.', 'error');
      }
    });
  }

  function saveProfile() {
    if (!dashboard) {
      showToast('Create provider profile first.', 'error');
      return;
    }

    const payload = {
      bio: profileForm.bio.trim() || null,
      profile_photo_url: profileForm.profile_photo_url.trim() || null,
      years_of_experience: profileForm.years_of_experience ? Number(profileForm.years_of_experience) : null,
      phone_number: profileForm.phone_number.trim() || null,
      email: profileForm.email.trim() || null,
      service_radius_km: profileForm.service_radius_km ? Number(profileForm.service_radius_km) : null,
    };

    startTransition(async () => {
      try {
        await providerRequest('/api/provider/profile', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        await refreshDashboard();
        showToast('Profile information updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Profile update failed.', 'error');
      }
    });
  }

  function saveDetails() {
    if (!dashboard) {
      showToast('Create provider profile first.', 'error');
      return;
    }

    const payload = {
      professionalDetails: {
        license_number: detailsForm.license_number.trim() || null,
        specialization: detailsForm.specialization.trim() || null,
        teleconsult_enabled: detailsForm.teleconsult_enabled,
        emergency_service_enabled: detailsForm.emergency_service_enabled,
        equipment_details: detailsForm.equipment_details.trim() || null,
        insurance_document_url: detailsForm.insurance_document_url.trim() || null,
      },
      clinicDetails: {
        registration_number: detailsForm.registration_number.trim() || null,
        gst_number: detailsForm.gst_number.trim() || null,
        address: detailsForm.address.trim() || null,
        city: detailsForm.city.trim() || null,
        state: detailsForm.state.trim() || null,
        pincode: detailsForm.pincode.trim() || null,
        number_of_doctors: detailsForm.number_of_doctors ? Number(detailsForm.number_of_doctors) : null,
        hospitalization_available: detailsForm.hospitalization_available,
        emergency_services_available: detailsForm.emergency_services_available,
      },
    };

    startTransition(async () => {
      try {
        await providerRequest('/api/provider/details', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        await refreshDashboard();
        showToast('Professional and clinic details updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update details.', 'error');
      }
    });
  }

  function addAvailability() {
    if (!dashboard) {
      showToast('Create provider profile first.', 'error');
      return;
    }

    if (newAvailability.end_time <= newAvailability.start_time) {
      showToast('End time must be after start time.', 'error');
      return;
    }

    const current = dashboard.availability ?? [];

    startTransition(async () => {
      try {
        await providerRequest('/api/provider/availability', {
          method: 'PUT',
          body: JSON.stringify([
            ...current.map((slot) => ({
              id: slot.id,
              day_of_week: slot.day_of_week,
              start_time: slot.start_time,
              end_time: slot.end_time,
              is_available: slot.is_available,
            })),
            newAvailability,
          ]),
        });
        await refreshDashboard();
        showToast('Availability updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to save availability.', 'error');
      }
    });
  }

  function saveAvailabilitySlot(slotId: string) {
    const slot = availabilityDraft[slotId];

    if (!slot) {
      return;
    }

    if (slot.end_time <= slot.start_time) {
      showToast('End time must be after start time.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        await providerRequest(`/api/provider/availability/${encodeURIComponent(slotId)}`, {
          method: 'PATCH',
          body: JSON.stringify(slot),
        });
        await refreshDashboard();
        showToast('Availability slot updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update availability slot.', 'error');
      }
    });
  }

  function deleteAvailability(slotId: string) {
    startTransition(async () => {
      try {
        await providerRequest(`/api/provider/availability/${encodeURIComponent(slotId)}`, { method: 'DELETE' });
        await refreshDashboard();
        showToast('Availability slot deleted.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to delete availability slot.', 'error');
      }
    });
  }

  function uploadDocument() {
    if (!dashboard) {
      showToast('Create provider profile first.', 'error');
      return;
    }

    if (!newDocument.document_type.trim() || !newDocument.document_url.trim()) {
      showToast('Document type and URL are required.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        await providerRequest('/api/provider/documents', {
          method: 'POST',
          body: JSON.stringify({
            document_type: newDocument.document_type.trim(),
            document_url: newDocument.document_url.trim(),
          }),
        });
        await refreshDashboard();
        setNewDocument({ document_type: '', document_url: '' });
        showToast('Document uploaded.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to upload document.', 'error');
      }
    });
  }

  function saveDocument(documentId: string) {
    const doc = documentDraft[documentId];

    if (!doc || !doc.document_type.trim() || !doc.document_url.trim()) {
      showToast('Document type and URL are required.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        await providerRequest(`/api/provider/documents/${encodeURIComponent(documentId)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            document_type: doc.document_type.trim(),
            document_url: doc.document_url.trim(),
          }),
        });
        await refreshDashboard();
        showToast('Document updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update document.', 'error');
      }
    });
  }

  function removeDocument(documentId: string) {
    startTransition(async () => {
      try {
        await providerRequest(`/api/provider/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
        await refreshDashboard();
        showToast('Document deleted.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to delete document.', 'error');
      }
    });
  }

  function respondToReview(reviewId: string) {
    const responseText = (reviewResponses[reviewId] ?? '').trim();

    if (!responseText) {
      showToast('Response cannot be empty.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        await providerRequest(`/api/provider/reviews/${encodeURIComponent(reviewId)}/respond`, {
          method: 'PATCH',
          body: JSON.stringify({ responseText }),
        });
        await fetchReviews(reviewsPage.page, reviewFilter);
        setReviewResponses((current) => ({ ...current, [reviewId]: '' }));
        showToast('Review response submitted.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to respond to review.', 'error');
      }
    });
  }

  function loadResponseHistory(reviewId: string) {
    startTransition(async () => {
      try {
        const response = await providerRequest<{
          history: Array<{ id: string; created_at: string; previous_response: string | null; new_response: string }>;
        }>(`/api/provider/reviews/${encodeURIComponent(reviewId)}/history`);

        setResponseHistory((current) => ({ ...current, [reviewId]: response.history }));
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to load response history.', 'error');
      }
    });
  }

  if (!dashboard) {
    return (
      <div className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Provider Dashboard</h2>
        <p className="mt-2 text-sm text-[#6b6b6b]">
          Provider profile is not linked yet. Complete onboarding to access dashboard controls.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Notification Center</h2>
        <ul className="mt-4 grid gap-2 text-sm">
          {providerAlerts.map((alert, index) => (
            <li
              key={`${alert.level}-${index}`}
              className={`rounded-xl border p-3 ${
                alert.level === 'critical'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : alert.level === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-[#f2dfcf] bg-[#fffdfa] text-[#6b6b6b]'
              }`}
            >
              {alert.message}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Workload Insights</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-xl border border-[#f2dfcf] p-3">Active Queue: {bookingInsights.active}</div>
          <div className="rounded-xl border border-[#f2dfcf] p-3">Pending Confirmation: {bookingInsights.pending}</div>
          <div className="rounded-xl border border-[#f2dfcf] p-3">Confirmed Upcoming: {bookingInsights.confirmed}</div>
          <div className="rounded-xl border border-[#f2dfcf] p-3">Morning Load: {bookingInsights.hourBuckets.Morning}</div>
          <div className="rounded-xl border border-[#f2dfcf] p-3">Afternoon Load: {bookingInsights.hourBuckets.Afternoon}</div>
          <div className="rounded-xl border border-[#f2dfcf] p-3">Evening Load: {bookingInsights.hourBuckets.Evening}</div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-ink">Booking Command Center</h2>
          <select
            value={bookingFilter}
            onChange={(event) =>
              setBookingFilter(
                event.target.value as 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show',
              )
            }
            className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>

        <ul className="mt-4 grid gap-2 text-sm">
          {providerBookings.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-[#6b6b6b]">No bookings in queue.</li>
          ) : (
            providerBookings.slice(0, 20).map((booking) => (
              <li key={booking.id} className="rounded-xl border border-[#f2dfcf] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">
                    #{booking.id} • {booking.booking_date} • {booking.start_time} - {booking.end_time}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {booking.booking_status === 'pending' ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-700">
                        SLA: Action Needed
                      </span>
                    ) : null}
                    <span className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-3 py-1 text-[11px] capitalize text-ink">
                      {booking.booking_status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-[#6b6b6b]">
                  {booking.service_type ?? 'Service'} • {booking.booking_mode.replace('_', ' ')}
                </p>
                <p className="mt-1 text-[11px] text-[#6b6b6b]">{bookingTimelineLabel(booking.booking_status)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {booking.booking_status === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => setProviderBookingStatus(booking.id, 'confirmed')}
                      className="rounded-full border border-[#f2dfcf] px-3 py-1 text-[11px] font-semibold text-ink"
                    >
                      Confirm
                    </button>
                  ) : null}
                  {booking.booking_status === 'confirmed' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setProviderBookingStatus(booking.id, 'completed')}
                        className="rounded-full border border-[#f2dfcf] px-3 py-1 text-[11px] font-semibold text-ink"
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => setProviderBookingStatus(booking.id, 'no_show')}
                        className="rounded-full border border-[#f2dfcf] px-3 py-1 text-[11px] font-semibold text-ink"
                      >
                        Mark No-show
                      </button>
                    </>
                  ) : null}
                  {(booking.booking_status === 'pending' || booking.booking_status === 'confirmed') ? (
                    <button
                      type="button"
                      onClick={() => setProviderBookingStatus(booking.id, 'cancelled')}
                      className="rounded-full border border-[#f2dfcf] px-3 py-1 text-[11px] font-semibold text-ink"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Blocked Dates</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="date"
            value={newBlockedDate.blockedDate}
            onChange={(event) => setNewBlockedDate((current) => ({ ...current, blockedDate: event.target.value }))}
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          />
          <input
            value={newBlockedDate.reason}
            onChange={(event) => setNewBlockedDate((current) => ({ ...current, reason: event.target.value }))}
            placeholder="Reason"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          />
          <button
            type="button"
            onClick={addBlockedDate}
            disabled={isPending}
            className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-5 py-2.5 text-xs font-semibold text-ink"
          >
            Block Date
          </button>
        </div>

        <ul className="mt-4 grid gap-2 text-sm">
          {blockedDates.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-[#6b6b6b]">No blocked dates set.</li>
          ) : (
            blockedDates.map((item) => (
              <li key={item.id} className="rounded-xl border border-[#f2dfcf] p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{item.blocked_date}</p>
                  <p className="text-xs text-[#6b6b6b]">{item.reason ?? 'No reason provided'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeBlockedDate(item.id)}
                  className="rounded-full border border-[#f2dfcf] px-3 py-1 text-[11px] font-semibold text-ink"
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Section 1 – Profile Information</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={profileForm.bio}
            onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
            placeholder="Bio"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm sm:col-span-2"
          />
          <input
            value={profileForm.profile_photo_url}
            onChange={(event) => setProfileForm((current) => ({ ...current, profile_photo_url: event.target.value }))}
            placeholder="Profile photo URL"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm sm:col-span-2"
          />
          <input
            type="number"
            min={0}
            value={profileForm.years_of_experience}
            onChange={(event) => setProfileForm((current) => ({ ...current, years_of_experience: event.target.value }))}
            placeholder="Years of experience"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          />
          <input
            value={profileForm.phone_number}
            onChange={(event) => setProfileForm((current) => ({ ...current, phone_number: event.target.value }))}
            placeholder="Phone number"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          />
          <input
            value={profileForm.email}
            onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="Email"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          />
          <input
            type="number"
            min={0}
            value={profileForm.service_radius_km}
            onChange={(event) => setProfileForm((current) => ({ ...current, service_radius_km: event.target.value }))}
            placeholder="Service radius (km)"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={saveProfile}
          disabled={isPending}
          className="mt-4 rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-5 py-2.5 text-xs font-semibold text-ink"
        >
          Save Profile
        </button>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Section 2 – Professional/Clinic Details</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <input
            value={detailsForm.license_number}
            onChange={(event) => setDetailsForm((current) => ({ ...current, license_number: event.target.value }))}
            placeholder="License number"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5"
          />
          <input
            value={detailsForm.specialization}
            onChange={(event) => setDetailsForm((current) => ({ ...current, specialization: event.target.value }))}
            placeholder="Specialization"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5"
          />
          <input
            value={detailsForm.registration_number}
            onChange={(event) => setDetailsForm((current) => ({ ...current, registration_number: event.target.value }))}
            placeholder="Clinic registration"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5"
          />
          <input
            value={detailsForm.city}
            onChange={(event) => setDetailsForm((current) => ({ ...current, city: event.target.value }))}
            placeholder="City"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5"
          />
          <input
            value={detailsForm.state}
            onChange={(event) => setDetailsForm((current) => ({ ...current, state: event.target.value }))}
            placeholder="State"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5"
          />
          <input
            type="number"
            min={0}
            value={detailsForm.number_of_doctors}
            onChange={(event) => setDetailsForm((current) => ({ ...current, number_of_doctors: event.target.value }))}
            placeholder="Number of doctors"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={detailsForm.teleconsult_enabled}
              onChange={(event) =>
                setDetailsForm((current) => ({ ...current, teleconsult_enabled: event.target.checked }))
              }
            />
            Teleconsult enabled
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={detailsForm.hospitalization_available}
              onChange={(event) =>
                setDetailsForm((current) => ({ ...current, hospitalization_available: event.target.checked }))
              }
            />
            Hospitalization available
          </label>
        </div>
        <button
          type="button"
          onClick={saveDetails}
          disabled={isPending}
          className="mt-4 rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-5 py-2.5 text-xs font-semibold text-ink"
        >
          Save Details
        </button>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Section 3 – Availability</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <select
            value={newAvailability.day_of_week}
            onChange={(event) =>
              setNewAvailability((current) => ({ ...current, day_of_week: Number(event.target.value) }))
            }
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          >
            {WEEK_DAYS.map((day) => (
              <option key={day.day} value={day.day}>
                {day.label}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={newAvailability.start_time}
            onChange={(event) => setNewAvailability((current) => ({ ...current, start_time: event.target.value }))}
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          />
          <input
            type="time"
            value={newAvailability.end_time}
            onChange={(event) => setNewAvailability((current) => ({ ...current, end_time: event.target.value }))}
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={newAvailability.is_available}
              onChange={(event) =>
                setNewAvailability((current) => ({ ...current, is_available: event.target.checked }))
              }
            />
            Available
          </label>
        </div>
        <button
          type="button"
          onClick={addAvailability}
          disabled={isPending}
          className="mt-4 rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-5 py-2.5 text-xs font-semibold text-ink"
        >
          Add Availability
        </button>

        <ul className="mt-4 grid gap-2 text-sm">
          {dashboard.availability.map((slot) => (
            <li key={slot.id} className="rounded-xl border border-[#f2dfcf] p-3">
              <div className="grid gap-2 sm:grid-cols-4">
                <select
                  value={availabilityDraft[slot.id]?.day_of_week ?? slot.day_of_week}
                  onChange={(event) =>
                    setAvailabilityDraft((current) => ({
                      ...current,
                      [slot.id]: {
                        ...(current[slot.id] ?? {
                          day_of_week: slot.day_of_week,
                          start_time: slot.start_time,
                          end_time: slot.end_time,
                          is_available: slot.is_available,
                        }),
                        day_of_week: Number(event.target.value),
                      },
                    }))
                  }
                  className="rounded-xl border border-[#f2dfcf] px-2 py-2"
                >
                  {WEEK_DAYS.map((day) => (
                    <option key={day.day} value={day.day}>
                      {day.label}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={availabilityDraft[slot.id]?.start_time ?? slot.start_time}
                  onChange={(event) =>
                    setAvailabilityDraft((current) => ({
                      ...current,
                      [slot.id]: {
                        ...(current[slot.id] ?? {
                          day_of_week: slot.day_of_week,
                          start_time: slot.start_time,
                          end_time: slot.end_time,
                          is_available: slot.is_available,
                        }),
                        start_time: event.target.value,
                      },
                    }))
                  }
                  className="rounded-xl border border-[#f2dfcf] px-2 py-2"
                />
                <input
                  type="time"
                  value={availabilityDraft[slot.id]?.end_time ?? slot.end_time}
                  onChange={(event) =>
                    setAvailabilityDraft((current) => ({
                      ...current,
                      [slot.id]: {
                        ...(current[slot.id] ?? {
                          day_of_week: slot.day_of_week,
                          start_time: slot.start_time,
                          end_time: slot.end_time,
                          is_available: slot.is_available,
                        }),
                        end_time: event.target.value,
                      },
                    }))
                  }
                  className="rounded-xl border border-[#f2dfcf] px-2 py-2"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={availabilityDraft[slot.id]?.is_available ?? slot.is_available}
                    onChange={(event) =>
                      setAvailabilityDraft((current) => ({
                        ...current,
                        [slot.id]: {
                          ...(current[slot.id] ?? {
                            day_of_week: slot.day_of_week,
                            start_time: slot.start_time,
                            end_time: slot.end_time,
                            is_available: slot.is_available,
                          }),
                          is_available: event.target.checked,
                        },
                      }))
                    }
                  />
                  Available
                </label>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => saveAvailabilitySlot(slot.id)}
                  className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                >
                  Save Slot
                </button>
                <button
                  type="button"
                  onClick={() => deleteAvailability(slot.id)}
                  className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                >
                  Delete Slot
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Section 4 – Documents</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={newDocument.document_type}
            onChange={(event) => setNewDocument((current) => ({ ...current, document_type: event.target.value }))}
            placeholder="Document type"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          />
          <input
            value={newDocument.document_url}
            onChange={(event) => setNewDocument((current) => ({ ...current, document_url: event.target.value }))}
            placeholder="Document URL"
            className="rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={uploadDocument}
          disabled={isPending}
          className="mt-4 rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-5 py-2.5 text-xs font-semibold text-ink"
        >
          Upload Document
        </button>

        <ul className="mt-4 grid gap-2">
          {dashboard.documents.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-sm text-[#6b6b6b]">No documents uploaded.</li>
          ) : (
            dashboard.documents.map((doc) => (
              <li key={doc.id} className="rounded-xl border border-[#f2dfcf] p-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={documentDraft[doc.id]?.document_type ?? doc.document_type ?? ''}
                    onChange={(event) =>
                      setDocumentDraft((current) => ({
                        ...current,
                        [doc.id]: {
                          document_type: event.target.value,
                          document_url: current[doc.id]?.document_url ?? doc.document_url ?? '',
                        },
                      }))
                    }
                    className="rounded-xl border border-[#f2dfcf] px-3 py-2"
                  />
                  <input
                    value={documentDraft[doc.id]?.document_url ?? doc.document_url ?? ''}
                    onChange={(event) =>
                      setDocumentDraft((current) => ({
                        ...current,
                        [doc.id]: {
                          document_type: current[doc.id]?.document_type ?? doc.document_type ?? '',
                          document_url: event.target.value,
                        },
                      }))
                    }
                    className="rounded-xl border border-[#f2dfcf] px-3 py-2"
                  />
                </div>
                <p className="mt-1 text-xs text-[#6b6b6b]">Verification: {doc.verification_status}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveDocument(doc.id)}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Save Document
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDocument(doc.id)}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Delete Document
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Section 5 – Reviews</h2>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs text-[#6b6b6b]">Filter</label>
          <select
            value={reviewFilter}
            onChange={(event) => setReviewFilter(event.target.value as 'all' | '1' | '2' | '3' | '4' | '5')}
            className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
          >
            <option value="all">All ratings</option>
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </select>
        </div>

        <ul className="mt-4 grid gap-2">
          {reviewsPage.reviews.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-sm text-[#6b6b6b]">No reviews found.</li>
          ) : (
            reviewsPage.reviews.map((review) => (
              <li key={review.id} className="rounded-xl border border-[#f2dfcf] p-3 text-sm">
                <p className="font-semibold text-ink">Rating: {review.rating}/5</p>
                <p className="mt-1 text-[#6b6b6b]">{review.review_text ?? 'No written feedback.'}</p>
                <p className="mt-1 text-xs text-[#6b6b6b]">{new Date(review.created_at).toLocaleString()}</p>
                <p className="mt-1 text-xs text-[#6b6b6b]">Current response: {review.provider_response ?? 'None'}</p>
                <input
                  value={reviewResponses[review.id] ?? ''}
                  onChange={(event) =>
                    setReviewResponses((current) => ({
                      ...current,
                      [review.id]: event.target.value,
                    }))
                  }
                  placeholder="Write response"
                  className="mt-3 w-full rounded-xl border border-[#f2dfcf] px-4 py-2.5 text-sm"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => respondToReview(review.id)}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Submit Response
                  </button>
                  <button
                    type="button"
                    onClick={() => loadResponseHistory(review.id)}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    View History
                  </button>
                </div>
                {responseHistory[review.id]?.length ? (
                  <ul className="mt-2 grid gap-1 text-xs text-[#6b6b6b]">
                    {responseHistory[review.id].map((entry) => (
                      <li key={entry.id}>
                        {new Date(entry.created_at).toLocaleString()} • {entry.previous_response ?? 'No previous response'} → {entry.new_response}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))
          )}
        </ul>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={isPending || reviewsPage.page <= 1}
            onClick={() => fetchReviews(reviewsPage.page - 1, reviewFilter)}
            className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink disabled:opacity-60"
          >
            Previous
          </button>
          <span className="text-xs text-[#6b6b6b]">
            Page {reviewsPage.page} • Total {reviewsPage.total}
          </span>
          <button
            type="button"
            disabled={isPending || !reviewsPage.hasMore}
            onClick={() => fetchReviews(reviewsPage.page + 1, reviewFilter)}
            className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Section 6 – Performance Overview</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-xl border border-[#f2dfcf] p-3">Average Rating: {performanceSummary?.avgRating ?? 0}</div>
          <div className="rounded-xl border border-[#f2dfcf] p-3">Total Bookings: {performanceSummary?.totalBookings ?? 0}</div>
          <div className="rounded-xl border border-[#f2dfcf] p-3">Cancellation Rate: {performanceSummary?.cancellationRate ?? 0}</div>
          <div className="rounded-xl border border-[#f2dfcf] p-3">No-Show Count: {performanceSummary?.noShowCount ?? 0}</div>
          <div className="rounded-xl border border-[#f2dfcf] p-3">Performance Score: {performanceSummary?.performanceScore ?? 0}</div>
          <div className="rounded-xl border border-[#f2dfcf] p-3">Ranking Score: {performanceSummary?.rankingScore ?? 0}</div>
        </div>
        <p className="mt-3 text-xs text-[#6b6b6b]">Account status: {performanceSummary?.accountStatus ?? 'unknown'}</p>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Pricing (View-only for Providers)</h2>
        <ul className="mt-4 grid gap-2 text-sm">
          {dashboard.services.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-[#6b6b6b]">No pricing configured by admin.</li>
          ) : (
            dashboard.services.map((service) => (
              <li key={service.id} className="rounded-xl border border-[#f2dfcf] p-3">
                <p className="font-semibold text-ink">{service.service_type}</p>
                <p className="text-[#6b6b6b]">
                  Base: ₹{service.base_price} • Surge: {service.surge_price ?? 'N/A'} • Commission: {service.commission_percentage ?? 'N/A'}%
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
