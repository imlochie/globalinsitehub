import { isValidCoordinates, representativeLocation } from "./geometry";
import type {
  PublicEventCoverage,
  PublicEventProviderSnapshot,
  PublicEventRecord,
  PublicEventRoadSummary,
} from "./types";

/**
 * Transport for NSW — Live Traffic Hazards.
 *
 * Licence: CC BY 4.0. The TfNSW Open Data Hub data licence states the data "is
 * licensed under a Creative Commons Attribution 4.0 License" and that the
 * licence "allows for redistribution and reuse of a licensed work on the
 * condition that Transport for NSW is attributed as the source".
 *
 * Access: requires a free Open Data Hub account and an application API key,
 * sent as `Authorization: apikey <key>`. Signalwatch reads it from
 * TFNSW_API_KEY.
 *
 * **No account has been created and no key is invented.** When TFNSW_API_KEY is
 * absent the provider reports `unconfigured` and contributes no records. That
 * is a configuration state, not a failure, and it never prevents Queensland
 * data from being served.
 *
 * Scope note: the live feed carries approximately the last 24 hours. TfNSW's
 * historical reporting omits coordinates, so no historical claim is made here.
 */
const PROVIDER_ID = "tfnsw";
const PROVIDER_NAME = "Transport for NSW Live Traffic";
const HAZARDS_URL =
  "https://api.transport.nsw.gov.au/v1/live/hazards/all/open";
const ATTRIBUTION = "Transport for NSW";
const LICENCE = "CC BY 4.0";
const LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/";
const CATALOGUE_URL =
  "https://opendata.transport.nsw.gov.au/data/dataset/live-traffic-hazards";
const REQUEST_TIMEOUT_MS = 12_000;

export const tfnswCoverage: PublicEventCoverage = {
  scope: "regional",
  regions: ["New South Wales road network"],
  note:
    "Current NSW road events: incidents, fires, floods, alpine conditions, major " +
    "events and roadworks. Current conditions only — the live feed carries roughly " +
    "the last 24 hours and is not a historical archive.",
};

export const tfnswProvider = {
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
  attribution: ATTRIBUTION,
  licence: LICENCE,
  licenceUrl: LICENCE_URL,
  catalogueUrl: CATALOGUE_URL,
  coverage: tfnswCoverage,
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function epochOrIsoDate(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // TfNSW publishes epoch seconds for created/last-updated fields.
    const parsed = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function firstRoad(properties: Record<string, unknown>): PublicEventRoadSummary | null {
  const roads = properties.roads;
  const road = Array.isArray(roads) ? asRecord(roads[0]) : {};
  const parsed: PublicEventRoadSummary = {
    roadName: text(road.mainStreet),
    locality: text(road.suburb),
    postcode: null,
    localGovernmentArea: text(road.region),
    district: text(road.county),
  };
  return Object.values(parsed).some((entry) => entry !== null) ? parsed : null;
}

export function readTfnswApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return env.TFNSW_API_KEY?.trim() || null;
}

export function parseTfnswHazards(
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

    const id = text(feature.id) ?? text(properties.id);
    if (!id || seen.has(id)) continue;

    const location = representativeLocation(feature.geometry);
    if (!location || !isValidCoordinates(location.latitude, location.longitude)) {
      continue;
    }

    // Category is the source's own classification, never inferred from text.
    const eventType = text(properties.displayName) ?? text(properties.mainCategory);
    if (!eventType) continue;
    seen.add(id);

    const roadSummary = firstRoad(properties);
    const place = roadSummary?.roadName ?? roadSummary?.locality ?? null;

    records.push({
      id: `${PROVIDER_ID}:${id}`,
      provider: PROVIDER_ID,
      eventType,
      eventSubtype: text(properties.subCategoryA),
      eventDueTo: null,
      title: place ? `${eventType} — ${place}` : eventType,
      description: text(properties.headline) ?? text(properties.webLinkName),
      advice: text(properties.adviceA) ?? text(properties.adviceB),
      latitude: location.latitude,
      longitude: location.longitude,
      locationDerived: location.derived,
      locationNote: location.derived
        ? `Representative point averaged from ${location.derivedFrom} describing the affected area, not a single published coordinate.`
        : null,
      // TfNSW publishes an "isMajor" flag rather than a priority scale. It is
      // surfaced as the source's own label, not turned into a score.
      sourcePriority: properties.isMajor === true ? "Major" : null,
      status: properties.ended === true ? "Ended" : "Open",
      impact: null,
      roadSummary,
      publishedAt: epochOrIsoDate(properties.created),
      lastUpdatedAt: epochOrIsoDate(properties.lastUpdated),
      startedAt: epochOrIsoDate(properties.start),
      endsAt: epochOrIsoDate(properties.end),
      receivedAt,
      sourceUrl: text(properties.webLinkUrl) ?? "https://livetraffic.com/",
      suppliedBy: text(properties.sourceName),
      attribution: ATTRIBUTION,
      licence: LICENCE,
    });
  }

  return records;
}

export async function fetchTfnswSnapshot(
  receivedAt: Date,
  env: NodeJS.ProcessEnv = process.env,
): Promise<PublicEventProviderSnapshot> {
  const base = { ...tfnswProvider, checkedAt: receivedAt };
  const apiKey = readTfnswApiKey(env);

  if (!apiKey) {
    // Not an error: Signalwatch simply has no NSW credential. Queensland data
    // is unaffected and this state resolves the moment a key is supplied.
    return {
      events: [],
      provider: {
        ...base,
        status: "unconfigured",
        eventCount: 0,
        message:
          "No TFNSW_API_KEY is configured, so New South Wales road events are not retrieved. " +
          "A free Transport for NSW Open Data account supplies this key; other providers are unaffected.",
      },
    };
  }

  try {
    const response = await fetch(HAZARDS_URL, {
      headers: {
        accept: "application/json",
        authorization: `apikey ${apiKey}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const reason =
        response.status === 401 || response.status === 403
          ? `the API rejected the configured key (HTTP ${response.status})`
          : `upstream returned HTTP ${response.status}`;
      return {
        events: [],
        provider: {
          ...base,
          status: "unavailable",
          eventCount: 0,
          message: `${PROVIDER_NAME} could not be read: ${reason}. New South Wales road events are missing, not absent.`,
        },
      };
    }

    const events = parseTfnswHazards(await response.json(), receivedAt);
    return {
      events,
      provider: {
        ...base,
        status: "available",
        eventCount: events.length,
        message:
          events.length > 0
            ? `${events.length} current New South Wales road events received.`
            : "Transport for NSW responded with no current road events.",
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
        }. New South Wales road events are missing, not absent.`,
      },
    };
  }
}
