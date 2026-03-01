export const BOOKING_MODES = ['home_visit', 'clinic_visit', 'teleconsult'] as const;
export type BookingMode = (typeof BOOKING_MODES)[number];

export const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookableSlot = {
  start_time: string;
  end_time: string;
  is_available: boolean;
};

export type BookingRecord = {
  id: number;
  user_id: string;
  pet_id: number;
  provider_id: number;
  provider_service_id: string | null;
  service_type: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  booking_mode: BookingMode;
  location_address: string | null;
  latitude: number | null;
  longitude: number | null;
  booking_status: BookingStatus;
  cancellation_reason: string | null;
  cancellation_by: 'user' | 'provider' | 'admin' | null;
  price_at_booking: number;
  admin_price_reference: number;
  provider_notes: string | null;
  internal_notes: string | null;
  payment_mode: 'direct_to_provider' | 'platform' | 'mixed' | string;
  platform_fee: number | null;
  provider_payout_status: 'pending' | 'paid' | 'failed' | 'waived' | null;
  created_at: string;
  updated_at: string;
};

export type CreateBookingInput = {
  petId: number;
  providerId: number;
  providerServiceId: string;
  bookingDate: string;
  startTime: string;
  bookingMode: BookingMode;
  locationAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  providerNotes?: string | null;
};

export type GetAvailableSlotsInput = {
  providerId: number;
  bookingDate: string;
  serviceDurationMinutes?: number;
};

export type ProviderBookingsQuery = {
  status?: BookingStatus;
  fromDate?: string;
  toDate?: string;
  limit?: number;
};

export type OverrideBookingInput = {
  bookingDate?: string;
  startTime?: string;
  endTime?: string;
  bookingMode?: BookingMode;
  locationAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  providerNotes?: string | null;
  internalNotes?: string | null;
  bookingStatus?: BookingStatus;
  cancellationReason?: string | null;
  cancellationBy?: 'user' | 'provider' | 'admin' | null;
  priceAtBooking?: number;
  adminPriceReference?: number;
};