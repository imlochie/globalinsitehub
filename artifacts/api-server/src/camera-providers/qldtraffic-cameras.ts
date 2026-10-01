import { createHash } from "node:crypto";
import type { CameraRecord } from "@workspace/api-zod";
import { createMemoryCachedCameraProvider } from "./memory-cache";
import { classifyViewCapability } from "./view-capability";

/**
 * QLDTraffic traffic and flood cameras (Queensland TMR).
 *
 * This is the one catalogue in the project that documents a viewable image.
 * API specification v1.10 §4.5 defines `image_url` as "The URL to retrieve the
 * most current web camera image (JPEG format)", and §4.9 defines the same for
 * flood cameras. That published guarantee is what makes these `live-image`
 * cameras rather than catalogue entries — nothing is inferred from the shape
 * of a URL.
 *
 * Licence: CC BY 4.0 AU. Access uses the public API key published in
 * specification §2.1.1.1, overridable with QLDTRAFFIC_API_KEY. No account.
 *
 * Signalwatch does not proxy the imagery: the frontend loads `image_url`
 * directly from the provider, so the desktop app never becomes a video relay.
 */
const PROVIDER_ID = "qldtraffic-cameras";
const PROVIDER_NAME = "QLDTraffic cameras (Queensland TMR)";
const WEBCAMS_URL = "https://api.qldtraffic.qld.gov.au/v1/webcams";
const FLOODCAMS_URL = "https://api.qldtraffic.qld.gov.au/v1/floodcams";
/** Published in API specification v1.10 §2.1.1.1 for unregistered developers. */
const PUBLIC_API_KEY = "3e83add325cbb69ac4d8e5bf433d770b";
const ATTRIBUTION =
  "State of Queensland (Department of Transport and Main Roads), QLDTraffic";
const CATALOGUE_URL =
  "https://www.data.qld.gov.au/dataset/131940-traffic-and-travel-information-geojson-api";
const VIEWER_URL = "https://qldtraffic.qld.gov.au/";
const REQUEST_TIMEOUT_MS = 12_000;
/**
 * QLDTraffic states images refresh periodically; the flood camera feed notes
 * "New images available every 15 minutes." Reported as a nominal rate, not a
 * measured one.
 */
const IMAGE_UPDATE_RATE_MS = 15 * 60 * 1000;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isValidCoordinates(lat: number | null, lon: number | null): boolean {
  return (
    lat !== null && lon !== null &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  );
}

function stableId(kind: string, providerCameraId: string): string {
  const digest = createHash("sha256")
    .update(`${PROVIDER_ID}\n${kind}\n${providerCameraId}`)
    .digest("hex")
    .slice(0, 24);
  return `${PROVIDER_ID}-${digest}`;
}

export function parseQldTrafficCameras(
  payload: unknown,
  kind: "webcam" | "floodcam",
): CameraRecord[] {
  const features = asRecord(payload).features;
  if (!Array.isArray(features)) return [];

  const cameras: CameraRecord[] = [];
  const seen = new Set<string>();

  for (const entry of features) {
    const feature = asRecord(entry);
    const properties = asRecord(feature.properties);
    const coordinates = asRecord(feature.geometry).coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;

    const longitude = finite(coordinates[0]);
    const latitude = finite(coordinates[1]);
    if (!isValidCoordinates(latitude, longitude)) continue;

    const rawId = properties.id;
    const providerCameraId =
      typeof rawId === "number" && Number.isFinite(rawId)
        ? String(rawId)
        : text(rawId);
    if (providerCameraId === null) continue;

    const id = stableId(kind, providerCameraId);
    if (seen.has(id)) continue;

    // `image_url` is the documented current-image URL; without it the record
    // is a location and nothing more.
    const imageUrl = text(properties.image_url);
    const classification = classifyViewCapability({
      documentedAs: imageUrl !== null ? "current-image" : "unknown",
      url: imageUrl,
      viewingPageUrl: VIEWER_URL,
    });

    const sourceUrl =
      classification.mediaUrl ?? text(properties.url) ?? VIEWER_URL;
    seen.add(id);

    const description = text(properties.description);

    cameras.push({
      id,
      provider: PROVIDER_ID,
      displayName:
        description ??
        `${kind === "floodcam" ? "Flood camera" : "Traffic camera"} ${providerCameraId}`,
      description:
        kind === "floodcam"
          ? "Flood camera published by QLDTraffic."
          : "Traffic camera published by QLDTraffic.",
      country: "Australia",
      countryCode: "AU",
      region: "Queensland",
      subregion: text(properties.district),
      district: text(properties.district),
      locality: text(properties.locality),
      postcode: text(properties.postcode),
      latitude: latitude as number,
      longitude: longitude as number,
      direction: text(properties.direction),
      sourceUrl,
      encoding: classification.mediaType === "image" ? "JPEG" : null,
      format: classification.mediaType === "image" ? "IMAGE" : null,
      imageUpdateRateMs:
        classification.viewCapability === "live-image"
          ? IMAGE_UPDATE_RATE_MS
          : null,
      streamKind: classification.viewCapability === "live-image" ? "image" : "unknown",
      viewCapability: classification.viewCapability,
      mediaUrl: classification.mediaUrl,
      mediaType: classification.mediaType,
      viewUrl: classification.viewUrl,
      feedStatus: "not-probed",
      publicAccess: "catalogue-listed",
      attribution: ATTRIBUTION,
      catalogueUrl: CATALOGUE_URL,
    } as CameraRecord);
  }

  return cameras;
}

function apiKey(env: NodeJS.ProcessEnv = process.env): string {
  return env.QLDTRAFFIC_API_KEY?.trim() || PUBLIC_API_KEY;
}

async function fetchFeed(
  endpoint: string,
  kind: "webcam" | "floodcam",
): Promise<CameraRecord[]> {
  const url = new URL(endpoint);
  url.searchParams.set("apikey", apiKey());
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "the shared public key is rate limited right now (HTTP 429)"
        : `upstream returned HTTP ${response.status}`,
    );
  }
  return parseQldTrafficCameras(await response.json(), kind);
}

export const qldTrafficCameraProvider = createMemoryCachedCameraProvider({
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
  attribution: ATTRIBUTION,
  catalogueUrl: CATALOGUE_URL,
  availableMessage:
    "QLDTraffic camera catalogue is available. Each camera publishes a current image URL, which the frontend loads directly from the provider; Signalwatch never proxies the imagery.",
  describeFailure: () =>
    "The QLDTraffic camera catalogue could not be loaded; no camera imagery was requested.",
  async load() {
    // Settled independently so one feed failing still yields the other.
    const [webcams, floodcams] = await Promise.allSettled([
      fetchFeed(WEBCAMS_URL, "webcam"),
      fetchFeed(FLOODCAMS_URL, "floodcam"),
    ]);
    const cameras = [
      ...(webcams.status === "fulfilled" ? webcams.value : []),
      ...(floodcams.status === "fulfilled" ? floodcams.value : []),
    ];
    if (cameras.length === 0 && webcams.status === "rejected") {
      throw webcams.reason instanceof Error
        ? webcams.reason
        : new Error(String(webcams.reason));
    }
    return { cameras };
  },
});
