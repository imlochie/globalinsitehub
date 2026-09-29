import { createHash } from "node:crypto";
import type {
  CameraProviderStatus,
  CameraRecord,
} from "@workspace/api-zod";
import type {
  CameraProviderAdapter,
  CameraProviderSnapshot,
} from "./types";

const PROVIDER_ID = "opentrafficcammap";
const PROVIDER_NAME = "OpenTrafficCamMap USA";
const CATALOGUE_URL =
  "https://raw.githubusercontent.com/AidanWelch/OpenTrafficCamMap/master/cameras/USA.json";
const ATTRIBUTION =
  "OpenTrafficCamMap USA catalogue, © 2020 AidanWelch, MIT License. Individual camera feed rights and reachability are not verified.";
const CACHE_TTL_MS = 15 * 60_000;
const RETRY_TTL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 9_000;
const MAX_CATALOGUE_BYTES = 8 * 1024 * 1024;

type CachedCatalogue = {
  snapshot: CameraProviderSnapshot;
  refreshAfter: number;
};

let cachedCatalogue: CachedCatalogue | undefined;
let refreshInFlight: Promise<CameraProviderSnapshot> | undefined;
let catalogueEtag: string | undefined;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function finiteNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null &&
    Number.isSafeInteger(parsed) &&
    parsed > 0
    ? parsed
    : null;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function inferStreamKind(
  format: string | null,
  encoding: string | null,
  sourceUrl: string,
  imageUpdateRateMs: number | null,
): CameraRecord["streamKind"] {
  const normalizedFormat = format?.toUpperCase() ?? "";
  const normalizedEncoding = encoding?.toUpperCase() ?? "";

  if (normalizedFormat.includes("IMAGE")) return "image";
  if (
    ["M3U", "M3U8", "M3U9", "HLS", "DASH", "MP4", "MPD", "RTSP", "RTMP"].includes(
      normalizedFormat,
    ) ||
    /\b(H\.?264|AVC|HEVC|H\.?265|VP[89])\b/.test(normalizedEncoding)
  ) {
    return "video";
  }
  if (/\.(jpe?g|png|webp)$/i.test(new URL(sourceUrl).pathname)) {
    return "image";
  }
  if (imageUpdateRateMs !== null) return "image";
  return "unknown";
}

function stableCameraId(sourceUrl: string): string {
  const digest = createHash("sha256")
    .update(`${PROVIDER_ID}\n${sourceUrl}`)
    .digest("hex")
    .slice(0, 24);
  return `otcm-usa-${digest}`;
}

function normalizeCamera(
  value: unknown,
  region: string,
  subregion: string,
): CameraRecord | null {
  const input = asRecord(value);
  if (!input) return null;

  const latitude = finiteNumber(input.latitude);
  const longitude = finiteNumber(input.longitude);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }

  const sourceUrl = httpUrl(input.url);
  if (!sourceUrl) return null;

  const description = text(input.description);
  const encoding = text(input.encoding);
  const format = text(input.format);
  const imageUpdateRateMs = positiveInteger(input.updateRate);
  const displayName =
    description ?? `Camera in ${subregion || region || "United States"}`;

  return {
    id: stableCameraId(sourceUrl),
    provider: PROVIDER_ID,
    displayName,
    description,
    country: "United States",
    countryCode: "US",
    region: region || null,
    subregion: subregion || null,
    latitude,
    longitude,
    direction: text(input.direction),
    sourceUrl,
    encoding,
    format,
    imageUpdateRateMs,
    streamKind: inferStreamKind(
      format,
      encoding,
      sourceUrl,
      imageUpdateRateMs,
    ),
    feedStatus: "not-probed",
    publicAccess: "catalogue-listed",
    attribution: ATTRIBUTION,
    catalogueUrl: CATALOGUE_URL,
  };
}

function completeness(camera: CameraRecord): number {
  return [
    camera.description,
    camera.region,
    camera.subregion,
    camera.direction,
    camera.encoding,
    camera.format,
    camera.imageUpdateRateMs,
  ].filter((value) => value !== null).length;
}

function parseCatalogue(value: unknown): CameraRecord[] {
  const root = asRecord(value);
  if (!root || Object.keys(root).length === 0) {
    throw new Error("Catalogue root is not a populated object");
  }

  const deduplicated = new Map<string, CameraRecord>();
  let recognizedSubregionArrays = 0;

  for (const [regionName, subregionsValue] of Object.entries(root)) {
    const subregions = asRecord(subregionsValue);
    if (!subregions) continue;

    for (const [subregionName, entries] of Object.entries(subregions)) {
      if (!Array.isArray(entries)) continue;
      recognizedSubregionArrays += 1;

      for (const entry of entries) {
        const camera = normalizeCamera(entry, regionName, subregionName);
        if (!camera) continue;

        const existing = deduplicated.get(camera.sourceUrl);
        if (!existing || completeness(camera) > completeness(existing)) {
          deduplicated.set(camera.sourceUrl, camera);
        }
      }
    }
  }

  if (recognizedSubregionArrays === 0) {
    throw new Error("Catalogue does not contain the expected nested camera arrays");
  }

  return [...deduplicated.values()].sort(
    (a, b) =>
      (a.region ?? "").localeCompare(b.region ?? "") ||
      (a.subregion ?? "").localeCompare(b.subregion ?? "") ||
      a.displayName.localeCompare(b.displayName) ||
      a.id.localeCompare(b.id),
  );
}

function buildProviderStatus(
  status: CameraProviderStatus["status"],
  cameraCount: number,
  checkedAt: Date,
  lastSuccessfulFetchAt: Date | null,
  message: string,
): CameraProviderStatus {
  return {
    id: PROVIDER_ID,
    name: PROVIDER_NAME,
    attribution: ATTRIBUTION,
    catalogueUrl: CATALOGUE_URL,
    status,
    feedReachability: "not-probed",
    cameraCount,
    checkedAt,
    lastSuccessfulFetchAt,
    message,
  };
}

async function refreshCatalogue(): Promise<CameraProviderSnapshot> {
  const checkedAt = new Date();

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (catalogueEtag) headers["If-None-Match"] = catalogueEtag;

    const response = await fetch(CATALOGUE_URL, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 304 && cachedCatalogue) {
      const lastSuccessfulFetchAt = checkedAt;
      const snapshot: CameraProviderSnapshot = {
        cameras: cachedCatalogue.snapshot.cameras,
        provider: buildProviderStatus(
          "available",
          cachedCatalogue.snapshot.cameras.length,
          checkedAt,
          lastSuccessfulFetchAt,
          "Catalogue is available. Individual camera feeds and feed reuse rights are not checked or proxied.",
        ),
      };
      cachedCatalogue = {
        snapshot,
        refreshAfter: Date.now() + CACHE_TTL_MS,
      };
      return snapshot;
    }

    if (!response.ok) {
      throw new Error(`Catalogue request returned HTTP ${response.status}`);
    }

    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_CATALOGUE_BYTES) {
      throw new Error("Catalogue response exceeded the size limit");
    }

    const cameras = parseCatalogue(JSON.parse(body) as unknown);
    catalogueEtag = response.headers.get("etag") ?? undefined;
    const snapshot: CameraProviderSnapshot = {
      cameras,
      provider: buildProviderStatus(
        "available",
        cameras.length,
        checkedAt,
        checkedAt,
        "Catalogue is available. Individual camera feeds and feed reuse rights are not checked or proxied.",
      ),
    };
    cachedCatalogue = {
      snapshot,
      refreshAfter: Date.now() + CACHE_TTL_MS,
    };
    return snapshot;
  } catch {
    const previous = cachedCatalogue?.snapshot;
    const stale = previous !== undefined;
    const snapshot: CameraProviderSnapshot = {
      cameras: previous?.cameras ?? [],
      provider: buildProviderStatus(
        stale ? "stale" : "unavailable",
        previous?.cameras.length ?? 0,
        checkedAt,
        previous?.provider.lastSuccessfulFetchAt ?? null,
        stale
          ? "Catalogue refresh failed; returning the last successful metadata snapshot. Individual camera feeds are not probed."
          : "Catalogue is unavailable. No individual camera feed reachability is claimed.",
      ),
    };
    cachedCatalogue = {
      snapshot,
      refreshAfter: Date.now() + RETRY_TTL_MS,
    };
    return snapshot;
  }
}

export const openTrafficCamMapProvider: CameraProviderAdapter = {
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
  attribution: ATTRIBUTION,
  catalogueUrl: CATALOGUE_URL,
  async getSnapshot() {
    if (cachedCatalogue && cachedCatalogue.refreshAfter > Date.now()) {
      return cachedCatalogue.snapshot;
    }
    if (!refreshInFlight) {
      refreshInFlight = refreshCatalogue().finally(() => {
        refreshInFlight = undefined;
      });
    }
    return refreshInFlight;
  },
};