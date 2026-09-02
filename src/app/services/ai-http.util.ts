export const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
export const MAX_ATTEMPTS = 2;
export const RETRY_DELAY_MS = 1000;
export const REQUEST_TIMEOUT_MS = 20000;

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export type AiErrorKind = 'no-key' | 'invalid-key' | 'rate-limit' | 'unavailable' | 'blocked' | 'network' | 'unknown';

export class AiProviderError extends Error {
  constructor(message: string, readonly kind: AiErrorKind, readonly provider: string) {
    super(message);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
