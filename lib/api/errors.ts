export type FriendlyApiError = {
  message: string;
  status: number;
  code?: string;
};

function mapKnownMessageToStatus(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('bookings_overlap') || normalized.includes('slot is no longer available')) {
    return { status: 409, message: 'Selected time slot is no longer available.' };
  }

  if (normalized.includes('pet_ownership_invalid')) {
    return { status: 403, message: 'Pet does not belong to this user.' };
  }

  if (normalized.includes('home_visit_location_required')) {
    return { status: 400, message: 'Home visit bookings require address and geo coordinates.' };
  }

  if (normalized.includes('forbidden') || normalized.includes('role_transition_forbidden')) {
    return { status: 403, message: 'You do not have permission to perform this action.' };
  }

  if (normalized.includes('invalid_booking_transition')) {
    return { status: 409, message: 'Invalid booking status transition.' };
  }

  if (normalized.includes('unauthorized')) {
    return { status: 401, message: 'Sign in to continue.' };
  }

  return null;
}

export function toFriendlyApiError(error: unknown, fallbackMessage = 'Something went wrong'): FriendlyApiError {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const mapped = mapKnownMessageToStatus(message);

  if (mapped) {
    return { ...mapped };
  }

  return {
    message: message || fallbackMessage,
    status: 500,
  };
}
