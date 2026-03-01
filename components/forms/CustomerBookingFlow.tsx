'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

type Provider = { id: number; name: string; provider_type?: string | null; type?: string | null };
type Service = {
  id: string;
  provider_id: number;
  service_type: string;
  service_duration_minutes: number;
  buffer_minutes: number;
  base_price: number;
  source: 'provider_services' | 'services';
};
type Pet = { id: number; name: string };
type Slot = { start_time: string; end_time: string; is_available: boolean };
type BookableUser = { id: string; name: string | null; email: string | null };

function toMinutes(timeValue: string) {
  const [hour, minute] = timeValue.split(':').map(Number);
  return hour * 60 + minute;
}

export default function CustomerBookingFlow({ allowBookForUsers = false }: { allowBookForUsers?: boolean }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [bookableUsers, setBookableUsers] = useState<BookableUser[]>([]);
  const [selectedBookingUserId, setSelectedBookingUserId] = useState<string | null>(null);
  const [bookingUserSearch, setBookingUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<BookableUser[]>([]);
  const [hasSearchedUsers, setHasSearchedUsers] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [canBookForUsers, setCanBookForUsers] = useState(false);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('');
  const [bookingMode, setBookingMode] = useState<'home_visit' | 'clinic_visit' | 'teleconsult'>('home_visit');
  const [locationAddress, setLocationAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [providerNotes, setProviderNotes] = useState('');
  const [amount, setAmount] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const showBookForUsers = allowBookForUsers || canBookForUsers;

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setIsLoading(true);
      const searchParams = new URLSearchParams();

      if (selectedBookingUserId) {
        searchParams.set('userId', selectedBookingUserId);
      }

      const response = await fetch(`/api/bookings/catalog${searchParams.toString() ? `?${searchParams.toString()}` : ''}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        if (isMounted) {
          showToast('Sign in to access booking flow.', 'error');
          setIsLoading(false);
        }
        return;
      }

      const payload = (await response.json()) as {
        providers: Provider[];
        services: Service[];
        pets: Pet[];
        canBookForUsers?: boolean;
        bookableUsers?: BookableUser[];
        selectedUserId?: string;
      };

      if (!isMounted) {
        return;
      }

      setCanBookForUsers(Boolean(payload.canBookForUsers));
      setBookableUsers(payload.bookableUsers ?? []);
      setSelectedBookingUserId(payload.selectedUserId ?? null);
      setProviders(payload.providers);
      setServices(payload.services);
      setPets(payload.pets);
      setProviderId(payload.providers[0]?.id ?? null);
      setPetId(payload.pets[0]?.id ?? null);
      setIsLoading(false);
    }

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [selectedBookingUserId, showToast]);

  const providerServices = useMemo(
    () => services.filter((service) => service.provider_id === providerId && service.source === 'provider_services'),
    [services, providerId],
  );

  const selectedBookingUser = useMemo(
    () => bookableUsers.find((item) => item.id === selectedBookingUserId) ?? null,
    [bookableUsers, selectedBookingUserId],
  );

  const recommendationSlots = useMemo(() => {
    if (slots.length === 0) {
      return [] as Array<{ key: string; label: string; reason: string; slot: Slot }>;
    }

    const sorted = [...slots].sort((left, right) => toMinutes(left.start_time) - toMinutes(right.start_time));
    const fastest = sorted[0];

    const midTime = 13 * 60;
    const mostFlexible = [...sorted].sort((left, right) => {
      const leftDiff = Math.abs(toMinutes(left.start_time) - midTime);
      const rightDiff = Math.abs(toMinutes(right.start_time) - midTime);
      return leftDiff - rightDiff;
    })[0];

    const now = new Date();
    const targetDate = bookingDate ? new Date(`${bookingDate}T00:00:00`) : null;

    const best =
      targetDate && now.toDateString() === targetDate.toDateString()
        ? [...sorted].find((slot) => toMinutes(slot.start_time) >= now.getHours() * 60 + now.getMinutes() + 90) ?? fastest
        : mostFlexible;

    const unique = new Map<string, { key: string; label: string; reason: string; slot: Slot }>();

    unique.set(best.start_time, {
      key: `best-${best.start_time}`,
      label: 'Best',
      reason: 'Balanced timing for convenience',
      slot: best,
    });
    unique.set(fastest.start_time, {
      key: `fastest-${fastest.start_time}`,
      label: 'Fastest',
      reason: 'Earliest available start',
      slot: fastest,
    });
    unique.set(mostFlexible.start_time, {
      key: `flex-${mostFlexible.start_time}`,
      label: 'Most flexible',
      reason: 'Mid-day slot with easier adjustments',
      slot: mostFlexible,
    });

    return Array.from(unique.values());
  }, [slots, bookingDate]);

  useEffect(() => {
    setServiceId(providerServices[0]?.id ?? null);
  }, [providerServices]);

  useEffect(() => {
    const selected = services.find((service) => service.id === serviceId);
    setAmount(selected?.base_price ?? 0);
  }, [serviceId, services]);

  useEffect(() => {
    if (!showBookForUsers || !selectedBookingUser) {
      return;
    }

    setSearchResults((current) => {
      if (current.some((item) => item.id === selectedBookingUser.id)) {
        return current;
      }

      return [selectedBookingUser, ...current].slice(0, 25);
    });
  }, [selectedBookingUser, showBookForUsers]);

  async function searchUsers() {
    if (!showBookForUsers) {
      return;
    }

    const query = bookingUserSearch.trim();

    if (query.length < 2) {
      showToast('Enter at least 2 characters to search users.', 'error');
      return;
    }

    setHasSearchedUsers(true);
    setIsSearchingUsers(true);

    try {
      const response = await fetch(`/api/bookings/search-user?query=${encodeURIComponent(query)}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        showToast(payload?.error ?? 'User search failed.', 'error');
        setSearchResults([]);
        return;
      }

      const payload = (await response.json().catch(() => null)) as { users?: BookableUser[] } | null;
      const users = payload?.users ?? [];

      setSearchResults(users);

      if (users.length === 0) {
        showToast('No users found for this search.', 'error');
        return;
      }

      showToast(`${users.length} user${users.length === 1 ? '' : 's'} found.`, 'success');
    } catch {
      setSearchResults([]);
      showToast('User search failed.', 'error');
    } finally {
      setIsSearchingUsers(false);
    }
  }

  useEffect(() => {
    if (!providerId || !bookingDate) {
      setSlots([]);
      return;
    }

    let isMounted = true;

    async function loadSlots() {
      const selectedService = services.find((service) => service.id === serviceId);

      const search = new URLSearchParams({
        providerId: String(providerId),
        date: bookingDate,
      });

      if (serviceId && selectedService?.source === 'provider_services') {
        search.set('providerServiceId', serviceId);
      }

      if (selectedService?.service_duration_minutes) {
        search.set('serviceDurationMinutes', String(selectedService.service_duration_minutes));
      }

      const response = await fetch(`/api/bookings/available-slots?${search.toString()}`);

      if (!response.ok) {
        if (isMounted) {
          showToast('Unable to fetch slots.', 'error');
        }
        return;
      }

      const payload = (await response.json()) as { slots: Slot[] };
      if (isMounted) {
        setSlots(payload.slots);
        setSlotStartTime(payload.slots[0]?.start_time ?? '');
      }
    }

    loadSlots();

    return () => {
      isMounted = false;
    };
  }, [providerId, bookingDate, serviceId, showToast]);

  function submitBooking() {
    const selectedService = services.find((service) => service.id === serviceId);

    if (!providerId || !serviceId || !petId || !slotStartTime || !selectedService) {
      showToast('Complete all booking fields.', 'error');
      return;
    }

    if (selectedService.source !== 'provider_services') {
      showToast('This service is not yet available for the upgraded booking flow.', 'error');
      return;
    }

    if (bookingMode === 'home_visit') {
      if (!locationAddress.trim() || !latitude || !longitude) {
        showToast('Home visit requires address and map coordinates.', 'error');
        return;
      }
    }

    startTransition(async () => {
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          petId,
          providerId,
          providerServiceId: serviceId,
          bookingDate,
          startTime: slotStartTime,
          bookingMode,
          locationAddress: bookingMode === 'home_visit' ? locationAddress.trim() : null,
          latitude: bookingMode === 'home_visit' ? Number(latitude) : null,
          longitude: bookingMode === 'home_visit' ? Number(longitude) : null,
          providerNotes: providerNotes.trim() || null,
          bookingUserId: showBookForUsers ? selectedBookingUserId : undefined,
        }),
      });

      if (response.status === 409) {
        showToast('Slot already booked. Please pick another slot.', 'error');
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        showToast(payload?.error ?? 'Booking failed. Please try again.', 'error');
        return;
      }

      showToast('Booking created successfully.', 'success');
    });
  }

  if (isLoading) {
    return <div className="rounded-3xl border border-[#f2dfcf] bg-white p-6 text-sm text-[#6b6b6b]">Loading booking flow...</div>;
  }

  return (
    <div className="grid gap-4">
      <h3 className="text-lg font-semibold text-ink">Smart Booking Engine</h3>
      <p className="mt-1 text-sm text-[#6b6b6b]">Choose a user (for staff), then provider, service, pet and slot.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {showBookForUsers ? (
          <div className="sm:col-span-2 rounded-xl border border-[#f2dfcf] bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-ink">Book for user</p>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void searchUsers();
              }}
            >
              <input
                value={bookingUserSearch}
                onChange={(event) => setBookingUserSearch(event.target.value)}
                placeholder="Search user by email"
                className="w-full rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={isSearchingUsers}
                className="rounded-full border border-[#f2dfcf] px-4 py-2 text-xs font-semibold text-ink"
              >
                {isSearchingUsers ? 'Searching...' : 'Search'}
              </button>
            </form>
            <div className="mt-2 max-h-44 space-y-1 overflow-auto">
              {isSearchingUsers ? (
                <p className="text-xs text-[#6b6b6b]">Searching users...</p>
              ) : !hasSearchedUsers ? (
                <p className="text-xs text-[#6b6b6b]">Search by email and click Search.</p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-[#6b6b6b]">No users found.</p>
              ) : (
                searchResults.map((bookableUser) => {
                  const label = bookableUser.name?.trim() || bookableUser.email || bookableUser.id;
                  const isSelected = selectedBookingUserId === bookableUser.id;

                  return (
                    <button
                      key={bookableUser.id}
                      type="button"
                      onClick={() => setSelectedBookingUserId(bookableUser.id)}
                      className={`flex w-full items-start justify-between rounded-xl border px-3 py-2 text-left text-xs ${
                        isSelected
                          ? 'border-[#e76f51] bg-[#fff2ea] text-ink'
                          : 'border-[#f2dfcf] bg-[#fffaf6] text-[#6b6b6b]'
                      }`}
                    >
                      <span className="font-medium text-ink">{label}</span>
                      {bookableUser.email ? <span className="ml-3 text-[11px] text-[#7a7a7a]">{bookableUser.email}</span> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        <select
          value={providerId ?? ''}
          onChange={(event) => setProviderId(Number(event.target.value))}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
        >
          {providers.length === 0 ? <option value="">No providers available</option> : null}
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name} ({provider.provider_type ?? provider.type ?? 'provider'})
            </option>
          ))}
        </select>

        <select
          value={serviceId ?? ''}
          onChange={(event) => setServiceId(event.target.value)}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
        >
          {providerServices.length === 0 ? <option value="">No active services</option> : null}
          {providerServices.map((service) => (
            <option key={service.id} value={service.id}>
              {service.service_type} - ₹{service.base_price}
            </option>
          ))}
        </select>

        <select value={petId ?? ''} onChange={(event) => setPetId(Number(event.target.value))} className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm">
          {pets.length === 0 ? <option value="">No pets found for selected user</option> : null}
          {pets.map((pet) => (
            <option key={pet.id} value={pet.id}>
              {pet.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={bookingDate}
          onChange={(event) => setBookingDate(event.target.value)}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
        />

        <select
          value={slotStartTime}
          onChange={(event) => setSlotStartTime(event.target.value)}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm sm:col-span-2"
        >
          {slots.length === 0 ? <option value="">No slots available</option> : null}
          {slots.map((slotOption) => (
            <option key={`${slotOption.start_time}-${slotOption.end_time}`} value={slotOption.start_time}>
              {slotOption.start_time} - {slotOption.end_time}
            </option>
          ))}
        </select>

        <div className="sm:col-span-2 rounded-2xl bg-[#fffaf6] p-3">
          <p className="text-xs font-semibold text-ink">Recommended Slots</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recommendationSlots.length === 0 ? (
              <p className="text-xs text-[#6b6b6b]">Recommendations appear after loading slots.</p>
            ) : (
              recommendationSlots.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSlotStartTime(item.slot.start_time)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs ${
                    slotStartTime === item.slot.start_time
                      ? 'border-[#e76f51] bg-[#fff2ea] text-ink'
                      : 'border-[#f2dfcf] bg-[#fffaf6] text-[#6b6b6b]'
                  }`}
                >
                  <p className="font-semibold text-ink">{item.label}: {item.slot.start_time}-{item.slot.end_time}</p>
                  <p>{item.reason}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <select
          value={bookingMode}
          onChange={(event) => setBookingMode(event.target.value as 'home_visit' | 'clinic_visit' | 'teleconsult')}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
        >
          <option value="home_visit">Home Visit</option>
          <option value="clinic_visit">Clinic Visit</option>
          <option value="teleconsult">Teleconsult</option>
        </select>

        <input
          type="number"
          value={amount}
          readOnly
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
          min={0}
        />

        {bookingMode === 'home_visit' ? (
          <>
            <input
              value={locationAddress}
              onChange={(event) => setLocationAddress(event.target.value)}
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm sm:col-span-2"
              placeholder="Home visit address"
            />
            <input
              type="number"
              step="0.000001"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              placeholder="Latitude"
            />
            <input
              type="number"
              step="0.000001"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
              placeholder="Longitude"
            />
          </>
        ) : null}

        <input
          value={providerNotes}
          onChange={(event) => setProviderNotes(event.target.value)}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm sm:col-span-2"
          placeholder="Booking notes (optional)"
        />
      </div>

      <p className="mt-3 text-xs text-[#6b6b6b]">Payment mode: direct to provider (platform payment not enabled yet).</p>

      <button
        type="button"
        onClick={submitBooking}
        disabled={isPending}
        className="mt-5 inline-flex items-center justify-center rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-6 py-3 text-sm font-semibold text-white transition-all duration-300 ease-out hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Booking...' : 'Create Booking'}
      </button>
    </div>
  );
}
