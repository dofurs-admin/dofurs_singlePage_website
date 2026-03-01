export const INACTIVITY_COOKIE_NAME = 'dofurs_last_activity_at';

const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;

function parseIdleTimeoutMinutes(value: string | undefined) {
  if (!value) {
    return DEFAULT_IDLE_TIMEOUT_MINUTES;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_IDLE_TIMEOUT_MINUTES;
  }

  return parsed;
}

export function getInactivityTimeoutMs() {
  const minutes = parseIdleTimeoutMinutes(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES);
  return minutes * 60 * 1000;
}

export function isInactivityExpired(lastActivityAt: number, nowMs = Date.now()) {
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) {
    return false;
  }

  return nowMs - lastActivityAt > getInactivityTimeoutMs();
}
