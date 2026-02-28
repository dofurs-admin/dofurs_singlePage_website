'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

type Provider = { id: number; name: string; type: string };
type Service = { id: number; provider_id: number; name: string; duration_minutes: number; buffer_minutes: number; price: number };
type Pet = { id: number; name: string };

export default function CustomerBookingFlow() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [slot, setSlot] = useState('');
  const [paymentMode, setPaymentMode] = useState('online');
  const [amount, setAmount] = useState(0);
  const [slots, setSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setIsLoading(true);
      const response = await fetch('/api/bookings/catalog');

      if (!response.ok) {
        if (isMounted) {
          showToast('Sign in to access booking flow.', 'error');
          setIsLoading(false);
        }
        return;
      }

      const payload = (await response.json()) as { providers: Provider[]; services: Service[]; pets: Pet[] };

      if (!isMounted) {
        return;
      }

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
  }, [showToast]);

  const providerServices = useMemo(() => services.filter((service) => service.provider_id === providerId), [services, providerId]);

  useEffect(() => {
    setServiceId(providerServices[0]?.id ?? null);
  }, [providerServices]);

  useEffect(() => {
    const selected = services.find((service) => service.id === serviceId);
    setAmount(selected?.price ?? 0);
  }, [serviceId, services]);

  useEffect(() => {
    if (!providerId || !bookingDate) {
      setSlots([]);
      return;
    }

    let isMounted = true;

    async function loadSlots() {
      const search = new URLSearchParams({
        providerId: String(providerId),
        date: bookingDate,
      });

      if (serviceId) {
        search.set('serviceId', String(serviceId));
      }

      const response = await fetch(`/api/bookings/available-slots?${search.toString()}`);

      if (!response.ok) {
        if (isMounted) {
          showToast('Unable to fetch slots.', 'error');
        }
        return;
      }

      const payload = (await response.json()) as { slots: string[] };
      if (isMounted) {
        setSlots(payload.slots);
        setSlot(payload.slots[0] ?? '');
      }
    }

    loadSlots();

    return () => {
      isMounted = false;
    };
  }, [providerId, bookingDate, serviceId, showToast]);

  function submitBooking() {
    if (!providerId || !serviceId || !petId || !slot) {
      showToast('Complete all booking fields.', 'error');
      return;
    }

    startTransition(async () => {
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          petId,
          serviceId,
          bookingStart: slot,
          paymentMode,
          amount,
        }),
      });

      if (response.status === 409) {
        showToast('Slot already booked. Please pick another slot.', 'error');
        return;
      }

      if (!response.ok) {
        showToast('Booking failed. Please try again.', 'error');
        return;
      }

      showToast('Booking created successfully.', 'success');
    });
  }

  if (isLoading) {
    return <div className="rounded-3xl border border-[#f2dfcf] bg-white p-6 text-sm text-[#6b6b6b]">Loading booking flow...</div>;
  }

  return (
    <div className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md">
      <h3 className="text-lg font-semibold text-ink">Smart Booking Engine</h3>
      <p className="mt-1 text-sm text-[#6b6b6b]">Real-time slot validation with overlap protection.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <select
          value={providerId ?? ''}
          onChange={(event) => setProviderId(Number(event.target.value))}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name} ({provider.type})
            </option>
          ))}
        </select>

        <select
          value={serviceId ?? ''}
          onChange={(event) => setServiceId(Number(event.target.value))}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
        >
          {providerServices.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} - ₹{service.price}
            </option>
          ))}
        </select>

        <select value={petId ?? ''} onChange={(event) => setPetId(Number(event.target.value))} className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm">
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

        <select value={slot} onChange={(event) => setSlot(event.target.value)} className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm sm:col-span-2">
          {slots.length === 0 ? <option value="">No slots available</option> : null}
          {slots.map((slotOption) => (
            <option key={slotOption} value={slotOption}>
              {new Date(slotOption).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </option>
          ))}
        </select>

        <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)} className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm">
          <option value="online">Online</option>
          <option value="cash">Cash</option>
        </select>

        <input
          type="number"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
          className="rounded-xl border border-[#f2dfcf] px-3 py-2 text-sm"
          min={0}
        />
      </div>

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
