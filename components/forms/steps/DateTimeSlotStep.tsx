'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

const LocationPinMap = dynamic(() => import('../LocationPinMap'), { ssr: false });

type Slot = { start_time: string; end_time: string; is_available: boolean };
type SavedAddress = {
  id: string;
  label: 'Home' | 'Office' | 'Other' | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

type SelectableAddress = SavedAddress & {
  phone?: string;
};

interface DateTimeSlotStepProps {
  slots: Slot[];
  selectedDate: string;
  selectedSlot: string;
  bookingMode: 'home_visit' | 'clinic_visit' | 'teleconsult';
  locationAddress: string;
  latitude: string;
  longitude: string;
  savedAddresses: SavedAddress[];
  selectedSavedAddressId: string | null;
  providerNotes: string;
  onDateChange: (date: string) => void;
  onSlotChange: (slot: string) => void;
  onBookingModeChange: (mode: 'home_visit' | 'clinic_visit' | 'teleconsult') => void;
  onLocationChange: (address: string) => void;
  onLatitudeChange: (lat: string) => void;
  onLongitudeChange: (lng: string) => void;
  onSelectSavedAddress: (addressId: string | null) => void;
  onNotesChange: (notes: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

function toMinutes(timeValue: string): number {
  const [hour, minute] = timeValue.split(':').map(Number);
  return hour * 60 + minute;
}

export default function DateTimeSlotStep({
  slots,
  selectedDate,
  selectedSlot,
  bookingMode,
  locationAddress,
  latitude,
  longitude,
  savedAddresses,
  selectedSavedAddressId,
  providerNotes,
  onDateChange,
  onSlotChange,
  onBookingModeChange,
  onLocationChange,
  onLatitudeChange,
  onLongitudeChange,
  onSelectSavedAddress,
  onNotesChange,
  onNext,
  onPrev,
}: DateTimeSlotStepProps) {
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [localAddresses, setLocalAddresses] = useState<SelectableAddress[]>([]);
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLatitude, setNewLatitude] = useState('');
  const [newLongitude, setNewLongitude] = useState('');
  const [currentLatitude, setCurrentLatitude] = useState('');
  const [currentLongitude, setCurrentLongitude] = useState('');
  const [locationSource, setLocationSource] = useState<'none' | 'detected' | 'current' | 'pinned'>('none');
  const [isDetectingAddress, setIsDetectingAddress] = useState(false);
  const [isDetectingCurrentLocation, setIsDetectingCurrentLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const allAddresses = useMemo<SelectableAddress[]>(() => [...localAddresses, ...savedAddresses], [localAddresses, savedAddresses]);

  // Get recommended slots
  const recommendedSlots = useMemo(() => {
    if (slots.length === 0) return [];

    const sorted = [...slots].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
    const fastest = sorted[0];

    const midTime = 13 * 60; // 1 PM
    const mostFlexible = [...sorted].sort((a, b) => {
      const aDiff = Math.abs(toMinutes(a.start_time) - midTime);
      const bDiff = Math.abs(toMinutes(b.start_time) - midTime);
      return aDiff - bDiff;
    })[0];

    const now = new Date();
    const targetDate = selectedDate ? new Date(`${selectedDate}T00:00:00`) : null;

    const best =
      targetDate && now.toDateString() === targetDate.toDateString()
        ? sorted.find((slot) => toMinutes(slot.start_time) >= now.getHours() * 60 + now.getMinutes() + 90) ?? fastest
        : mostFlexible;

    const unique = new Map<string, { time: string; label: string; reason: string }>();

    if (best && !unique.has(best.start_time)) {
      unique.set(best.start_time, {
        time: best.start_time,
        label: 'Best',
        reason: 'Balanced timing',
      });
    }

    if (fastest && !unique.has(fastest.start_time)) {
      unique.set(fastest.start_time, {
        time: fastest.start_time,
        label: 'Earliest',
        reason: 'First available slot',
      });
    }

    if (mostFlexible && !unique.has(mostFlexible.start_time)) {
      unique.set(mostFlexible.start_time, {
        time: mostFlexible.start_time,
        label: 'Flexible',
        reason: 'Mid-day slot',
      });
    }

    return Array.from(unique.values());
  }, [slots, selectedDate]);

  const canProceed = selectedDate && selectedSlot && (bookingMode !== 'home_visit' || (locationAddress.trim() && latitude && longitude));

  useEffect(() => {
    if (!showAddAddressModal) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLatitude(String(position.coords.latitude));
        setCurrentLongitude(String(position.coords.longitude));
      },
      () => {
        setCurrentLatitude('');
        setCurrentLongitude('');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }, [showAddAddressModal]);

  function resetNewAddressForm() {
    setNewAddress('');
    setNewPhone('');
    setNewLatitude('');
    setNewLongitude('');
    setCurrentLatitude('');
    setCurrentLongitude('');
    setLocationSource('none');
    setLocationError(null);
  }

  function openAddAddressModal() {
    onSelectSavedAddress(null);
    setNewAddress(locationAddress);
    setNewLatitude(latitude);
    setNewLongitude(longitude);
    setLocationSource(latitude && longitude ? 'pinned' : 'none');
    setShowAddAddressModal(true);
    setLocationError(null);
  }

  function closeAddAddressModal() {
    setShowAddAddressModal(false);
    setLocationError(null);
  }

  async function detectCoordinatesFromAddress() {
    const normalizedAddress = newAddress.trim();

    if (!normalizedAddress) {
      setLocationError('Enter your address first, then detect location.');
      return;
    }

    setLocationError(null);
    setIsDetectingAddress(true);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(normalizedAddress)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Unable to detect location from this address right now.');
      }

      const result = (await response.json().catch(() => [])) as Array<{ lat?: string; lon?: string }>;
      const match = result[0];

      if (!match?.lat || !match?.lon) {
        throw new Error('We could not match this address. Try a more complete address.');
      }

      if (locationSource !== 'pinned') {
        setNewLatitude(match.lat);
        setNewLongitude(match.lon);
        setLocationSource('detected');
      }
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Unable to detect location from address.');
    } finally {
      setIsDetectingAddress(false);
    }
  }

  async function useCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Location is not supported on this device/browser.');
      return;
    }

    setLocationError(null);
    setIsDetectingCurrentLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = String(position.coords.latitude);
        const lng = String(position.coords.longitude);
        setCurrentLatitude(lat);
        setCurrentLongitude(lng);

        if (locationSource !== 'pinned') {
          setNewLatitude(lat);
          setNewLongitude(lng);
          setLocationSource('current');
        }

        setIsDetectingCurrentLocation(false);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission denied. Please allow location access.'
            : 'Unable to fetch your current location.';
        setLocationError(message);
        setIsDetectingCurrentLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }

  function handleSaveNewAddress() {
    const fullAddress = newAddress.trim();
    const phoneDigits = newPhone.replace(/\D/g, '');

    if (!fullAddress) {
      setLocationError('Please enter full address.');
      return;
    }

    if (phoneDigits.length !== 10) {
      setLocationError('Enter a valid 10-digit phone number.');
      return;
    }

    const effectiveLatitude = locationSource === 'pinned' ? newLatitude : newLatitude || currentLatitude;
    const effectiveLongitude = locationSource === 'pinned' ? newLongitude : newLongitude || currentLongitude;

    if (!effectiveLatitude || !effectiveLongitude) {
      setLocationError('Set your location using current location or by dropping a pin on the map.');
      return;
    }

    const localId = `local-${Date.now()}`;
    const saved: SelectableAddress = {
      id: localId,
      label: null,
      address_line_1: fullAddress,
      address_line_2: null,
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      latitude: Number(effectiveLatitude),
      longitude: Number(effectiveLongitude),
      is_default: false,
      phone: `+91${phoneDigits}`,
    };

    setLocalAddresses((previous) => [saved, ...previous]);

    onSelectSavedAddress(localId);
    onLocationChange(fullAddress);
    onLatitudeChange(effectiveLatitude);
    onLongitudeChange(effectiveLongitude);

    closeAddAddressModal();
    resetNewAddressForm();
  }

  function formatSavedAddress(address: SavedAddress) {
    return [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.pincode,
      address.country,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(', ');
  }

  function handleSelectSavedAddress(address: SavedAddress) {
    const formattedAddress = formatSavedAddress(address);
    onSelectSavedAddress(address.id);
    onLocationChange(formattedAddress);

    if (address.latitude !== null && address.longitude !== null) {
      onLatitudeChange(String(address.latitude));
      onLongitudeChange(String(address.longitude));
      setShowAddAddressModal(false);
      setLocationError(null);
      return;
    }

    onLatitudeChange('');
    onLongitudeChange('');
    setNewAddress(formattedAddress);
    setNewLatitude('');
    setNewLongitude('');
    setLocationSource('none');
    setShowAddAddressModal(true);
    setLocationError('This saved address has no map pin yet. Use current location, detect from address, or drop a pin on map.');
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div>
        <h2 className="text-2xl font-semibold text-neutral-950">Step 3: Select Date & Time</h2>
        <p className="mt-2 text-sm text-neutral-600">Choose when you&apos;d like the service</p>
      </div>

      {/* Address for home visit */}
      {bookingMode === 'home_visit' && (
        <div>
          <label className="block text-sm font-semibold text-neutral-950 mb-3">Service Address</label>
          <div className="mb-3 space-y-2">
            <p className="text-xs font-medium text-neutral-700">Saved addresses</p>
            <div className="flex flex-wrap gap-2">
              {allAddresses.length > 0 ? (
                allAddresses.map((address) => {
                  const isSelected = selectedSavedAddressId === address.id;
                  const chipLabel = address.label ? `${address.label} · ${address.address_line_1}` : address.address_line_1;

                  return (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => handleSelectSavedAddress(address)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        isSelected
                          ? 'border-coral bg-orange-50 text-coral'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-coral'
                      }`}
                    >
                      {chipLabel}
                    </button>
                  );
                })
              ) : (
                <p className="text-xs text-neutral-500">No saved addresses yet.</p>
              )}
              <button
                type="button"
                onClick={openAddAddressModal}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-coral"
              >
                + Add New Address
              </button>
            </div>
          </div>

          {locationAddress && latitude && longitude ? (
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-3">
              <p className="text-sm font-medium text-neutral-950">{locationAddress}</p>
              <p className="text-xs text-neutral-600 mt-1">
                📍 {parseFloat(latitude).toFixed(5)}, {parseFloat(longitude).toFixed(5)}
              </p>
              <button
                type="button"
                onClick={openAddAddressModal}
                className="mt-2 text-xs font-semibold text-coral hover:underline"
              >
                Change address
              </button>
            </div>
          ) : null}

          {showAddAddressModal ? (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
              <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
                  <h3 className="text-base font-semibold text-neutral-950">Add New Address</h3>
                  <button
                    type="button"
                    onClick={closeAddAddressModal}
                    className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 hover:border-coral"
                  >
                    Close
                  </button>
                </div>
                <div className="max-h-[75vh] space-y-4 overflow-y-auto px-5 py-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-neutral-700">Full Address</label>
                    <textarea
                      value={newAddress}
                      onChange={(event) => {
                        setNewAddress(event.target.value);
                        setLocationError(null);
                      }}
                      rows={3}
                      placeholder="Enter full address with landmark"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-coral focus:outline-none"
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void useCurrentLocation()}
                      disabled={isDetectingCurrentLocation}
                      className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-70"
                    >
                      {isDetectingCurrentLocation ? 'Locating…' : 'Use Current Location'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void detectCoordinatesFromAddress()}
                      disabled={isDetectingAddress}
                      className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-70"
                    >
                      {isDetectingAddress ? 'Detecting…' : 'Detect from Address'}
                    </button>
                  </div>

                  <LocationPinMap
                    latitude={newLatitude}
                    longitude={newLongitude}
                    currentLatitude={currentLatitude}
                    currentLongitude={currentLongitude}
                    onChange={(nextLat, nextLng) => {
                      setNewLatitude(String(nextLat));
                      setNewLongitude(String(nextLng));
                      setLocationSource('pinned');
                      setLocationError(null);
                    }}
                  />

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-neutral-700">Phone Number</label>
                    <div className="flex overflow-hidden rounded-lg border border-neutral-200 focus-within:border-coral">
                      <span className="inline-flex items-center bg-neutral-50 px-3 text-sm font-semibold text-neutral-700">+91</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={newPhone}
                        onChange={(event) => {
                          setNewPhone(event.target.value.replace(/\D/g, '').slice(0, 10));
                          setLocationError(null);
                        }}
                        placeholder="9876543210"
                        className="w-full px-3 py-2 text-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  {locationError ? <p className="text-xs text-red-600">{locationError}</p> : null}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={closeAddAddressModal}
                    className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:border-coral"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNewAddress}
                    className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-[#cf8448]"
                  >
                    Save Address
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Date selection */}
      <div>
        <label className="block text-sm font-semibold text-neutral-950 mb-3">Select Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            onDateChange(e.target.value);
            onSlotChange(''); // Reset slot when date changes
          }}
          min={new Date().toISOString().split('T')[0]}
          className="w-full rounded-lg border-2 border-neutral-200 px-4 py-2.5 text-sm focus:border-coral focus:outline-none"
        />
      </div>

      {/* Time slot selection with chips */}
      {selectedDate && (
        <div>
          <label className="block text-sm font-semibold text-neutral-950 mb-3">Available Times</label>

          {/* Recommended slots */}
          {recommendedSlots.length > 0 && (
            <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 p-4">
              <p className="text-xs font-semibold text-neutral-950 mb-2">⭐ Recommended Slots</p>
              <div className="flex flex-wrap gap-2">
                {recommendedSlots.map((rec) => (
                  <button
                    key={`rec-${rec.time}`}
                    onClick={() => onSlotChange(rec.time)}
                    className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                      selectedSlot === rec.time
                        ? 'border-coral bg-white text-coral'
                        : 'border-orange-300 bg-white text-neutral-600 hover:border-coral'
                    }`}
                  >
                    <span className="block font-semibold">{rec.time}</span>
                    <span className="text-[10px] text-neutral-500">{rec.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All available slots */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-600">All Available Slots</p>
            <div className="flex flex-wrap gap-2">
              {slots.length === 0 ? (
                <p className="text-sm text-neutral-500">No slots available for this date</p>
              ) : (
                slots.map((slot) => (
                  <button
                    key={`${slot.start_time}-${slot.end_time}`}
                    onClick={() => onSlotChange(slot.start_time)}
                    disabled={!slot.is_available}
                    className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                      selectedSlot === slot.start_time
                        ? 'border-coral bg-white text-coral'
                        : slot.is_available
                          ? 'border-neutral-200 bg-white text-neutral-600 hover:border-coral'
                          : 'border-neutral-100 bg-neutral-50 text-neutral-400 cursor-not-allowed'
                    }`}
                  >
                    {slot.start_time} - {slot.end_time}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Additional notes */}
      <div>
        <label className="block text-sm font-semibold text-neutral-950 mb-3">Notes for Provider (Optional)</label>
        <textarea
          value={providerNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="E.g., special instructions for your pet, access details, etc."
          className="w-full rounded-lg border-2 border-neutral-200 px-4 py-2.5 text-sm focus:border-coral focus:outline-none"
          rows={3}
        />
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between gap-3 pt-4">
        <button
          onClick={onPrev}
          className="rounded-full border-2 border-neutral-200 px-6 py-2.5 text-sm font-semibold text-neutral-950 transition-all hover:border-coral hover:text-coral"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#cf8448] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue → Review
        </button>
      </div>
    </div>
  );
}
