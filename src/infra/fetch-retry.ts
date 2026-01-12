// src/infra/fetch-retry.ts

export type FetchRetryOptions = {
  /**
   * Number of retries (NOT total attempts).
   * maxRetries=1 => up to 2 total attempts.
   */
  maxRetries?: number;

  /** Delay before first retry */
  initialDelayMs?: number;

  /** Max delay cap */
  maxDelayMs?: number;

  /** Exponential backoff multiplier */
  backoffMultiplier?: number;

  /** Only retry these HTTP statuses */
  retryOnStatus?: number[];

  /**
   * Optional hook for logging/telemetry on each retry decision.
   * Called for both status-based retries and thrown errors.
   */
  onRetry?: (info: {
    attempt: number; // 1-based retry attempt (1..maxRetries)
    maxRetries: number;
    url: string;
    method: string;
    delayMs: number;
    status?: number;
    errorMessage?: string;
  }) => void;
};

const DEFAULTS: Required<Omit<FetchRetryOptions, 'onRetry'>> = {
  maxRetries: 1, // credit-safe default: 1 retry => 2 total attempts
  initialDelayMs: 300,
  maxDelayMs: 1500,
  backoffMultiplier: 2,
  // Transient failures only (safe)
  retryOnStatus: [408, 429, 500, 502, 503, 504],
};

export function createFetchWithRetry(
  baseFetch: typeof fetch = fetch,
  options: FetchRetryOptions = {},
): typeof fetch {
  const opts = { ...DEFAULTS, ...options };

  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const target = typeof window !== 'undefined' ? window : globalThis;
    const boundFetch = baseFetch.bind(target);

    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    const method = (init?.method || 'GET').toUpperCase();

    let lastErr: Error | undefined;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        const res = await boundFetch(input, init);

        const shouldRetry = opts.retryOnStatus.includes(res.status);

        // If not retryable, return immediately
        if (!shouldRetry) return res;

        // If this was the final attempt, return the response we got
        if (attempt === opts.maxRetries) return res;

        const delayMs = calculateDelay(attempt, opts);

        opts.onRetry?.({
          attempt: attempt + 1,
          maxRetries: opts.maxRetries,
          url,
          method,
          delayMs,
          status: res.status,
        });

        await delay(delayMs);
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));

        if (attempt === opts.maxRetries) throw lastErr;

        const delayMs = calculateDelay(attempt, opts);

        opts.onRetry?.({
          attempt: attempt + 1,
          maxRetries: opts.maxRetries,
          url,
          method,
          delayMs,
          errorMessage: lastErr.message,
        });

        await delay(delayMs);
      }
    }

    throw lastErr || new Error('Fetch failed after retries');
  };
}

function calculateDelay(
  attempt: number,
  opts: Required<Omit<FetchRetryOptions, 'onRetry'>>,
): number {
  // attempt=0 => initialDelayMs
  const exp = opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt);
  return Math.min(exp, opts.maxDelayMs);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
