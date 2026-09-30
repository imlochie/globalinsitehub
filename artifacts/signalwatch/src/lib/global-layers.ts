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
  /** Provider catalogue health, when the provider reports it. */
  providerStatus: CameraProviderStatus | null;
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

export type PublicEventObservation = BaseObservation<
  "public-events",
  "public-event"
> & {
  category: string;
  occurredAt: string;
  record: BriefingEvent;
};

/** Union of the layers currently implemented in production. */
export type GlobalObservation = CameraObservation | PublicEventObservation;

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

export type CameraProviderFilter =
  | "all"
  | "qld-tmr"
  | "transport-for-nsw"
  | "opentrafficcammap";

/** Resolved from the registry's provider definitions, not a parallel array. */
export function cameraProviderIdsForFilter(
  country: "AU" | "US",
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

export function normalizePublicEvent(
  record: BriefingEvent,
): PublicEventObservation | null {
  if (
    record.latitude === null ||
    record.longitude === null ||
    !isValidCoordinates(record.latitude, record.longitude)
  ) {
    return null;
  }
  return {
    kind: "public-event",
    layerId: "public-events",
    id: record.id,
    key: observationKey("public-events", record.id),
    latitude: record.latitude,
    longitude: record.longitude,
    label: record.title,
    observedAt: record.occurredAt,
    detail: record.detail ?? null,
    providerId: record.source,
    providerName: record.source,
    sourceUrl: record.url,
    attribution: null,
    catalogueUrl: null,
    providerStatus: null,
    category: record.category,
    occurredAt: record.occurredAt,
    record,
  };
}

export const publicEventProviderAdapter: LayerProviderAdapter<
  BriefingEvent,
  PublicEventObservation
> = {
  layerId: "public-events",
  providerId: (record) => record.source,
  normalize: normalizePublicEvent,
};

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

export function isPublicEventObservation(
  observation: BaseObservation,
): observation is PublicEventObservation {
  return (
    observation.layerId === "public-events" &&
    observation.kind === "public-event"
  );
}
