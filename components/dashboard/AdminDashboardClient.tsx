'use client';

import { useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { bookingTimelineLabel } from '@/lib/bookings/timeline';
import type { AdminProviderModerationItem } from '@/lib/provider-management/types';

type AdminBooking = {
  id: number;
  provider_id: number;
  booking_start: string;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_mode?: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type?: string | null;
};

type Provider = {
  id: number;
  name: string;
};

type AdminProviderDocument = {
  id: string;
  provider_id: number;
  document_type: string | null;
  document_url: string | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

type AdminProviderAvailability = {
  id: string;
  provider_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  slot_duration_minutes?: number;
  buffer_time_minutes?: number;
};

type AdminProviderService = {
  id: string;
  provider_id: number;
  service_type: string;
  base_price: number;
  surge_price: number | null;
  commission_percentage: number | null;
  service_duration_minutes: number | null;
  is_active: boolean;
};

type AdminServicePincode = {
  provider_service_id: string;
  pincode: string;
  is_enabled: boolean;
};

type ServiceRolloutDraft = {
  id?: string;
  service_type: string;
  base_price: string;
  surge_price: string;
  commission_percentage: string;
  service_duration_minutes: string;
  is_active: boolean;
  service_pincodes: string;
};

function groupAvailabilityByProvider(rows: AdminProviderAvailability[]) {
  return rows.reduce<Record<number, AdminProviderAvailability[]>>((accumulator, row) => {
    const current = accumulator[row.provider_id] ?? [];
    current.push(row);
    accumulator[row.provider_id] = current;
    return accumulator;
  }, {});
}

function groupServicesByProvider(rows: AdminProviderService[]) {
  return rows.reduce<Record<number, AdminProviderService[]>>((accumulator, row) => {
    const current = accumulator[row.provider_id] ?? [];
    current.push(row);
    accumulator[row.provider_id] = current;
    return accumulator;
  }, {});
}

function groupPincodesByService(rows: AdminServicePincode[]) {
  return rows.reduce<Record<string, string[]>>((accumulator, row) => {
    if (!row.is_enabled) {
      return accumulator;
    }

    const current = accumulator[row.provider_service_id] ?? [];
    current.push(row.pincode);
    accumulator[row.provider_service_id] = current;
    return accumulator;
  }, {});
}

export default function AdminDashboardClient({
  initialBookings,
  providers,
  moderationProviders,
  providerDocuments,
  initialAvailability,
  initialServices,
  initialServicePincodes,
}: {
  initialBookings: AdminBooking[];
  providers: Provider[];
  moderationProviders: AdminProviderModerationItem[];
  providerDocuments: AdminProviderDocument[];
  initialAvailability: AdminProviderAvailability[];
  initialServices: AdminProviderService[];
  initialServicePincodes: AdminServicePincode[];
}) {
  const providerFallbackRows: AdminProviderModerationItem[] = providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    provider_type: 'clinic',
    business_name: provider.name,
    admin_approval_status: 'pending',
    verification_status: 'pending',
    account_status: 'active',
    average_rating: 0,
    total_bookings: 0,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    documentCounts: {
      pending: 0,
      approved: 0,
      rejected: 0,
    },
  }));

  const [bookings, setBookings] = useState(initialBookings);
  const [providerRows, setProviderRows] = useState(
    moderationProviders.length > 0 ? moderationProviders : providerFallbackRows,
  );
  const [documents, setDocuments] = useState(providerDocuments);
  const [availabilityByProvider, setAvailabilityByProvider] = useState<Record<number, AdminProviderAvailability[]>>(
    () => groupAvailabilityByProvider(initialAvailability),
  );
  const [servicesByProvider, setServicesByProvider] = useState<Record<number, AdminProviderService[]>>(() =>
    groupServicesByProvider(initialServices),
  );
  const [pincodesByService, setPincodesByService] = useState<Record<string, string[]>>(() =>
    groupPincodesByService(initialServicePincodes),
  );
  const [bookingFilter, setBookingFilter] = useState<'all' | 'sla' | 'high-risk'>('all');
  const [selectedBookingIds, setSelectedBookingIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<'confirmed' | 'completed' | 'cancelled' | 'no_show'>('confirmed');
  const [promoteEmail, setPromoteEmail] = useState('');
  const [serviceDraft, setServiceDraft] = useState<Record<number, ServiceRolloutDraft>>({});
  const [availabilityDraft, setAvailabilityDraft] = useState<
    Record<number, { day_of_week: string; start_time: string; end_time: string; is_available: boolean }>
  >({});
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const visibleBookings = useMemo(() => {
    if (bookingFilter === 'all') {
      return bookings;
    }

    if (bookingFilter === 'sla') {
      return bookings.filter((booking) => booking.status === 'pending');
    }

    return bookings.filter((booking) => booking.status === 'no_show' || booking.status === 'cancelled');
  }, [bookings, bookingFilter]);

  const bookingRiskSummary = useMemo(() => {
    return {
      pending: bookings.filter((booking) => booking.status === 'pending').length,
      noShow: bookings.filter((booking) => booking.status === 'no_show').length,
      cancelled: bookings.filter((booking) => booking.status === 'cancelled').length,
    };
  }, [bookings]);

  async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
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
  }

  function overrideStatus(bookingId: number, status: AdminBooking['status']) {
    const previous = bookings;
    setBookings((current) => current.map((booking) => (booking.id === bookingId ? { ...booking, status } : booking)));

    startTransition(async () => {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        setBookings(previous);
        showToast('Override failed.', 'error');
        return;
      }

      showToast('Status overridden.', 'success');
    });
  }

  function toggleBookingSelection(bookingId: number) {
    setSelectedBookingIds((current) =>
      current.includes(bookingId) ? current.filter((id) => id !== bookingId) : [...current, bookingId],
    );
  }

  function applyBulkStatus() {
    if (selectedBookingIds.length === 0) {
      showToast('Select at least one booking first.', 'error');
      return;
    }

    const previous = bookings;
    setBookings((current) =>
      current.map((booking) =>
        selectedBookingIds.includes(booking.id)
          ? {
              ...booking,
              status: bulkStatus,
            }
          : booking,
      ),
    );

    startTransition(async () => {
      try {
        await adminRequest('/api/admin/bookings/bulk-status', {
          method: 'PATCH',
          body: JSON.stringify({
            bookingIds: selectedBookingIds,
            status: bulkStatus,
          }),
        });
        setSelectedBookingIds([]);
        showToast('Bulk status update applied.', 'success');
      } catch (error) {
        setBookings(previous);
        showToast(error instanceof Error ? error.message : 'Bulk update failed.', 'error');
      }
    });
  }

  function promoteUserToRole(role: 'admin' | 'provider') {
    const normalizedEmail = promoteEmail.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showToast('Enter a valid email address.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        await adminRequest<{ success: true; user: { id: string; email: string | null; role: 'admin' | 'provider' } }>(
          '/api/admin/users/promote',
          {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail, role }),
          },
        );
        setPromoteEmail('');
        showToast(`User promoted to ${role}.`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : `Unable to promote user to ${role}.`, 'error');
      }
    });
  }

  function reassignProvider(bookingId: number, providerId: number) {
    const previous = bookings;
    setBookings((current) =>
      current.map((booking) => (booking.id === bookingId ? { ...booking, provider_id: providerId, status: 'pending' } : booking)),
    );

    startTransition(async () => {
      const response = await fetch(`/api/admin/bookings/${bookingId}/reassign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerId }),
      });

      if (!response.ok) {
        setBookings(previous);
        showToast('Reassign failed.', 'error');
        return;
      }

      showToast('Provider reassigned.', 'success');
    });
  }

  function moderateProvider(providerId: number, action: 'approve' | 'reject' | 'suspend' | 'enable') {
    const previous = providerRows;

    setProviderRows((current) =>
      current.map((row) => {
        if (row.id !== providerId) {
          return row;
        }

        if (action === 'approve') {
          return {
            ...row,
            admin_approval_status: 'approved',
            verification_status: 'approved',
            account_status: 'active',
          };
        }

        if (action === 'reject') {
          return {
            ...row,
            admin_approval_status: 'rejected',
            verification_status: 'rejected',
            account_status: 'suspended',
          };
        }

        if (action === 'enable') {
          return {
            ...row,
            account_status: 'active',
          };
        }

        return {
          ...row,
          account_status: 'suspended',
        };
      }),
    );

    startTransition(async () => {
      try {
        await adminRequest(`/api/admin/providers/${providerId}/${action}`, { method: 'POST' });
        showToast(`Provider ${action}d successfully.`, 'success');
      } catch (error) {
        setProviderRows(previous);
        showToast(error instanceof Error ? error.message : `Unable to ${action} provider.`, 'error');
      }
    });
  }

  function verifyProviderDocument(documentId: string, verificationStatus: 'pending' | 'approved' | 'rejected') {
    const previous = documents;

    setDocuments((current) =>
      current.map((doc) => (doc.id === documentId ? { ...doc, verification_status: verificationStatus } : doc)),
    );

    startTransition(async () => {
      try {
        await adminRequest(`/api/admin/provider-documents/${documentId}/verify`, {
          method: 'PATCH',
          body: JSON.stringify({ verificationStatus }),
        });
        showToast('Document verification updated.', 'success');
      } catch (error) {
        setDocuments(previous);
        showToast(error instanceof Error ? error.message : 'Unable to update document verification.', 'error');
      }
    });
  }

  function setServiceDraftField(providerId: number, field: keyof ServiceRolloutDraft, value: string | boolean) {
    setServiceDraft((current) => ({
      ...current,
      [providerId]: {
        id: current[providerId]?.id,
        service_type: current[providerId]?.service_type ?? 'grooming_session',
        base_price: current[providerId]?.base_price ?? '0',
        surge_price: current[providerId]?.surge_price ?? '',
        commission_percentage: current[providerId]?.commission_percentage ?? '',
        service_duration_minutes: current[providerId]?.service_duration_minutes ?? '',
        is_active: current[providerId]?.is_active ?? true,
        service_pincodes: current[providerId]?.service_pincodes ?? '',
        [field]: value,
      },
    }));
  }

  function copyServiceIntoDraft(providerId: number, serviceId: string) {
    const service = (servicesByProvider[providerId] ?? []).find((item) => item.id === serviceId);

    if (!service) {
      return;
    }

    setServiceDraft((current) => ({
      ...current,
      [providerId]: {
        id: service.id,
        service_type: service.service_type,
        base_price: String(service.base_price),
        surge_price: service.surge_price === null ? '' : String(service.surge_price),
        commission_percentage: service.commission_percentage === null ? '' : String(service.commission_percentage),
        service_duration_minutes: service.service_duration_minutes === null ? '' : String(service.service_duration_minutes),
        is_active: service.is_active,
        service_pincodes: (pincodesByService[service.id] ?? []).join(', '),
      },
    }));
  }

  function submitServiceRollout(providerId: number) {
    const draft = serviceDraft[providerId];

    if (!draft || !draft.service_type.trim()) {
      showToast('Provide service details before saving.', 'error');
      return;
    }

    const basePrice = Number(draft.base_price);
    const surgePrice = draft.surge_price.trim() ? Number(draft.surge_price) : null;
    const commission = draft.commission_percentage.trim() ? Number(draft.commission_percentage) : null;
    const serviceDuration = draft.service_duration_minutes.trim() ? Number(draft.service_duration_minutes) : null;

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      showToast('Base price must be a valid non-negative number.', 'error');
      return;
    }

    if (surgePrice !== null && (!Number.isFinite(surgePrice) || surgePrice < 0)) {
      showToast('Surge price must be a valid non-negative number.', 'error');
      return;
    }

    if (commission !== null && (!Number.isFinite(commission) || commission < 0 || commission > 100)) {
      showToast('Commission must be between 0 and 100.', 'error');
      return;
    }

    if (serviceDuration !== null && (!Number.isFinite(serviceDuration) || serviceDuration <= 0)) {
      showToast('Duration must be a positive number.', 'error');
      return;
    }

    const servicePincodes = draft.service_pincodes
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    startTransition(async () => {
      try {
        const response = await adminRequest<{ services: Array<AdminProviderService & { service_pincodes?: string[] }> }>(
          `/api/admin/providers/${providerId}/services`,
          {
            method: 'PUT',
            body: JSON.stringify([
              {
                id: draft.id,
                service_type: draft.service_type.trim(),
                base_price: basePrice,
                surge_price: surgePrice,
                commission_percentage: commission,
                service_duration_minutes: serviceDuration,
                is_active: draft.is_active,
                service_pincodes: servicePincodes,
              },
            ]),
          },
        );

        setServicesByProvider((current) => ({ ...current, [providerId]: response.services }));
        setPincodesByService((current) => {
          const next = { ...current };
          for (const service of response.services) {
            next[service.id] = service.service_pincodes ?? [];
          }
          return next;
        });

        showToast('Service rollout updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update service rollout.', 'error');
      }
    });
  }

  function setAvailabilityDraftField(
    providerId: number,
    field: 'day_of_week' | 'start_time' | 'end_time' | 'is_available',
    value: string | boolean,
  ) {
    setAvailabilityDraft((current) => ({
      ...current,
      [providerId]: {
        day_of_week: current[providerId]?.day_of_week ?? '1',
        start_time: current[providerId]?.start_time ?? '09:00',
        end_time: current[providerId]?.end_time ?? '17:00',
        is_available: current[providerId]?.is_available ?? true,
        [field]: value,
      },
    }));
  }

  function saveAvailability(providerId: number, nextRows: AdminProviderAvailability[]) {
    setAvailabilityByProvider((current) => ({ ...current, [providerId]: nextRows }));

    startTransition(async () => {
      try {
        const response = await adminRequest<{ availability: AdminProviderAvailability[] }>(
          `/api/admin/providers/${providerId}/availability`,
          {
            method: 'PUT',
            body: JSON.stringify(
              nextRows.map((row) => ({
                id: row.id,
                day_of_week: row.day_of_week,
                start_time: row.start_time,
                end_time: row.end_time,
                is_available: row.is_available,
              })),
            ),
          },
        );

        setAvailabilityByProvider((current) => ({ ...current, [providerId]: response.availability }));
        showToast('Availability updated.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to update availability.', 'error');
      }
    });
  }

  function appendAvailabilitySlot(providerId: number) {
    const draft = availabilityDraft[providerId] ?? {
      day_of_week: '1',
      start_time: '09:00',
      end_time: '17:00',
      is_available: true,
    };

    const dayOfWeek = Number(draft.day_of_week);

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      showToast('Day should be between 0 and 6.', 'error');
      return;
    }

    if (!draft.start_time || !draft.end_time || draft.start_time >= draft.end_time) {
      showToast('Provide a valid availability window.', 'error');
      return;
    }

    const current = availabilityByProvider[providerId] ?? [];

    saveAvailability(providerId, [
      ...current,
      {
        id: crypto.randomUUID(),
        provider_id: providerId,
        day_of_week: dayOfWeek,
        start_time: draft.start_time,
        end_time: draft.end_time,
        is_available: draft.is_available,
      },
    ]);
  }

  function toggleAvailabilitySlot(providerId: number, slotId: string, isAvailable: boolean) {
    const current = availabilityByProvider[providerId] ?? [];
    const nextRows = current.map((row) => (row.id === slotId ? { ...row, is_available: isAvailable } : row));
    saveAvailability(providerId, nextRows);
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Admin Access</h2>
        <p className="mt-1 text-xs text-[#6b6b6b]">Promote an existing signed-up user by email.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={promoteEmail}
            onChange={(event) => setPromoteEmail(event.target.value)}
            placeholder="user@example.com"
            className="min-w-[260px] rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() => promoteUserToRole('admin')}
            disabled={isPending}
            className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
          >
            Promote to Admin
          </button>
          <button
            type="button"
            onClick={() => promoteUserToRole('provider')}
            disabled={isPending}
            className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
          >
            Promote to Provider
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md transition-all duration-300 ease-out hover:-translate-y-0.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-ink">All Bookings</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6b6b6b]">Pending SLA: {bookingRiskSummary.pending}</span>
            <span className="text-xs text-[#6b6b6b]">No-show: {bookingRiskSummary.noShow}</span>
            <span className="text-xs text-[#6b6b6b]">Cancelled: {bookingRiskSummary.cancelled}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={bookingFilter}
            onChange={(event) => setBookingFilter(event.target.value as 'all' | 'sla' | 'high-risk')}
            className="rounded-xl border border-[#f2dfcf] px-3 py-1.5 text-[11px]"
          >
            <option value="all">All</option>
            <option value="sla">SLA Queue</option>
            <option value="high-risk">High Risk</option>
          </select>
          <select
            value={bulkStatus}
            onChange={(event) =>
              setBulkStatus(event.target.value as 'confirmed' | 'completed' | 'cancelled' | 'no_show')
            }
            className="rounded-xl border border-[#f2dfcf] px-3 py-1.5 text-[11px]"
          >
            <option value="confirmed">Bulk: Confirmed</option>
            <option value="completed">Bulk: Completed</option>
            <option value="cancelled">Bulk: Cancelled</option>
            <option value="no_show">Bulk: No-show</option>
          </select>
          <button
            type="button"
            onClick={applyBulkStatus}
            disabled={isPending}
            className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
          >
            Apply to Selected ({selectedBookingIds.length})
          </button>
        </div>

        <ul className="mt-4 grid gap-2">
          {visibleBookings.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-sm text-[#6b6b6b]">No bookings found.</li>
          ) : (
            visibleBookings.map((booking) => (
              <li key={booking.id} className="rounded-xl border border-[#f2dfcf] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedBookingIds.includes(booking.id)}
                          onChange={() => toggleBookingSelection(booking.id)}
                        />
                        #{booking.id}
                      </label>
                    </p>
                    <p className="text-xs text-[#6b6b6b]">
                      {booking.booking_date && booking.start_time
                        ? `${booking.booking_date} • ${booking.start_time}${booking.end_time ? ` - ${booking.end_time}` : ''}`
                        : new Date(booking.booking_start).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-[#6b6b6b]">{bookingTimelineLabel(booking.status)}</p>
                    <p className="text-[11px] text-[#6b6b6b]">
                      {(booking.service_type ?? 'Service')} • {(booking.booking_mode ?? 'home_visit').replace('_', ' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {booking.status === 'pending' ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700">
                        SLA
                      </span>
                    ) : null}
                    {(booking.status === 'no_show' || booking.status === 'cancelled') ? (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] text-red-700">
                        High Risk
                      </span>
                    ) : null}
                    <span className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-2.5 py-1 text-[11px] font-medium capitalize text-ink">
                      {booking.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px]"
                    defaultValue={booking.provider_id}
                    onChange={(event) => reassignProvider(booking.id, Number(event.target.value))}
                    disabled={isPending}
                  >
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => overrideStatus(booking.id, 'confirmed')}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Mark Confirmed
                  </button>
                  <button
                    type="button"
                    onClick={() => overrideStatus(booking.id, 'completed')}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Mark Completed
                  </button>
                  <button
                    type="button"
                    onClick={() => overrideStatus(booking.id, 'no_show')}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Mark No-show
                  </button>
                  <button
                    type="button"
                    onClick={() => overrideStatus(booking.id, 'cancelled')}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Mark Cancelled
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Provider Moderation</h2>
        <div className="mt-4 grid gap-3">
          {providerRows.length === 0 ? (
            <p className="text-sm text-[#6b6b6b]">No providers found.</p>
          ) : (
            providerRows.map((provider) => {
              const serviceDraftRow = serviceDraft[provider.id] ?? {
                id: undefined,
                service_type: 'grooming_session',
                base_price: '0',
                surge_price: '',
                commission_percentage: '',
                service_duration_minutes: '60',
                is_active: true,
                service_pincodes: '',
              };
              const providerAvailabilityRows = availabilityByProvider[provider.id] ?? [];
              const providerServicesRows = servicesByProvider[provider.id] ?? [];
              const availabilityRowDraft = availabilityDraft[provider.id] ?? {
                day_of_week: '1',
                start_time: '09:00',
                end_time: '17:00',
                is_available: true,
              };

              return (
                <article key={provider.id} className="rounded-xl border border-[#f2dfcf] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">#{provider.id} • {provider.name}</p>
                      <p className="text-xs text-[#6b6b6b]">
                        Type: {provider.provider_type} • Approval: {provider.admin_approval_status} • Account: {provider.account_status}
                      </p>
                      <p className="text-xs text-[#6b6b6b]">
                        Docs → Pending: {provider.documentCounts.pending} | Approved: {provider.documentCounts.approved} | Rejected: {provider.documentCounts.rejected}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moderateProvider(provider.id, 'approve')}
                        disabled={isPending}
                        className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => moderateProvider(provider.id, 'reject')}
                        disabled={isPending}
                        className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => moderateProvider(provider.id, 'suspend')}
                        disabled={isPending}
                        className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                      >
                        Suspend
                      </button>
                      <button
                        type="button"
                        onClick={() => moderateProvider(provider.id, 'enable')}
                        disabled={isPending}
                        className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                      >
                        Enable
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#f2dfcf] p-3">
                    <p className="text-xs font-semibold text-ink">Availability Control</p>
                    {providerAvailabilityRows.length === 0 ? (
                      <p className="mt-2 text-xs text-[#6b6b6b]">No availability windows configured yet.</p>
                    ) : (
                      <ul className="mt-2 grid gap-2">
                        {providerAvailabilityRows.map((slot) => (
                          <li key={slot.id} className="flex flex-wrap items-center gap-2 text-xs text-[#6b6b6b]">
                            <span>
                              Day {slot.day_of_week} • {slot.start_time} - {slot.end_time}
                            </span>
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={slot.is_available}
                                onChange={(event) => toggleAvailabilitySlot(provider.id, slot.id, event.target.checked)}
                              />
                              Enabled
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <input
                        value={availabilityRowDraft.day_of_week}
                        onChange={(event) => setAvailabilityDraftField(provider.id, 'day_of_week', event.target.value)}
                        placeholder="Day (0-6)"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={availabilityRowDraft.start_time}
                        onChange={(event) => setAvailabilityDraftField(provider.id, 'start_time', event.target.value)}
                        placeholder="Start (HH:MM)"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={availabilityRowDraft.end_time}
                        onChange={(event) => setAvailabilityDraftField(provider.id, 'end_time', event.target.value)}
                        placeholder="End (HH:MM)"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          checked={availabilityRowDraft.is_available}
                          onChange={(event) =>
                            setAvailabilityDraftField(provider.id, 'is_available', event.target.checked)
                          }
                        />
                        Enabled
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => appendAvailabilitySlot(provider.id)}
                      disabled={isPending}
                      className="mt-2 rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                    >
                      Add Availability Slot
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#f2dfcf] p-3">
                    <p className="text-xs font-semibold text-ink">Service & Pincode Rollout</p>
                    {providerServicesRows.length === 0 ? (
                      <p className="mt-2 text-xs text-[#6b6b6b]">No services configured yet.</p>
                    ) : (
                      <ul className="mt-2 grid gap-2">
                        {providerServicesRows.map((service) => (
                          <li key={service.id} className="rounded-lg border border-[#f2dfcf] p-2 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-ink">
                                {service.service_type} • ₹{service.base_price} • {service.is_active ? 'Active' : 'Disabled'}
                              </p>
                              <button
                                type="button"
                                onClick={() => copyServiceIntoDraft(provider.id, service.id)}
                                className="rounded-full border border-[#f2dfcf] px-2.5 py-1 text-[10px] font-semibold text-ink"
                              >
                                Edit
                              </button>
                            </div>
                            <p className="mt-1 text-[11px] text-[#6b6b6b]">
                              Pincodes: {(pincodesByService[service.id] ?? []).join(', ') || 'Not mapped'}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <input
                        value={serviceDraftRow.service_type}
                        onChange={(event) => setServiceDraftField(provider.id, 'service_type', event.target.value)}
                        placeholder="Service type"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={serviceDraftRow.base_price}
                        onChange={(event) => setServiceDraftField(provider.id, 'base_price', event.target.value)}
                        placeholder="Base price"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={serviceDraftRow.surge_price}
                        onChange={(event) => setServiceDraftField(provider.id, 'surge_price', event.target.value)}
                        placeholder="Surge price"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={serviceDraftRow.commission_percentage}
                        onChange={(event) =>
                          setServiceDraftField(provider.id, 'commission_percentage', event.target.value)
                        }
                        placeholder="Commission %"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <input
                        value={serviceDraftRow.service_duration_minutes}
                        onChange={(event) =>
                          setServiceDraftField(provider.id, 'service_duration_minutes', event.target.value)
                        }
                        placeholder="Duration (minutes)"
                        className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                      />
                      <label className="inline-flex items-center gap-2 rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs">
                        <input
                          type="checkbox"
                          checked={serviceDraftRow.is_active}
                          onChange={(event) => setServiceDraftField(provider.id, 'is_active', event.target.checked)}
                        />
                        Service Active
                      </label>
                    </div>
                    <input
                      value={serviceDraftRow.service_pincodes}
                      onChange={(event) => setServiceDraftField(provider.id, 'service_pincodes', event.target.value)}
                      placeholder="Indian pincodes (comma separated)"
                      className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => submitServiceRollout(provider.id)}
                      disabled={isPending}
                      className="mt-2 rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                    >
                      Save Service Rollout
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
        <h2 className="text-xl font-semibold text-ink">Provider Documents</h2>
        <ul className="mt-4 grid gap-2">
          {documents.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#f2dfcf] p-3 text-sm text-[#6b6b6b]">No provider documents found.</li>
          ) : (
            documents.map((document) => (
              <li key={document.id} className="rounded-xl border border-[#f2dfcf] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">Provider #{document.provider_id} • {document.document_type ?? 'Document'}</p>
                    <p className="text-xs text-[#6b6b6b]">{document.document_url ?? 'No URL'}</p>
                  </div>
                  <span className="rounded-full border border-[#f2dfcf] bg-[#fff7f0] px-2.5 py-1 text-[11px] font-medium capitalize text-ink">
                    {document.verification_status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => verifyProviderDocument(document.id, 'approved')}
                    disabled={isPending}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => verifyProviderDocument(document.id, 'rejected')}
                    disabled={isPending}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => verifyProviderDocument(document.id, 'pending')}
                    disabled={isPending}
                    className="rounded-full border border-[#f2dfcf] px-3 py-1.5 text-[11px] font-semibold text-ink"
                  >
                    Mark Pending
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
