import { createHash } from "node:crypto";
import type { CameraRecord } from "@workspace/api-zod";
import { createMemoryCachedCameraProvider } from "./memory-cache";

const PROVIDER_ID = "transport-for-nsw";
const PROVIDER_NAME = "Transport for NSW Live Traffic Cameras";
const CATALOGUE_URL =
  "https://data.nsw.gov.au/data/dataset/2-live-traffic-cameras";
const FEED_URL = "https://data.livetraffic.com/cameras/traffic-cam.json";
const ATTRIBUTION =
  "Transport for NSW, Live Traffic Cameras (Creative Commons Attribution, CC BY).";
const MAX_CATALOGUE_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 9_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
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

function field(
  record: Record<string, unknown>,
  ...aliases: string[]
): unknown {
  const normalizedAliases = new Set(
    aliases.map((alias) => alias.toLowerCase().replace(/[^a-z0-9]/g, "")),
  );
  for (const [key, value] of Object.entries(record)) {
    if (
      normalizedAliases.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""))
    ) {
      return value;
    }
  }
  return undefined;
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

function stableId(sourceId: unknown, sourceUrl: string): string {
  const id = text(sourceId);
  if (id) {
    return `${PROVIDER_ID}-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  }
  const digest = createHash("sha256")
    .update(`${PROVIDER_ID}\n${sourceUrl}`)
    .digest("hex")
    .slice(0, 24);
  return `${PROVIDER_ID}-${digest}`;
}

function cameraFromFeature(value: unknown): CameraRecord | null {
  const feature = asRecord(value);
  if (!feature) return null;
  const properties =
    asRecord(feature.properties) ??
    asRecord(feature.attributes) ??
    feature;
  const geometry = asRecord(feature.geometry);
  const coordinates = Array.isArray(geometry?.coordinates)
    ? geometry.coordinates
    : [];

  const latitude =
    finiteNumber(
      field(
        properties,
        "latitude",
        "lat",
        "gps_latitude",
        "gps_lat",
      ),
    ) ??
    finiteNumber(coordinates[1]);
  const longitude =
    finiteNumber(
      field(
        properties,
        "longitude",
        "lon",
        "lng",
        "gps_longitude",
        "gps_lon",
        "gps_lng",
      ),
    ) ??
    finiteNumber(coordinates[0]);
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

  const sourceUrl = httpUrl(
    field(
      properties,
      "image_url",
      "imageUrl",
      "imageURL",
      "href",
      "image",
      "url",
    ),
  );
  if (!sourceUrl) return null;

  const title = text(
    field(properties, "title", "camera_name", "cameraName", "name"),
  );
  const description = text(
    field(
      properties,
      "view",
      "view_description",
      "viewDescription",
      "camera_view",
      "description",
    ),
  );
  const sourceId =
    field(properties, "camera_id", "cameraId", "cameraID", "id") ??
    feature.id;
  const locality = text(
    field(properties, "locality", "suburb", "suburb_name", "town"),
  );
  const district = text(field(properties, "district", "region"));
  const postcode = text(field(properties, "postcode", "post_code", "postal_code"));
  const urlPath = new URL(sourceUrl).pathname.toLowerCase();
  const format = urlPath.endsWith(".jpg") || urlPath.endsWith(".jpeg")
    ? "JPEG"
    : urlPath.endsWith(".png")
      ? "PNG"
      : urlPath.endsWith(".webp")
        ? "WEBP"
        : null;

  return {
    id: stableId(sourceId, sourceUrl),
    provider: PROVIDER_ID,
    displayName: title ?? description ?? "Transport for NSW traffic camera",
    description,
    country: "Australia",
    countryCode: "AU",
    region: "New South Wales",
    subregion: locality ?? district,
    district,
    locality,
    postcode,
    latitude,
    longitude,
    direction: text(field(properties, "direction")),
    sourceUrl,
    encoding: null,
    format,
    imageUpdateRateMs: null,
    streamKind: "snapshot",
    feedStatus: "not-probed",
    publicAccess: "catalogue-listed",
    attribution: ATTRIBUTION,
    catalogueUrl: CATALOGUE_URL,
  };
}

function parseCatalogue(value: unknown): CameraRecord[] {
  const root = asRecord(value);
  if (!root || !Array.isArray(root.features)) {
    throw new Error("TfNSW response is not a GeoJSON feature collection");
  }
  const rights = asRecord(root.rights);
  const copyright = text(rights?.copyright);
  const licence = httpUrl(rights?.licence);
  if (
    !copyright?.toLowerCase().includes("transport for nsw") ||
    !licence
  ) {
    throw new Error("TfNSW GeoJSON rights metadata is missing or unexpected");
  }

  const records = new Map<string, CameraRecord>();
  for (const feature of root.features) {
    const camera = cameraFromFeature(feature);
    if (camera && !records.has(camera.sourceUrl)) {
      records.set(camera.sourceUrl, camera);
    }
  }
  return [...records.values()].sort(
    (a, b) =>
      (a.locality ?? "").localeCompare(b.locality ?? "") ||
      a.displayName.localeCompare(b.displayName) ||
      a.id.localeCompare(b.id),
  );
}

export const transportForNswProvider = createMemoryCachedCameraProvider({
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
  attribution: ATTRIBUTION,
  catalogueUrl: CATALOGUE_URL,
  availableMessage:
    "The official TfNSW GeoJSON catalogue is available. Camera snapshot reachability is not checked or proxied.",
  describeFailure(error) {
    if (error instanceof Error && error.message.startsWith("HTTP ")) {
      return `The public TfNSW GeoJSON catalogue returned ${error.message}; no image URLs were requested.`;
    }
    return "The public TfNSW camera GeoJSON catalogue could not be loaded; no image URLs were requested.";
  },
  async load(etag) {
    const headers: Record<string, string> = {
      Accept: "application/geo+json, application/json",
    };
    if (etag) headers["If-None-Match"] = etag;

    const response = await fetch(FEED_URL, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 304) {
      return {
        notModified: true,
        etag: response.headers.get("etag") ?? undefined,
      };
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_CATALOGUE_BYTES) {
      throw new Error("TfNSW camera response exceeded the size limit");
    }
    return {
      cameras: parseCatalogue(JSON.parse(body) as unknown),
      etag: response.headers.get("etag") ?? undefined,
    };
  },
});