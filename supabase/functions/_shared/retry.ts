export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: RetryOptions = {},
): Promise<Response> {
  const { maxRetries = 3, baseDelayMs = 1000 } = opts;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init);

    if (response.ok) return response;

    const retryable = [429, 500, 502, 503, 504].includes(response.status);
    if (!retryable || attempt === maxRetries) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `HTTP ${response.status} after ${attempt + 1} attempt(s): ${body.slice(0, 200)}`,
      );
    }

    let delayMs: number;
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      delayMs = retryAfter ? parseFloat(retryAfter) * 1000 : baseDelayMs * 2 ** attempt;
    } else {
      delayMs = baseDelayMs * 2 ** attempt;
    }

    const jitter = delayMs * (0.75 + Math.random() * 0.5);
    await new Promise((r) => setTimeout(r, jitter));
  }

  throw new Error('unreachable');
}
