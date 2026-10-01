/**
 * Honest provider fetch.
 *
 * This is the deliberate replacement for the kind of "stealth" fetching found
 * in other OSINT codebases, where rotating browser User-Agents and forged
 * `X-Forwarded-For` / `X-Real-IP` headers are used to spread load across
 * apparent clients and evade per-IP limits.
 *
 * Signalwatch does the opposite and says who it is. The reasons are not
 * decorative:
 *
 *  - A provider that only answers a disguised client has not consented to
 *    automated access, so data obtained that way has no usable provenance.
 *  - Several providers explicitly ask to be able to identify callers.
 *    Fintraffic's Digitraffic service requires a `Digitraffic-User` header
 *    for exactly this purpose.
 *  - If an adapter stops working once it identifies itself honestly, that is
 *    a rejection signal, not a bug to fix.
 *
 * See `docs/research/source-admission-standard.md`, invariant 3.
 */

/** Identifies this application to providers. Stable and truthful. */
export const SIGNALWATCH_USER_AGENT =
  "Signalwatch/0.1 (+https://github.com/imlochie/globalinsitehub)";

export type ProviderFetchOptions = {
  /** Provider-specific headers the provider's own documentation asks for. */
  headers?: Record<string, string>;
  /** Hard timeout. Providers are volunteers or public agencies; do not hang. */
  timeoutMs?: number;
  /** Accept header; defaults to JSON. */
  accept?: string;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Performs a provider request that identifies Signalwatch.
 *
 * Deliberately omitted: user-agent rotation, forwarded-for spoofing, cookie
 * replay, referer forging, and retry-on-403/429. A 403 or 429 is the provider
 * declining, and the correct response is to back off and surface an honest
 * provider status, never to retry behind a different identity.
 */
export async function providerFetch(
  url: string | URL,
  options: ProviderFetchOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    accept: options.accept ?? "application/json",
    "user-agent": SIGNALWATCH_USER_AGENT,
    ...options.headers,
  };

  return fetch(url, {
    headers,
    redirect: "follow",
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
}

/**
 * Describes a non-OK provider response in terms a user can act on, keeping
 * the distinction between "the provider declined" and "nothing is happening".
 */
export function describeProviderFailure(status: number, providerName: string): string {
  if (status === 401 || status === 403) {
    return `${providerName} declined the request (HTTP ${status}). Signalwatch identifies itself and does not retry behind a different identity.`;
  }
  if (status === 429) {
    return `${providerName} is rate limiting Signalwatch right now (HTTP 429).`;
  }
  return `${providerName} returned HTTP ${status}.`;
}
