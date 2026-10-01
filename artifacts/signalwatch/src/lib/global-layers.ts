/**
 * Global Layer Engine — normalized observations.
 *
 * Provider records (camera catalogue rows, briefing events, future feeds) are
 * normalized by a `LayerProviderAdapter` into observations that all share a
 * common base shape. Everything downstream (selection, sampling, globe/map
 * rendering, the inspector) works against that base shape plus the layer's
 * registry definition — not against camera/event specific unions.
 */
import type {
  CameraProviderStatus,
  CameraRecord,
  HazardRecord,
  HazardSourceStatus,
  MaritimeProviderStatus,
  PublicEventProviderStatus,
  PublicEventRecord,
  VesselRecord,
} from "@workspace/api-client-react";
import type { BriefingEvent } from "@/lib/monitoring";
import {
  layerProviderIdsForCountry,
  layerRegistry,
  type LayerDefinition,
  type LayerId,
  type LayerRegistry,
} from "@/lib/layer-registry";

export { MAX_GLOBE_CAMERA_MARKERS } from "@/lib/layer-registry";

/** Stable cross-surface identity of a single record. */
export type ObservationIdentity = {
  layerId: LayerId;
  id: string;
};

/** Provenance shared by every layer. Never flattened away by normalizers. */
export type ObservationProvenance = {
  /** Provider/source id the record came from (used by balanced sampling). */
  providerId: string;
  /** Human readable provider/source name. */
  providerName: string;
  /** Original record URL published by the provider. */
  sourceUrl: string;
  /** Rights/licence/attribution string, when the provider supplies one. */
  attribution: string | null;
  /** Provider catalogue/landing page, when one exists. */
  catalogueUrl: string | null;
  /**
   * Provider health, when the provider reports it. Shared UI only reads the
   * fields every provider status has in common (`status`, `message`).
   */
  providerStatus:
    | CameraProviderStatus
    | MaritimeProviderStatus
    | HazardSourceStatus
    | PublicEventProviderStatus
    | null;
};

/**
 * Base observation. `TLayerId`/`TKind` keep the concrete layer observations a
 * discriminated union while shared code can accept `BaseObservation`.
 */
export type BaseObservation<
  TLayerId extends LayerId = LayerId,
  TKind extends string = string,
> = ObservationProvenance & {
  layerId: TLayerId;
  kind: TKind;
  id: string;
  /** `${layerId}:${id}` — stable React key and cross-surface comparison key. */
  key: string;
  latitude: number;
  longitude: number;
  label: string;
  /** When the record was observed/published, when the layer has a notion of it. */
  observedAt: string | null;
  /** Short supporting text shown by generic renderers. */
  detail: string | null;
};

export type CameraObservation = BaseObservation<"cameras", "camera"> & {
  record: CameraRecord;
};

/**
 * A civic incident published by a road/transport authority.
 *
 * `eventType` is the category the source assigned — never inferred from
 * wording, so a record whose description mentions flooding is still a civic
 * incident and not a natural hazard. `sourcePriority` is the source's own
 * label and is deliberately not a score: it is never ranked against another
 * provider's priorities or against a hazard magnitude.
 */
export type PublicEventObservation = BaseObservation<
  "public-events",
  "public-event"
> & {
  eventType: string;
  eventSubtype: string | null;
  sourcePriority: string | null;
  status: string | null;
  /** True when the coordinate was averaged from a multi-segment geometry. */
  locationDerived: boolean;
  locationNote: string | null;
  /** When the Signalwatch API server received this record. */
  receivedAt: string;
  licence: string;
  record: PublicEventRecord;
};

/**
 * One vessel position.
 *
 * `observedAt` carries the provider's own position time and is null when the
 * provider did not supply one — the Signalwatch receipt time is kept separately
 * in `receivedAt` and is never promoted into `observedAt`. Optional AIS fields
 * are absent rather than zeroed, and nothing about the vessel's purpose is
 * inferred: `shipTypeLabel` restates the vessel's own AIS self-report.
 */
export type MaritimeObservation = BaseObservation<"maritime", "vessel"> & {
  mmsi: string;
  /** When the Signalwatch API server received this record. */
  receivedAt: string;
  /** Freshness verdict at normalization time. */
  freshness: VesselFreshness;
  licence: string;
  record: VesselRecord;
};

/** Union of the layers currently implemented in production. */
/**
 * A natural hazard observation.
 *
 * Optional fields exist only where a source genuinely publishes them, and each
 * one keeps its provider meaning: `magnitudeValue` is always paired with the
 * `magnitudeUnit` naming its scale, because an earthquake magnitude and a
 * wildfire acreage are not points on one severity ladder. No severity index is
 * synthesised, and the untouched provider record travels with the observation.
 */
export type NaturalHazardObservation = BaseObservation<
  "natural-hazards",
  "natural-hazard"
> & {
  /** Category as classified by the source. Never inferred from the title. */
  hazardType: string;
  /** When the Signalwatch API server received this record. */
  receivedAt: string;
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  magnitudeDescription: string | null;
  depthKm: number | null;
  /** Source-declared activity state, where the source documents one. */
  activityStatus: "open" | "closed" | null;
  /** Provider review state, e.g. USGS "automatic" / "reviewed". */
  reviewStatus: string | null;
  /** The source's own severity label. Never ranked or compared. */
  sourceSeverity: string | null;
  place: string | null;
  licence: string;
  record: HazardRecord;
};

export type GlobalObservation =
  | CameraObservation
  | PublicEventObservation
  | MaritimeObservation
  | NaturalHazardObservation;

/** Adapter turning one provider's records into one layer's observations. */
export type LayerProviderAdapter<
  TRecord,
  TObservation extends BaseObservation,
> = {
  layerId: TObservation["layerId"];
  providerId(record: TRecord): string;
  normalize(record: TRecord): TObservation | null;
};

export function observationKey(layerId: LayerId, id: string): string {
  return `${String(layerId)}:${id}`;
}

export function isValidCoordinates(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/* -------------------------------------------------------------------------- */
/* Generic layer selection                                                    */
/* -------------------------------------------------------------------------- */

/** Enablement map keyed by layer id. Missing entries are treated as disabled. */
export type LayerEnablement = Readonly<Record<string, boolean>>;

export function isLayerEnabled(
  enablement: LayerEnablement,
  layerId: LayerId,
): boolean {
  return enablement[layerId] === true;
}

export function selectEnabledLayerObservations<T extends BaseObservation>(
  observations: readonly T[],
  enablement: LayerEnablement,
): T[] {
  return observations.filter((observation) =>
    isLayerEnabled(enablement, observation.layerId),
  );
}

export function selectLayerObservations<T extends BaseObservation>(
  observations: readonly T[],
  layerId: LayerId,
): T[] {
  return observations.filter((observation) => observation.layerId === layerId);
}

export function findObservation<T extends BaseObservation>(
  observations: readonly T[],
  identity: ObservationIdentity | null,
): T | null {
  if (!identity) return null;
  return (
    observations.find(
      (observation) =>
        observation.layerId === identity.layerId &&
        observation.id === identity.id,
    ) ?? null
  );
}

export function clearLayerSelection(
  selected: ObservationIdentity | null,
  layerId: LayerId,
): ObservationIdentity | null {
  return selected?.layerId === layerId ? null : selected;
}

export function selectedIdForLayer(
  selected: ObservationIdentity | null,
  layerId: LayerId,
): string | null {
  return selected?.layerId === layerId ? selected.id : null;
}

/* -------------------------------------------------------------------------- */
/* Generic, registry-driven sampling                                          */
/* -------------------------------------------------------------------------- */

export type LayerSampleSummary = {
  layerId: LayerId;
  label: string;
  shown: number;
  total: number;
  omitted: number;
};

export type LayerSampleResult<T extends BaseObservation> = {
  observations: T[];
  samples: LayerSampleSummary[];
};

function providerBalancedSample<T extends BaseObservation>(
  observations: readonly T[],
  maxMarkers: number,
): T[] {
  const groups = new Map<string, T[]>();
  for (const observation of observations) {
    const group = groups.get(observation.providerId) ?? [];
    group.push(observation);
    groups.set(observation.providerId, group);
  }

  const buckets = [...groups.values()];
  const offsets = buckets.map(() => 0);
  const visible: T[] = [];
  while (visible.length < maxMarkers) {
    let added = false;
    for (let index = 0; index < buckets.length; index += 1) {
      const next = buckets[index]?.[offsets[index] ?? 0];
      if (!next) continue;
      visible.push(next);
      offsets[index] = (offsets[index] ?? 0) + 1;
      added = true;
      if (visible.length >= maxMarkers) break;
    }
    if (!added) break;
  }
  return visible;
}

/**
 * Applies each layer's registered sampling strategy. Layers without a sampling
 * strategy render in full. The selected record is always retained, even when
 * sampling would otherwise exclude it.
 */
export function selectRenderableObservations<T extends BaseObservation>(
  observations: readonly T[],
  selected: ObservationIdentity | null,
  registry: LayerRegistry = layerRegistry,
): LayerSampleResult<T> {
  const order: LayerId[] = [];
  const byLayer = new Map<LayerId, T[]>();
  for (const observation of observations) {
    const group = byLayer.get(observation.layerId);
    if (group) {
      group.push(observation);
    } else {
      order.push(observation.layerId);
      byLayer.set(observation.layerId, [observation]);
    }
  }

  const rendered: T[] = [];
  const samples: LayerSampleSummary[] = [];
  for (const layerId of order) {
    const group = byLayer.get(layerId) ?? [];
    const definition = registry.get(layerId);
    const sampling = definition?.sampling;
    let visible = group;
    if (sampling && group.length > sampling.maxMarkers) {
      visible = providerBalancedSample(group, sampling.maxMarkers);
      const selectedId = selectedIdForLayer(selected, layerId);
      const selectedObservation = selectedId
        ? group.find((observation) => observation.id === selectedId)
        : undefined;
      if (
        selectedObservation &&
        !visible.some(
          (observation) => observation.id === selectedObservation.id,
        ) &&
        visible.length > 0
      ) {
        visible = [...visible.slice(0, -1), selectedObservation];
      }
    }
    rendered.push(...visible);
    samples.push({
      layerId,
      label: definition?.label ?? String(layerId),
      shown: visible.length,
      total: group.length,
      omitted: Math.max(0, group.length - visible.length),
    });
  }

  return { observations: rendered, samples };
}

export function layerSample(
  samples: readonly LayerSampleSummary[],
  layerId: LayerId,
): LayerSampleSummary | null {
  return samples.find((sample) => sample.layerId === layerId) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Camera layer                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `"all"`, or a registered camera provider id.
 *
 * Deliberately not a closed union of provider ids: the registry is the source
 * of truth for which providers exist, and an unknown id resolves to no
 * providers below rather than to a type error at a second site.
 */
export type CameraProviderFilter = "all" | (string & {});

/** Resolved from the registry's provider definitions, not a parallel array. */
export function cameraProviderIdsForFilter(
  /** ISO alpha-2 country code. */
  country: string,
  provider: CameraProviderFilter,
  registry: LayerRegistry = layerRegistry,
): string[] {
  const definition = registry.get("cameras");
  if (!definition) return [];
  const availableProviders = layerProviderIdsForCountry(definition, country);
  return provider === "all"
    ? availableProviders
    : availableProviders.includes(provider)
      ? [provider]
      : [];
}

export function normalizeCameraRecord(
  record: CameraRecord,
  providers: readonly CameraProviderStatus[],
): CameraObservation | null {
  if (!isValidCoordinates(record.latitude, record.longitude)) return null;
  const providerStatus =
    providers.find((provider) => provider.id === record.provider) ?? null;
  return {
    kind: "camera",
    layerId: "cameras",
    id: record.id,
    key: observationKey("cameras", record.id),
    latitude: record.latitude,
    longitude: record.longitude,
    label: record.displayName,
    observedAt: null,
    detail: record.description ?? null,
    providerId: record.provider,
    providerName: providerStatus?.name ?? record.provider,
    sourceUrl: record.sourceUrl,
    attribution: record.attribution,
    catalogueUrl: record.catalogueUrl,
    providerStatus,
    record,
  };
}

export function createCameraLayerProviderAdapter(
  providers: readonly CameraProviderStatus[],
): LayerProviderAdapter<CameraRecord, CameraObservation> {
  return {
    layerId: "cameras",
    providerId: (record) => record.provider,
    normalize: (record) => normalizeCameraRecord(record, providers),
  };
}

/* -------------------------------------------------------------------------- */
/* Public events layer                                                        */
/* -------------------------------------------------------------------------- */

/**
 * True when a briefing record carries usable coordinates.
 *
 * The briefing feed is reporting, not a civic incident source; this predicate
 * exists only so briefing list views can tell which records could be placed.
 * It is not part of the public-events layer pipeline.
 */
export function hasMappableCoordinates(record: BriefingEvent): boolean {
  return (
    record.latitude !== null &&
    record.longitude !== null &&
    isValidCoordinates(record.latitude, record.longitude)
  );
}

function publicEventDetail(record: PublicEventRecord): string | null {
  const parts = [
    record.impact?.impactType ?? null,
    record.impact?.delay ?? null,
    record.roadSummary?.locality ?? null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" \u00b7 ") : (record.description ?? null);
}

/**
 * Normalizes one civic incident. Records are dropped only when they cannot be
 * placed honestly; nothing is dropped for being "minor", because that
 * judgement belongs to the reporting authority.
 */
export function normalizePublicEventRecord(
  record: PublicEventRecord,
  providers: readonly PublicEventProviderStatus[],
): PublicEventObservation | null {
  if (!isValidCoordinates(record.latitude, record.longitude)) return null;
  const receivedAt = asIsoString(record.receivedAt);
  if (receivedAt === null) return null;

  const providerStatus =
    providers.find((provider) => provider.id === record.provider) ?? null;

  return {
    kind: "public-event",
    layerId: "public-events",
    id: record.id,
    key: observationKey("public-events", record.id),
    latitude: record.latitude,
    longitude: record.longitude,
    label: record.title,
    // The authority's own time for the record, never the receipt time.
    observedAt:
      asIsoString(record.lastUpdatedAt ?? null) ??
      asIsoString(record.publishedAt ?? null) ??
      asIsoString(record.startedAt ?? null),
    detail: publicEventDetail(record),
    providerId: record.provider,
    providerName: providerStatus?.name ?? record.provider,
    sourceUrl: record.sourceUrl,
    attribution: record.attribution,
    catalogueUrl: providerStatus?.catalogueUrl ?? null,
    providerStatus,
    eventType: record.eventType,
    eventSubtype: record.eventSubtype ?? null,
    sourcePriority: record.sourcePriority ?? null,
    status: record.status ?? null,
    locationDerived: record.locationDerived,
    locationNote: record.locationNote ?? null,
    receivedAt,
    licence: record.licence,
    record,
  };
}

export function createPublicEventLayerProviderAdapter(
  providers: readonly PublicEventProviderStatus[],
): LayerProviderAdapter<PublicEventRecord, PublicEventObservation> {
  return {
    layerId: "public-events",
    providerId: (record) => record.provider,
    normalize: (record) => normalizePublicEventRecord(record, providers),
  };
}

/* -------------------------------------------------------------------------- */
/* Maritime layer                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Vessel freshness.
 *
 * AIS reporting cadence depends on what the vessel is doing: a ship under way
 * reports every few seconds, while a moored or anchored vessel may report only
 * every few minutes and still be exactly where it says it is. Aircraft-style
 * second-scale thresholds would therefore erase every stationary ship, so the
 * thresholds below are movement-aware.
 *
 *   fresh    -> the provider's position time is recent for this kind of motion
 *   aging    -> older than expected but still worth showing, marked as such
 *   stale    -> too old to present; removed from the layer
 *   unknown  -> the provider supplied no position time; never called live
 */
export type VesselFreshness = "fresh" | "aging" | "stale" | "unknown";

/** A vessel is treated as under way from half a knot upwards. */
export const VESSEL_UNDER_WAY_KNOTS = 0.5;
export const VESSEL_MOVING_FRESH_MS = 10 * 60_000;
export const VESSEL_MOVING_STALE_MS = 30 * 60_000;
export const VESSEL_STATIONARY_FRESH_MS = 60 * 60_000;
export const VESSEL_STATIONARY_STALE_MS = 6 * 60 * 60_000;

function vesselIsUnderWay(record: VesselRecord): boolean {
  if (record.speedOverGround !== null) {
    return record.speedOverGround >= VESSEL_UNDER_WAY_KNOTS;
  }
  // 1 at anchor, 5 moored, 6 aground: stationary by the vessel's own report.
  if (record.navigationalStatus !== null) {
    return ![1, 5, 6].includes(record.navigationalStatus);
  }
  return true;
}

export function vesselFreshness(
  record: VesselRecord,
  now: number = Date.now(),
): VesselFreshness {
  if (!record.positionTimestamp) return "unknown";
  const positionAt = new Date(record.positionTimestamp).getTime();
  if (!Number.isFinite(positionAt)) return "unknown";
  const age = now - positionAt;
  // A position from the future is a clock problem, not a fresh position.
  if (age < -VESSEL_MOVING_FRESH_MS) return "unknown";
  const underWay = vesselIsUnderWay(record);
  const freshWindow = underWay ? VESSEL_MOVING_FRESH_MS : VESSEL_STATIONARY_FRESH_MS;
  const staleWindow = underWay ? VESSEL_MOVING_STALE_MS : VESSEL_STATIONARY_STALE_MS;
  if (age <= freshWindow) return "fresh";
  if (age <= staleWindow) return "aging";
  return "stale";
}

function vesselLabel(record: VesselRecord): string {
  return record.name ?? `MMSI ${record.mmsi}`;
}

function vesselDetail(record: VesselRecord): string | null {
  const parts = [
    record.shipTypeLabel,
    record.navigationalStatusLabel,
    record.speedOverGround !== null
      ? `${record.speedOverGround.toFixed(1)} kn`
      : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function asIsoString(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/**
 * Normalizes one vessel record. Records with unusable coordinates, an unusable
 * receipt time, or a position too old to be presented honestly are dropped
 * rather than displayed with a caveat.
 */
export function normalizeVesselRecord(
  record: VesselRecord,
  providers: readonly MaritimeProviderStatus[],
  now: number = Date.now(),
): MaritimeObservation | null {
  if (!isValidCoordinates(record.latitude, record.longitude)) return null;
  const receivedAt = asIsoString(record.receivedAt);
  if (receivedAt === null) return null;
  const freshness = vesselFreshness(record, now);
  if (freshness === "stale") return null;
  const providerStatus =
    providers.find((provider) => provider.id === record.provider) ?? null;
  return {
    kind: "vessel",
    layerId: "maritime",
    id: record.id,
    key: observationKey("maritime", record.id),
    latitude: record.latitude,
    longitude: record.longitude,
    label: vesselLabel(record),
    // The provider's position time, or nothing. Never the receipt time.
    observedAt: asIsoString(record.positionTimestamp),
    detail: vesselDetail(record),
    providerId: record.provider,
    providerName: providerStatus?.name ?? record.provider,
    sourceUrl: record.sourceUrl,
    attribution: record.attribution,
    catalogueUrl: providerStatus?.catalogueUrl ?? null,
    providerStatus,
    mmsi: record.mmsi,
    receivedAt,
    freshness,
    licence: record.licence,
    record,
  };
}

export function createMaritimeLayerProviderAdapter(
  providers: readonly MaritimeProviderStatus[],
  now: number = Date.now(),
): LayerProviderAdapter<VesselRecord, MaritimeObservation> {
  return {
    layerId: "maritime",
    providerId: (record) => record.provider,
    normalize: (record) => normalizeVesselRecord(record, providers, now),
  };
}

function hazardDetail(record: HazardRecord): string | null {
  const parts = [
    record.place,
    record.magnitudeValue !== null && record.magnitudeValue !== undefined
      ? `${record.magnitudeValue}${record.magnitudeUnit ? ` ${record.magnitudeUnit}` : ""}`
      : null,
    record.depthKm !== null && record.depthKm !== undefined
      ? `depth ${record.depthKm} km`
      : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" \u00b7 ") : (record.description ?? null);
}

/**
 * Normalizes one hazard record.
 *
 * A record is dropped only when it cannot be placed or timed honestly:
 * unusable coordinates, or an unusable observation time. Nothing is dropped
 * for being "not severe enough" — that judgement belongs to the source, not to
 * Signalwatch.
 */
export function normalizeHazardRecord(
  record: HazardRecord,
  sources: readonly HazardSourceStatus[],
): NaturalHazardObservation | null {
  if (!isValidCoordinates(record.latitude, record.longitude)) return null;
  const observedAt = asIsoString(record.occurredAt);
  if (observedAt === null) return null;
  const receivedAt = asIsoString(record.receivedAt);
  if (receivedAt === null) return null;

  const sourceStatus =
    sources.find((source) => source.id === record.source) ?? null;

  return {
    kind: "natural-hazard",
    layerId: "natural-hazards",
    id: record.id,
    key: observationKey("natural-hazards", record.id),
    latitude: record.latitude,
    longitude: record.longitude,
    label: record.title,
    // The source's observation time, never the time Signalwatch received it.
    observedAt,
    detail: hazardDetail(record),
    providerId: record.source,
    providerName: sourceStatus?.name ?? record.source,
    sourceUrl: record.sourceUrl,
    attribution: record.attribution,
    catalogueUrl: sourceStatus?.catalogueUrl ?? null,
    providerStatus: sourceStatus,
    hazardType: record.hazardType,
    receivedAt,
    magnitudeValue: record.magnitudeValue ?? null,
    magnitudeUnit: record.magnitudeUnit ?? null,
    magnitudeDescription: record.magnitudeDescription ?? null,
    depthKm: record.depthKm ?? null,
    activityStatus: record.activityStatus ?? null,
    reviewStatus: record.reviewStatus ?? null,
    sourceSeverity: record.sourceSeverity ?? null,
    place: record.place ?? null,
    licence: record.licence,
    record,
  };
}

export function createNaturalHazardLayerProviderAdapter(
  sources: readonly HazardSourceStatus[],
): LayerProviderAdapter<HazardRecord, NaturalHazardObservation> {
  return {
    layerId: "natural-hazards",
    providerId: (record) => record.source,
    normalize: (record) => normalizeHazardRecord(record, sources),
  };
}

/* -------------------------------------------------------------------------- */
/* Registry helpers used by shared renderers                                  */
/* -------------------------------------------------------------------------- */

export function observationLayerDefinition(
  observation: BaseObservation,
  registry: LayerRegistry = layerRegistry,
): LayerDefinition | undefined {
  return registry.get(observation.layerId);
}

export function observationMarkerColor(
  observation: BaseObservation,
  registry: LayerRegistry = layerRegistry,
): string {
  return (
    registry.get(observation.layerId)?.display.markerColor ?? "#94a3b8"
  );
}

/* -------------------------------------------------------------------------- */
/* Narrowing helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Type guards are the single documented boundary where shared code narrows a
 * base observation back to a concrete layer observation (used only by
 * layer-specific presentation).
 */
export function isCameraObservation(
  observation: BaseObservation,
): observation is CameraObservation {
  return observation.layerId === "cameras" && observation.kind === "camera";
}

export function isMaritimeObservation(
  observation: BaseObservation,
): observation is MaritimeObservation {
  return observation.layerId === "maritime" && observation.kind === "vessel";
}

export function isNaturalHazardObservation(
  observation: BaseObservation,
): observation is NaturalHazardObservation {
  return (
    observation.layerId === "natural-hazards" &&
    observation.kind === "natural-hazard"
  );
}

export function isPublicEventObservation(
  observation: BaseObservation,
): observation is PublicEventObservation {
  return (
    observation.layerId === "public-events" &&
    observation.kind === "public-event"
  );
}
