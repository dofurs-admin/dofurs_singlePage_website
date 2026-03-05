'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { bookingTimelineLabel } from '@/lib/bookings/timeline';
import type { ProviderDashboard, ProviderReview } from '@/lib/provider-management/types';
import { apiRequest } from '@/lib/api/client';
import { useProviderBookingRealtime, useProviderApprovalRealtime, useOptimisticUpdate } from '@/lib/hooks/useRealtime';
import { cn } from '@/lib/design-system';

// Premium Components
import DashboardPageLayout from './premium/DashboardPageLayout';
import PremiumCard from './premium/PremiumCard';
import StatCard from './premium/StatCard';
import StatusBadge from './premium/StatusBadge';

// UI Components
import { Button, Input, Card, Alert, Badge } from '@/components/ui';

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
  completion_task_status?: 'pending' | 'completed' | null;
  completion_due_at?: string | null;
  completion_completed_at?: string | null;
  completion_feedback_text?: string | null;
  requires_completion_feedback?: boolean;
};

type ProviderBlockedDate = {
  id: string;
  provider_id: number;
  blocked_date: string;
  reason: string | null;
  created_at: string;
};

type ProviderDashboardView =
  | 'overview'
  | 'operations'
  | 'profile';

export default function ProviderDashboardClient({
  initialDashboard,
  view = 'overview',
}: {
  initialDashboard: ProviderDashboard | null;
  view?: ProviderDashboardView;
}) {
  const [dashboard, setDashboard] = useState<ProviderDashboard | null>(initialDashboard);
  const [providerBookings, setProviderBookings] = useState<ProviderBooking[]>([]);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const { performUpdate } = useOptimisticUpdate(providerBookings, setProviderBookings);

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
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'>('all');
  const [blockedDates, setBlockedDates] = useState<ProviderBlockedDate[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState({ blockedDate: '', reason: '' });
  const [completionFeedbackDraft, setCompletionFeedbackDraft] = useState<Record<number, string>>({});

  // Realtime subscriptions
  const refreshBookings = useCallback(async () => {
    if (!dashboard?.provider.id) return;
    try {
      const response = await apiRequest<{ bookings: ProviderBooking[] }>('/api/provider/bookings');
      setProviderBookings(response.bookings ?? []);
    } catch (error) {
      console.error('Failed to refresh bookings:', error);
    }
  }, [dashboard?.provider.id]);

  const refreshDashboard = useCallback(async () => {
    try {
      const response = await providerRequest<ProviderDashboard>('/api/provider/dashboard');
      setDashboard(response);
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    }
  }, []);

  useProviderBookingRealtime(dashboard?.provider.id, refreshBookings);
  useProviderApprovalRealtime(dashboard?.provider.id, refreshDashboard);

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

  const providerRequest = useCallback(async <T,>(path: string, init?: RequestInit, retries = 2): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await apiRequest<T>(path, init);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Request failed');
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
          continue;
        }
      }
    }

    throw lastError ?? new Error('Request failed');
  }, []);

  const fetchReviews = useCallback(async (page: number, filter: 'all' | '1' | '2' | '3' | '4' | '5') => {
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
  }, [providerRequest, showToast]);

  const fetchProviderBookings = useCallback(async (filter: 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show') => {
    const params = new URLSearchParams();
    const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    params.set('fromDate', fromDate);
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
  }, [providerRequest, showToast]);

  const fetchBlockedDates = useCallback(async () => {
    try {
      const response = await providerRequest<{ blockedDates: ProviderBlockedDate[] }>('/api/provider/blocked-dates');
      setBlockedDates(response.blockedDates);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load blocked dates.', 'error');
    }
  }, [providerRequest, showToast]);

  useEffect(() => {
    void fetchReviews(1, reviewFilter);
  }, [fetchReviews, reviewFilter]);

  useEffect(() => {
    void fetchProviderBookings(bookingFilter);
  }, [bookingFilter, fetchProviderBookings]);

  useEffect(() => {
    void fetchBlockedDates();
  }, [fetchBlockedDates]);

  function setProviderBookingStatus(
    bookingId: number,
    status: 'confirmed' | 'completed' | 'no_show' | 'cancelled',
    providerNotes?: string,
    completionFeedback?: string,
  ) {
    // Optimistic update: immediately update booking status
    performUpdate(
      (current) => current.map((booking) => 
        booking.id === bookingId 
          ? {
              ...booking,
              booking_status: status,
              provider_notes: providerNotes ?? booking.provider_notes,
              completion_task_status: status === 'completed' ? 'completed' : booking.completion_task_status,
              completion_completed_at: status === 'completed' ? new Date().toISOString() : booking.completion_completed_at,
              completion_feedback_text:
                status === 'completed' ? (completionFeedback ?? providerNotes ?? booking.completion_feedback_text ?? null) : booking.completion_feedback_text,
              requires_completion_feedback: status === 'completed' ? false : booking.requires_completion_feedback,
            }
          : booking
      ),
      async () => {
        const response = await fetch(`/api/provider/bookings/${bookingId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status, providerNotes, completionFeedback }),
        });

        if (!response.ok) {
          throw new Error('Failed to update booking status');
        }
      },
      () => showToast('Booking updated.', 'success'),
      () => showToast('Unable to update booking status.', 'error'),
    );
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
      <Card>
        <h2 className="text-card-title">Provider Dashboard</h2>
        <p className="mt-3 text-body text-neutral-600">
          Provider profile is not linked yet. Complete onboarding to access dashboard controls.
        </p>
      </Card>
    );
  }

  const dashboardTabs = [
    { id: 'overview', label: 'Overview', href: '/dashboard/provider' },
    { id: 'operations', label: 'Operations', href: '/dashboard/provider?view=operations' },
    { id: 'profile', label: 'Profile Studio', href: '/dashboard/provider?view=profile' },
  ];

  return (
    <DashboardPageLayout
      title="Provider Dashboard"
      description="Manage your bookings, performance, and profile"
      tabs={dashboardTabs}
      activeTab={view}
    >
      <div className="space-y-8">

      {view === 'overview' || view === 'operations' ? (
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-section-title">Booking Command Center</h2>
          <select
            value={bookingFilter}
            onChange={(event) =>
              setBookingFilter(
                event.target.value as 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show',
              )
            }
            className="input-field w-full sm:w-auto"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>

        <Card>
          <div className="space-y-2">
            {providerBookings.length === 0 ? (
              <p className="text-body text-neutral-500 text-center py-6">No bookings in queue</p>
            ) : (
              <>
                {providerBookings.slice(0, 20).map((booking) => (
              <div key={booking.id} className="border-b border-neutral-200/60 pb-4 last:border-b-0 last:pb-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-neutral-900">
                      Booking #{booking.id}
                    </p>
                    <p className="text-sm text-neutral-600">
                      {booking.booking_date} • {booking.start_time} - {booking.end_time}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {booking.service_type ?? 'Service'} • {booking.booking_mode.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {booking.booking_status === 'pending' && (
                      <Alert variant="warning" className="!p-2">
                        Action Needed
                      </Alert>
                    )}
                    <StatusBadge status={booking.booking_status} />
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mb-4">{bookingTimelineLabel(booking.booking_status)}</p>
                <div className="flex flex-wrap gap-2">
                  {booking.booking_status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => setProviderBookingStatus(booking.id, 'confirmed')}
                    >
                      Confirm
                    </Button>
                  )}
                  {booking.booking_status === 'confirmed' && (
                    <>
                      {booking.requires_completion_feedback && (
                        <Input
                          value={completionFeedbackDraft[booking.id] ?? ''}
                          onChange={(event) =>
                            setCompletionFeedbackDraft((current) => ({
                              ...current,
                              [booking.id]: event.target.value,
                            }))
                          }
                          placeholder="Add post-visit feedback before completion"
                          className="min-w-[240px]"
                        />
                      )}
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() =>
                          setProviderBookingStatus(
                            booking.id,
                            'completed',
                            completionFeedbackDraft[booking.id],
                            completionFeedbackDraft[booking.id],
                          )
                        }
                        disabled={booking.requires_completion_feedback && !(completionFeedbackDraft[booking.id] ?? '').trim()}
                      >
                        Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setProviderBookingStatus(booking.id, 'no_show')}
                      >
                        No-show
                      </Button>
                    </>
                  )}
                  {(booking.booking_status === 'pending' || booking.booking_status === 'confirmed') && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setProviderBookingStatus(booking.id, 'cancelled')}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
                ))}
              </>
            )}
          </div>
        </Card>
      </section>
      ) : null}

      {view === 'operations' ? (
      <section className="space-y-6">
        <h2 className="text-section-title">Blocked Dates</h2>
        <Card>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                type="date"
                value={newBlockedDate.blockedDate}
                onChange={(event) => setNewBlockedDate((current) => ({ ...current, blockedDate: event.target.value }))}
                label="Date"
              />
              <Input
                value={newBlockedDate.reason}
                onChange={(event) => setNewBlockedDate((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Reason (optional)"
                label="Reason"
              />
              <div className="flex items-end">
                <Button
                  onClick={addBlockedDate}
                  disabled={isPending}
                  className="w-full"
                >
                  Block Date
                </Button>
              </div>
            </div>

            {blockedDates.length === 0 ? (
              <p className="text-body text-neutral-500 text-center py-6">No blocked dates set</p>
            ) : (
              <div className="space-y-3">
                {blockedDates.map((item) => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border border-neutral-200/60 bg-neutral-50/50">
                    <div>
                      <p className="font-semibold text-neutral-900">{item.blocked_date}</p>
                      <p className="text-sm text-neutral-600 mt-1">{item.reason ?? 'No reason provided'}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeBlockedDate(item.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>
      ) : null}

      {view === 'profile' ? (
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Profile Information</h2>
          <p className="text-muted">Manage your public profile and professional details</p>
        </div>
        
        <Card>
          <div className="space-y-4">
            <Input
              label="Bio"
              value={profileForm.bio}
              onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
              placeholder="Write a brief bio about yourself"
            />
            
            <Input
              label="Profile Photo URL"
              value={profileForm.profile_photo_url}
              onChange={(event) => setProfileForm((current) => ({ ...current, profile_photo_url: event.target.value }))}
              placeholder="https://example.com/photo.jpg"
            />
            
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Years of Experience"
                type="number"
                min={0}
                value={profileForm.years_of_experience}
                onChange={(event) => setProfileForm((current) => ({ ...current, years_of_experience: event.target.value }))}
                placeholder="0"
              />
              
              <Input
                label="Phone Number"
                value={profileForm.phone_number}
                onChange={(event) => setProfileForm((current) => ({ ...current, phone_number: event.target.value }))}
                placeholder="+91 XXXXX XXXXX"
              />
              
              <Input
                label="Email"
                type="email"
                value={profileForm.email}
                onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="your@email.com"
              />
              
              <Input
                label="Service Radius (km)"
                type="number"
                min={0}
                value={profileForm.service_radius_km}
                onChange={(event) => setProfileForm((current) => ({ ...current, service_radius_km: event.target.value }))}
                placeholder="0"
              />
            </div>
            
            <Button onClick={saveProfile} disabled={isPending} className="w-full sm:w-auto">
              Save Profile
            </Button>
          </div>
        </Card>
      </section>
      ) : null}

      {view === 'profile' ? (
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Professional & Clinic Details</h2>
          <p className="text-muted">Add credentials, qualifications, and facility information</p>
        </div>
        
        <Card>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="License Number"
                value={detailsForm.license_number}
                onChange={(event) => setDetailsForm((current) => ({ ...current, license_number: event.target.value }))}
                placeholder="License number"
              />
              <Input
                label="Specialization"
                value={detailsForm.specialization}
                onChange={(event) => setDetailsForm((current) => ({ ...current, specialization: event.target.value }))}
                placeholder="Specialization"
              />
              <Input
                label="Clinic Registration"
                value={detailsForm.registration_number}
                onChange={(event) => setDetailsForm((current) => ({ ...current, registration_number: event.target.value }))}
                placeholder="Registration number"
              />
              <Input
                label="City"
                value={detailsForm.city}
                onChange={(event) => setDetailsForm((current) => ({ ...current, city: event.target.value }))}
                placeholder="City"
              />
              <Input
                label="State"
                value={detailsForm.state}
                onChange={(event) => setDetailsForm((current) => ({ ...current, state: event.target.value }))}
                placeholder="State"
              />
              <Input
                label="Number of Doctors"
                type="number"
                min={0}
                value={detailsForm.number_of_doctors}
                onChange={(event) => setDetailsForm((current) => ({ ...current, number_of_doctors: event.target.value }))}
                placeholder="0"
              />
            </div>
            
            <div className="space-y-3 pt-3 border-t border-neutral-200/60">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={detailsForm.teleconsult_enabled}
                  onChange={(event) =>
                    setDetailsForm((current) => ({ ...current, teleconsult_enabled: event.target.checked }))
                  }
                  className="w-4 h-4 rounded border-neutral-300"
                />
                <span className="text-body">Teleconsult enabled</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={detailsForm.hospitalization_available}
                  onChange={(event) =>
                    setDetailsForm((current) => ({ ...current, hospitalization_available: event.target.checked }))
                  }
                  className="w-4 h-4 rounded border-neutral-300"
                />
                <span className="text-body">Hospitalization available</span>
              </label>
            </div>
            
            <Button onClick={saveDetails} disabled={isPending} className="w-full sm:w-auto mt-4">
              Save Details
            </Button>
          </div>
        </Card>
      </section>
      ) : null}

      {view === 'profile' ? (
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Availability</h2>
          <p className="text-muted">Set your working hours and days</p>
        </div>
        
        <Card>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1">Day</label>
                <select
                  value={newAvailability.day_of_week}
                  onChange={(event) =>
                    setNewAvailability((current) => ({ ...current, day_of_week: Number(event.target.value) }))
                  }
                  className="w-full input-field"
                >
                  {WEEK_DAYS.map((day) => (
                    <option key={day.day} value={day.day}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Start Time"
                type="time"
                value={newAvailability.start_time}
                onChange={(event) => setNewAvailability((current) => ({ ...current, start_time: event.target.value }))}
              />
              <Input
                label="End Time"
                type="time"
                value={newAvailability.end_time}
                onChange={(event) => setNewAvailability((current) => ({ ...current, end_time: event.target.value }))}
              />
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAvailability.is_available}
                    onChange={(event) =>
                      setNewAvailability((current) => ({ ...current, is_available: event.target.checked }))
                    }
                    className="w-4 h-4 rounded border-neutral-300"
                  />
                  <span className="text-sm font-medium text-neutral-700">Available</span>
                </label>
              </div>
            </div>
            
            <Button onClick={addAvailability} disabled={isPending} className="w-full sm:w-auto">
              Add Availability
            </Button>
          </div>
        </Card>

        {dashboard.availability.length > 0 && (
          <Card>
            <div className="space-y-3">
              {dashboard.availability.map((slot) => (
                <div key={slot.id} className="border-b border-neutral-200/60 pb-4 last:border-b-0 last:pb-0">
                  <div className="grid gap-2 sm:grid-cols-4 mb-3">
                    <div>
                      <label className="text-xs font-medium text-neutral-600 block mb-1">Day</label>
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
                        className="input-field w-full text-sm"
                      >
                        {WEEK_DAYS.map((day) => (
                          <option key={day.day} value={day.day}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
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
                      label="Start"
                    />
                    <Input
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
                      label="End"
                    />
                    <label className="flex items-center gap-2 cursor-pointer">
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
                        className="w-4 h-4 rounded border-neutral-300"
                      />
                      <span className="text-sm font-medium text-neutral-700">Available</span>
                    </label>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-neutral-200/60">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => saveAvailabilitySlot(slot.id)}
                    >
                      Save Slot
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => deleteAvailability(slot.id)}
                    >
                      Delete Slot
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
      ) : null}

      {view === 'profile' ? (
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Documents</h2>
          <p className="text-muted">Upload and manage your professional documents</p>
        </div>
        
        <Card>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Document Type"
                value={newDocument.document_type}
                onChange={(event) => setNewDocument((current) => ({ ...current, document_type: event.target.value }))}
                placeholder="License, Insurance, Certification, etc."
              />
              <Input
                label="Document URL"
                value={newDocument.document_url}
                onChange={(event) => setNewDocument((current) => ({ ...current, document_url: event.target.value }))}
                placeholder="https://example.com/document.pdf"
              />
            </div>
            
            <Button onClick={uploadDocument} disabled={isPending} className="w-full sm:w-auto">
              Upload Document
            </Button>
          </div>
        </Card>

        {dashboard.documents.length > 0 && (
          <Card>
            {dashboard.documents.length === 0 ? (
              <p className="text-body text-neutral-500 text-center py-6">No documents uploaded</p>
            ) : (
              <div className="space-y-3">
                {dashboard.documents.map((doc) => (
                  <div key={doc.id} className="border-b border-neutral-200/60 pb-4 last:border-b-0 last:pb-0">
                    <div className="grid gap-3 sm:grid-cols-2 mb-3">
                      <Input
                        label="Type"
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
                      />
                      <Input
                        label="URL"
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
                      />
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-neutral-200/60">
                      <Badge
                        variant={doc.verification_status === 'approved' ? 'success' : doc.verification_status === 'rejected' ? 'error' : 'warning'}
                      >
                        {`Verification: ${doc.verification_status}`}
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveDocument(doc.id)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeDocument(doc.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </section>
      ) : null}

      {view === 'operations' ? (
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Reviews & Feedback</h2>
          <p className="text-muted">Manage customer reviews and build your reputation</p>
        </div>
        
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-neutral-700">Filter by Rating</label>
              <select
                value={reviewFilter}
                onChange={(event) => setReviewFilter(event.target.value as 'all' | '1' | '2' | '3' | '4' | '5')}
                className="input-field"
              >
                <option value="all">All ratings</option>
                <option value="5">5 stars</option>
                <option value="4">4 stars</option>
                <option value="3">3 stars</option>
                <option value="2">2 stars</option>
                <option value="1">1 star</option>
              </select>
            </div>

            {reviewsPage.reviews.length === 0 ? (
              <p className="text-body text-neutral-500 text-center py-6">No reviews found</p>
            ) : (
              <div className="space-y-4">
                {reviewsPage.reviews.map((review) => (
                  <div key={review.id} className="border-b border-neutral-200/60 pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="space-y-1">
                        <Badge variant={review.rating >= 4 ? 'success' : review.rating >= 3 ? 'warning' : 'error'}>
                          {`${review.rating}/5 stars`}
                        </Badge>
                        <p className="text-sm text-neutral-600">{new Date(review.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <p className="text-body mb-3">{review.review_text ?? 'No written feedback'}</p>
                    
                    <div className="space-y-3 p-3 bg-neutral-50/50 rounded-lg mb-3">
                      <p className="text-sm text-neutral-600">
                        <span className="font-medium">Current Response:</span> {review.provider_response ?? 'No response yet'}
                      </p>
                      <Input
                        value={reviewResponses[review.id] ?? ''}
                        onChange={(event) =>
                          setReviewResponses((current) => ({
                            ...current,
                            [review.id]: event.target.value,
                          }))
                        }
                        placeholder="Write your response..."
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => respondToReview(review.id)}
                      >
                        Submit Response
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadResponseHistory(review.id)}
                      >
                        View History
                      </Button>
                    </div>
                    
                    {responseHistory[review.id]?.length ? (
                      <div className="mt-3 space-y-2 text-xs text-neutral-500">
                        {responseHistory[review.id].map((entry) => (
                          <div key={entry.id} className="p-2 bg-neutral-50/50 rounded">
                            {new Date(entry.created_at).toLocaleString()} • Previous: &quot;{entry.previous_response ?? 'None'}&quot; → New: &quot;{entry.new_response}&quot;
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-neutral-200/60">
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending || reviewsPage.page <= 1}
                onClick={() => fetchReviews(reviewsPage.page - 1, reviewFilter)}
              >
                ← Previous
              </Button>
              <span className="text-sm text-neutral-600">
                Page {reviewsPage.page} of {Math.ceil(reviewsPage.total / reviewsPage.pageSize)} • {reviewsPage.total} total
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending || !reviewsPage.hasMore}
                onClick={() => fetchReviews(reviewsPage.page + 1, reviewFilter)}
              >
                Next →
              </Button>
            </div>
          </div>
        </Card>
      </section>
      ) : null}

      {view === 'overview' ? (
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Performance Overview</h2>
          <p className="text-muted">Track your provider metrics and account health</p>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Average Rating"
            value={`${performanceSummary?.avgRating ?? 0}/5`}
            icon="star"
          />
          <StatCard
            label="Total Bookings"
            value={performanceSummary?.totalBookings ?? 0}
            icon="calendar"
          />
          <StatCard
            label="Cancellation Rate"
            value={`${performanceSummary?.cancellationRate ?? 0}%`}
            icon="x-circle"
          />
          <StatCard
            label="No-Show Count"
            value={performanceSummary?.noShowCount ?? 0}
            icon="alert-circle"
          />
          <StatCard
            label="Performance Score"
            value={`${performanceSummary?.performanceScore ?? 0}%`}
            icon="trending-up"
          />
          <StatCard
            label="Ranking Score"
            value={`${performanceSummary?.rankingScore ?? 0}`}
            icon="award"
          />
        </div>

        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700">Account Status:</span>
              <Badge
                variant={
                  performanceSummary?.accountStatus === 'active'
                    ? 'success'
                    : performanceSummary?.accountStatus === 'suspended'
                    ? 'error'
                    : 'warning'
                }
              >
                {performanceSummary?.accountStatus ?? 'unknown'}
              </Badge>
            </div>
          </div>
        </Card>
      </section>
      ) : null}

      {view === 'profile' ? (
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-section-title">Pricing Catalog</h2>
          <p className="text-muted">Your service pricing (managed by administrators)</p>
        </div>
        
        <Card>
          {dashboard.services.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-body text-neutral-500">No pricing configured yet</p>
              <p className="text-muted text-sm mt-1">Administrators will set up your service pricing</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard.services.map((service) => (
                <div key={service.id} className="border-b border-neutral-200/60 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-neutral-900">{service.service_type}</p>
                      <div className="flex gap-4 mt-2 text-sm text-neutral-600">
                        <span>Base: <span className="font-medium text-neutral-900">₹{service.base_price}</span></span>
                        <span>Surge: <span className="font-medium text-neutral-900">{service.surge_price ?? 'N/A'}</span></span>
                        <span>Commission: <span className="font-medium text-neutral-900">{service.commission_percentage ?? 'N/A'}%</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
      ) : null}
      </div>
    </DashboardPageLayout>
  );
}
