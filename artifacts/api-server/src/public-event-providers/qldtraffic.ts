import { isValidCoordinates, representativeLocation } from "./geometry";
import type {
  PublicEventCoverage,
  PublicEventImpact,
  PublicEventProviderSnapshot,
  PublicEventRecord,
  PublicEventRoadSummary,
} from "./types";

/**
 * QLDTraffic (Queensland Department of Transport and Main Roads).
 *
 * Licence: CC BY 4.0 AU. API specification v1.10 §2.1: "Use of the data must be
 * in accordance with the Creative Commons Attribution 4.0 Australia
 * (CC BY 4.0 AU) license."
 *
 * Access: no account required. Specification §2.1.1.1 publishes a public API
 * key "available for developers who do not wish to register and receive their
 * own API key". That key is used here by default and can be overridden with
 * QLDTRAFFIC_API_KEY if the operator registers their own.
 *
 * The public key is globally limited to 100 requests/minute **shared across all
 * unregistered users**, so throughput is not guaranteed. Signalwatch makes one
 * server-side request per cache window regardless of how many browsers are
 * connected, which is negligible against that ceiling — but a 429 is still
 * possible and is surfaced honestly rather than shown as "no incidents".
 */
const PROVIDER_ID = "qldtraffic";
const PROVIDER_NAME = "QLDTraffic (Queensland TMR)";
const EVENTS_URL = "https://api.qldtraffic.qld.gov.au/v2/events";
/** Published in API specification v1.10 §2.1.1.1 for unregistered developers. */
const PUBLIC_API_KEY = "3e83add325cbb69ac4d8e5bf433d770b";
const ATTRIBUTION =
  "State of Queensland (Department of Transport and Main Roads), QLDTraffic";
const LICENCE = "CC BY 4.0 AU";
const LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/";
const CATALOGUE_URL =
  "https://www.data.qld.gov.au/dataset/131940-traffic-and-travel-information-geojson-api";
const REQUEST_TIMEOUT_MS = 12_000;

export const qldtrafficCoverage: PublicEventCoverage = {
  scope: "regional",
  regions: ["Queensland road network"],
  note:
    "Current road events on the Queensland network: crashes, hazards, congestion, " +
    "flooding, roadworks and special events. Current conditions only — this is not " +
    "a historical archive, and it covers roads reported to QLDTraffic.",
};

export const qldtrafficProvider = {
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
  attribution: ATTRIBUTION,
  licence: LICENCE,
  licenceUrl: LICENCE_URL,
  catalogueUrl: CATALOGUE_URL,
  coverage: qldtrafficCoverage,
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function date(value: unknown): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    // The spec's example `url` values use http; normalise to https so the
    // client never renders a mixed-content link.
    if (url.protocol === "http:") url.protocol = "https:";
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseImpact(value: unknown): PublicEventImpact | null {
  const impact = asRecord(value);
  const parsed: PublicEventImpact = {
    direction: text(impact.direction),
    towards: text(impact.towards),
    impactType: text(impact.impact_type),
    impactSubtype: text(impact.impact_subtype),
    delay: text(impact.delay),
  };
  return Object.values(parsed).some((entry) => entry !== null) ? parsed : null;
}

function parseRoadSummary(value: unknown): PublicEventRoadSummary | null {
  const summary = asRecord(value);
  const parsed: PublicEventRoadSummary = {
    roadName: text(summary.road_name),
    locality: text(summary.locality),
    postcode: text(summary.postcode),
    localGovernmentArea: text(summary.local_government_area),
    district: text(summary.district),
  };
  return Object.values(parsed).some((entry) => entry !== null) ? parsed : null;
}

/** Builds a label without inventing meaning: source category + road/locality. */
function buildTitle(
  eventType: string,
  roadSummary: PublicEventRoadSummary | null,
): string {
  const place = roadSummary?.roadName ?? roadSummary?.locality ?? null;
  return place ? `${eventType} — ${place}` : eventType;
}

export function parseQldTrafficEvents(
  payload: unknown,
  receivedAt: Date,
): PublicEventRecord[] {
  const features = asRecord(payload).features;
  if (!Array.isArray(features)) return [];

  const records: PublicEventRecord[] = [];
  const seen = new Set<string>();

  for (const entry of features) {
    const feature = asRecord(entry);
    const properties = asRecord(feature.properties);

    const rawId = properties.id;
    const id =
      typeof rawId === "number" && Number.isFinite(rawId)
        ? String(rawId)
        : text(rawId);
    if (!id || seen.has(id)) continue;

    const location = representativeLocation(feature.geometry);
    if (!location || !isValidCoordinates(location.latitude, location.longitude)) {
      continue;
    }

    // Category is the source's own classification, never inferred from text.
    const eventType = text(properties.event_type);
    if (!eventType) continue;
    seen.add(id);

    const roadSummary = parseRoadSummary(properties.road_summary);
    const duration = asRecord(properties.duration);
    const source = asRecord(properties.source);

    records.push({
      id: `${PROVIDER_ID}:${id}`,
      provider: PROVIDER_ID,
      eventType,
      eventSubtype: (() => {
        const subtype = text(properties.event_subtype);
        // The feed uses the literal string "N/A" for "no subtype".
        return subtype && subtype.toUpperCase() !== "N/A" ? subtype : null;
      })(),
      eventDueTo: text(properties.event_due_to),
      title: buildTitle(eventType, roadSummary),
      description: text(properties.description),
      advice: text(properties.advice),
      latitude: location.latitude,
      longitude: location.longitude,
      locationDerived: location.derived,
      locationNote: location.derived
        ? `Representative point averaged from ${location.derivedFrom} describing the affected road segments, not a single published coordinate.`
        : null,
      // The source's own priority label. Not a severity score and never
      // compared with another provider's or a hazard magnitude.
      sourcePriority: text(properties.event_priority),
      status: text(properties.status),
      impact: parseImpact(properties.impact),
      roadSummary,
      publishedAt: date(properties.published),
      lastUpdatedAt: date(properties.last_updated),
      startedAt: date(duration.start),
      endsAt: date(duration.end),
      receivedAt,
      sourceUrl:
        httpUrl(properties.web_link) ??
        httpUrl(properties.url) ??
        "https://qldtraffic.qld.gov.au/",
      // QLDTraffic republishes records from TMR, Transport for NSW and local
      // governments, so the originating body is kept per record.
      suppliedBy:
        text(source.provided_by) ?? text(source.provided_by_url) ?? null,
      attribution: ATTRIBUTION,
      licence: LICENCE,
    });
  }

  return records;
}

export function qldtrafficApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.QLDTRAFFIC_API_KEY?.trim() || PUBLIC_API_KEY;
}

export async function fetchQldTrafficSnapshot(
  receivedAt: Date,
  env: NodeJS.ProcessEnv = process.env,
): Promise<PublicEventProviderSnapshot> {
  const base = {
    ...qldtrafficProvider,
    checkedAt: receivedAt,
  };

  try {
    const url = new URL(EVENTS_URL);
    url.searchParams.set("apikey", qldtrafficApiKey(env));
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      // 403 = invalid key, 429 = rate limited (spec §2.1.2 / §2.1.3). Both are
      // provider conditions and must never read as "no incidents".
      const reason =
        response.status === 403
          ? "the API rejected the access key (HTTP 403)"
          : response.status === 429
            ? "the shared public key is rate limited right now (HTTP 429)"
            : `upstream returned HTTP ${response.status}`;
      return {
        events: [],
        provider: {
          ...base,
          status: "unavailable",
          eventCount: 0,
          message: `${PROVIDER_NAME} could not be read: ${reason}. Queensland road events are missing, not absent.`,
        },
      };
    }

    const events = parseQldTrafficEvents(await response.json(), receivedAt);
    return {
      events,
      provider: {
        ...base,
        status: "available",
        eventCount: events.length,
        message:
          events.length > 0
            ? `${events.length} current Queensland road events received.`
            : "QLDTraffic responded with no current road events.",
      },
    };
  } catch (error) {
    return {
      events: [],
      provider: {
        ...base,
        status: "unavailable",
        eventCount: 0,
        message: `${PROVIDER_NAME} could not be reached: ${
          error instanceof Error ? error.message : "unknown error"
        }. Queensland road events are missing, not absent.`,
      },
    };
  }
}
