import type {
  CameraProviderStatus,
  CameraRecord,
} from "@workspace/api-client-react";
import type { BriefingEvent } from "@/lib/monitoring";

export type OperationalLayerId = "cameras" | "public-events";
export type PlannedLayerId =
  | "aircraft"
  | "maritime"
  | "satellites"
  | "natural-hazards"
  | "weather"
  | "infrastructure";

export type ObservationIdentity = {
  layerId: OperationalLayerId;
  id: string;
};

export type CameraProviderFilter =
  | "all"
  | "qld-tmr"
  | "transport-for-nsw"
  | "opentrafficcammap";

export function cameraProviderIdsForFilter(
  country: "AU" | "US",
  provider: CameraProviderFilter,
): string[] {
  const availableProviders =
    country === "AU"
      ? ["qld-tmr", "transport-for-nsw"]
      : ["opentrafficcammap"];
  return provider === "all"
    ? availableProviders
    : availableProviders.includes(provider)
      ? [provider]
      : [];
}

export function clearLayerSelection(
  selected: ObservationIdentity | null,
  layerId: OperationalLayerId,
): ObservationIdentity | null {
  return selected?.layerId === layerId ? null : selected;
}

export type CameraObservation = {
  kind: "camera";
  layerId: "cameras";
  id: string;
  key: string;
  latitude: number;
  longitude: number;
  label: string;
  providerId: string;
  sourceUrl: string;
  attribution: string;
  catalogueUrl: string;
  providerStatus: CameraProviderStatus | null;
  record: CameraRecord;
};

export type PublicEventObservation = {
  kind: "public-event";
  layerId: "public-events";
  id: string;
  key: string;
  latitude: number;
  longitude: number;
  label: string;
  sourceName: string;
  sourceUrl: string;
  occurredAt: string;
  category: string;
  detail: string | null;
  record: BriefingEvent;
};

export type GlobalObservation =
  | CameraObservation
  | PublicEventObservation;

export const MAX_GLOBE_CAMERA_MARKERS = 180;

export function selectEnabledLayerObservations(
  observations: GlobalObservation[],
  enabled: { cameras: boolean; publicEvents: boolean },
): GlobalObservation[] {
  return observations.filter((observation) =>
    observation.layerId === "cameras"
      ? enabled.cameras
      : enabled.publicEvents,
  );
}

export function selectGlobeObservations(
  observations: GlobalObservation[],
  selected: ObservationIdentity | null,
) {
  const cameras = observations.filter(
    (observation): observation is CameraObservation =>
      observation.kind === "camera",
  );
  const events = observations.filter(
    (observation): observation is PublicEventObservation =>
      observation.kind === "public-event",
  );
  const providers = new Map<string, CameraObservation[]>();
  for (const camera of cameras) {
    const group = providers.get(camera.providerId) ?? [];
    group.push(camera);
    providers.set(camera.providerId, group);
  }

  const groups = [...providers.values()];
  const visibleCameras: CameraObservation[] = [];
  const offsets = groups.map(() => 0);
  while (visibleCameras.length < MAX_GLOBE_CAMERA_MARKERS) {
    let added = false;
    for (let index = 0; index < groups.length; index += 1) {
      const next = groups[index]?.[offsets[index] ?? 0];
      if (!next) continue;
      visibleCameras.push(next);
      offsets[index] = (offsets[index] ?? 0) + 1;
      added = true;
      if (visibleCameras.length >= MAX_GLOBE_CAMERA_MARKERS) break;
    }
    if (!added) break;
  }

  const selectedCamera =
    selected?.layerId === "cameras"
      ? cameras.find((camera) => camera.id === selected.id)
      : undefined;
  if (
    selectedCamera &&
    !visibleCameras.some((camera) => camera.id === selectedCamera.id) &&
    visibleCameras.length > 0
  ) {
    visibleCameras[visibleCameras.length - 1] = selectedCamera;
  }

  return {
    observations: [...visibleCameras, ...events],
    cameraShown: visibleCameras.length,
    cameraTotal: cameras.length,
    cameraOmitted: Math.max(0, cameras.length - visibleCameras.length),
  };
}

export type LayerProviderAdapter<TRecord, TObservation extends GlobalObservation> = {
  layerId: TObservation["layerId"];
  providerId(record: TRecord): string;
  normalize(record: TRecord): TObservation | null;
};

export const operationalLayerDefinitions: {
  id: OperationalLayerId;
  label: string;
  description: string;
}[] = [
  {
    id: "cameras",
    label: "Public cameras",
    description:
      "Provider catalogue records. Individual feeds are not probed by Signalwatch.",
  },
  {
    id: "public-events",
    label: "Public events / news",
    description:
      "Public briefing records; only events with source coordinates appear on the map.",
  },
];

export const plannedLayerDefinitions: {
  id: PlannedLayerId;
  label: string;
}[] = [
  { id: "aircraft", label: "Aircraft" },
  { id: "maritime", label: "Maritime" },
  { id: "satellites", label: "Satellites" },
  { id: "natural-hazards", label: "Natural hazards" },
  { id: "weather", label: "Weather" },
  { id: "infrastructure", label: "Infrastructure" },
];

export function normalizeCameraRecord(
  record: CameraRecord,
  providers: CameraProviderStatus[],
): CameraObservation | null {
  if (!isValidCoordinates(record.latitude, record.longitude)) return null;
  return {
    kind: "camera",
    layerId: "cameras",
    id: record.id,
    key: `cameras:${record.id}`,
    latitude: record.latitude,
    longitude: record.longitude,
    label: record.displayName,
    providerId: record.provider,
    sourceUrl: record.sourceUrl,
    attribution: record.attribution,
    catalogueUrl: record.catalogueUrl,
    providerStatus:
      providers.find((provider) => provider.id === record.provider) ?? null,
    record,
  };
}

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
    key: `public-events:${record.id}`,
    latitude: record.latitude,
    longitude: record.longitude,
    label: record.title,
    sourceName: record.source,
    sourceUrl: record.url,
    occurredAt: record.occurredAt,
    category: record.category,
    detail: record.detail ?? null,
    record,
  };
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

export function createCameraLayerProviderAdapter(
  providers: CameraProviderStatus[],
): LayerProviderAdapter<CameraRecord, CameraObservation> {
  return {
    layerId: "cameras",
    providerId: (record) => record.provider,
    normalize: (record) => normalizeCameraRecord(record, providers),
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