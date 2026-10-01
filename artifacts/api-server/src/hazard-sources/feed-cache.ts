/**
 * Shared upstream cache for hazard feeds.
 *
 * USGS and NASA EONET were already being fetched by the briefing route. Rather
 * than poll them a second time for the natural-hazards layer, both routes now
 * read through this single cache: one upstream request per feed per TTL, no
 * matter how many Signalwatch surfaces consume it.
 *
 * Each feed is settled independently so one upstream failing never prevents the
 * other from being served.
 */

import { providerFetch } from "../lib/provider-fetch";

/** USGS magnitude 2.5+ over the past day. Feed is regenerated every minute. */
export const USGS_FEED_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
/** NASA EONET open (currently active) events. */
export const EONET_FEED_URL =
  "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60";
/** NOAA/NWS active alerts. Requires an identifying User-Agent, which
 *  providerFetch supplies. */
export const NWS_FEED_URL =
  "https://api.weather.gov/alerts/active?status=actual&message_type=alert";

/** Matches the briefing cache window and the USGS one-minute regeneration. */
const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 9_000;

export type HazardFeedOutcome =
  | { ok: true; payload: unknown }
  | { ok: false; reason: string };

export type HazardFeeds = {
  fetchedAt: Date;
  usgs: HazardFeedOutcome;
  eonet: HazardFeedOutcome;
  nws: HazardFeedOutcome;
};

let cached: { value: HazardFeeds; expiresAt: number } | undefined;
let inFlight: Promise<HazardFeeds> | undefined;

async function fetchFeed(
  url: string,
  accept = "application/json",
): Promise<HazardFeedOutcome> {
  try {
    // providerFetch identifies Signalwatch, which NWS requires and which the
    // other two providers accept.
    const response = await providerFetch(url, {
      accept,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (!response.ok) {
      return { ok: false, reason: `upstream returned HTTP ${response.status}` };
    }
    return { ok: true, payload: await response.json() };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown error",
    };
  }
}

async function refresh(): Promise<HazardFeeds> {
  const [usgs, eonet, nws] = await Promise.all([
    fetchFeed(USGS_FEED_URL),
    fetchFeed(EONET_FEED_URL),
    fetchFeed(NWS_FEED_URL, "application/geo+json"),
  ]);
  return { fetchedAt: new Date(), usgs, eonet, nws };
}

/** Returns the shared feed snapshot, refreshing at most once per TTL. */
export async function getHazardFeeds(): Promise<HazardFeeds> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (!inFlight) {
    inFlight = refresh()
      .then((value) => {
        cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
        return value;
      })
      .finally(() => {
        inFlight = undefined;
      });
  }
  return inFlight;
}

/** Test seam: drops the cache so a test can control the next fetch. */
export function resetHazardFeedCache(): void {
  cached = undefined;
  inFlight = undefined;
}
