export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as { error?: unknown; message?: unknown } | null;

  const resolvedErrorMessage = (() => {
    const candidate = payload?.error ?? payload?.message;

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }

    if (candidate && typeof candidate === 'object' && 'message' in candidate) {
      const nestedMessage = (candidate as { message?: unknown }).message;
      if (typeof nestedMessage === 'string' && nestedMessage.trim().length > 0) {
        return nestedMessage.trim();
      }
    }

    return 'Request failed';
  })();

  if (!response.ok) {
    throw new ApiClientError(resolvedErrorMessage, response.status);
  }

  return payload as T;
}
