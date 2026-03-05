type SecurityLogLevel = 'info' | 'warn' | 'error';

type SecurityEvent =
  | 'booking.failure'
  | 'booking.slot_conflict'
  | 'provider.rejection'
  | 'admin.action'
  | 'auth.role_denied';

type SecurityLogPayload = {
  route: string;
  actorId?: string | null;
  actorRole?: string | null;
  targetId?: string | number | null;
  message?: string;
  metadata?: Record<string, unknown>;
};

export function logSecurityEvent(level: SecurityLogLevel, event: SecurityEvent, payload: SecurityLogPayload) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
    return;
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(entry));
    return;
  }

  console.log(JSON.stringify(entry));
}

export function isSlotConflictMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('bookings_overlap') || normalized.includes('slot is no longer available') || normalized.includes('overlap');
}
