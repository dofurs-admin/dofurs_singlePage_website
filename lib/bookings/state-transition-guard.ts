import type { BookingStatus } from './types';

export const BOOKING_STATE_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export type BookingActorRole = 'user' | 'provider' | 'admin' | 'staff';

export const ROLE_ALLOWED_BOOKING_STATUSES: Record<BookingActorRole, BookingStatus[]> = {
  user: ['cancelled'],
  provider: ['confirmed', 'completed', 'cancelled', 'no_show'],
  admin: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'],
  staff: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'],
};

export function canTransitionBookingState(current: BookingStatus, next: BookingStatus) {
  if (current === next) {
    return true;
  }

  return BOOKING_STATE_TRANSITIONS[current].includes(next);
}

export function assertBookingStateTransition(current: BookingStatus, next: BookingStatus) {
  if (!canTransitionBookingState(current, next)) {
    throw new Error(`INVALID_BOOKING_TRANSITION:${current}->${next}`);
  }
}

export function assertRoleCanSetBookingStatus(role: BookingActorRole, next: BookingStatus) {
  if (!ROLE_ALLOWED_BOOKING_STATUSES[role].includes(next)) {
    throw new Error(`ROLE_TRANSITION_FORBIDDEN:${role}->${next}`);
  }
}

export function assertRoleCanCreateBookingForUser(role: BookingActorRole, actorUserId: string, targetUserId: string) {
  if (actorUserId === targetUserId) {
    return;
  }

  if (role !== 'admin' && role !== 'staff' && role !== 'provider') {
    throw new Error(`ROLE_CREATE_FORBIDDEN:${role}`);
  }
}
