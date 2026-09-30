/**
 * Global Layer Engine — layer registry.
 *
 * This module is the single, UI-agnostic source of truth for *what a layer is*.
 * It contains no React, no runtime state and no network access:
 *
 *   LayerDefinition   -> static description of a layer (this file)
 *   LayerRuntimeState -> enablement / filters / selection (global-layer-provider)
 *   LayerObservations -> normalized records produced by provider adapters
 *
 * Adding a layer means: a definition here, a provider adapter + normalizer
 * (lib/global-layers.ts), a layer source module plus its single registration
 * line in useGlobalLayerData (React hook ordering rules prevent a fully
 * dynamic loop), and — only when the layer needs bespoke presentation — a
 * panel builder (components/layer-panels/) and/or inspector body
 * (components/observation-details/).
 */

export type KnownLayerId =
  | "cameras"
  | "public-events"
  | "aircraft"
  | "maritime"
  | "satellites"
  | "natural-hazards"
  | "weather"
  | "infrastructure";

/** Layer ids are open so tests (and future work) can register extra layers. */
export type LayerId = KnownLayerId | (string & {});

export type LayerStatus = "operational" | "planned";

export type LayerCategory =
  | "imagery"
  | "reporting"
  | "movement"
  | "environment"
  | "infrastructure";

/**
 * Capabilities are consumed by shared UI instead of `if (layerId === ...)`.
 * Keep this list small: only add a capability when shared code branches on it.
 */
export type LayerCapabilities = {
  /** Renderable on the 2D Leaflet map. */
  map: boolean;
  /** Renderable on the globe. */
  globe: boolean;
  /** Selectable records open the shared observation inspector. */
  inspector: boolean;
  /** Layer exposes a free-text catalogue search control. */
  search: boolean;
  /** Layer records are attributed to selectable providers. */
  providerFiltering: boolean;
};

/** Presentation metadata used by shared renderers (globe, map, controls). */
export type LayerDisplay = {
  /** Marker fill colour used by globe/map renderers. */
  markerColor: string;
  /** Marker stroke colour. */
  markerStrokeColor: string;
  /** Label colour used for the selected marker caption. */
  markerTextColor: string;
  /** Tailwind classes for the non-WebGL fallback marker dot. */
  markerClassName: string;
  /** Short legend caption, e.g. "Camera catalogue". */
  legendLabel: string;
  /** Optional provenance note appended to marker tooltips. */
  tooltipNote?: string;
  /** Icon key resolved by the UI layer to a concrete icon component. */
  iconKey: string;
};

/**
 * Bounded rendering strategy. `provider-balanced` round-robins observations by
 * `providerId` so one large provider cannot crowd out the others.
 * Absent sampling means "render every observation".
 */
export type LayerSamplingStrategy = {
  kind: "provider-balanced";
  maxMarkers: number;
};

export type LayerProviderDefinition = {
  id: string;
  name: string;
  /** ISO-3166 alpha-2 codes this provider publishes records for. */
  countries: string[];
  /** Human-readable rights/attribution note surfaced in the UI. */
  attribution: string;
  catalogueUrl: string;
};

export type LayerDefinition = {
  id: LayerId;
  label: string;
  description: string;
  status: LayerStatus;
  category: LayerCategory;
  /** Observation discriminant produced by this layer's normalizer. */
  observationKind: string;
  enabledByDefault: boolean;
  capabilities: LayerCapabilities;
  display: LayerDisplay;
  /** Empty for planned layers: no feed is implemented or probed. */
  providers: LayerProviderDefinition[];
  /** Only set where the renderer must bound marker counts. */
  sampling?: LayerSamplingStrategy;
};

const noCapabilities: LayerCapabilities = {
  map: false,
  globe: false,
  inspector: false,
  search: false,
  providerFiltering: false,
};

export const MAX_GLOBE_CAMERA_MARKERS = 180;

export const cameraLayerDefinition: LayerDefinition = {
  id: "cameras",
  label: "Public cameras",
  description:
    "Provider catalogue records. Individual feeds are not probed by Signalwatch.",
  status: "operational",
  category: "imagery",
  observationKind: "camera",
  enabledByDefault: true,
  capabilities: {
    map: true,
    globe: true,
    inspector: true,
    search: true,
    providerFiltering: true,
  },
  display: {
    markerColor: "#67e8f9",
    markerStrokeColor: "#cffafe",
    markerTextColor: "#a5f3fc",
    markerClassName:
      "size-2 border-cyan-100 bg-cyan-300 shadow-[0_0_7px_rgba(103,232,249,0.55)]",
    legendLabel: "Camera catalogue",
    tooltipNote: "feed not probed",
    iconKey: "camera",
  },
  providers: [
    {
      id: "qld-tmr",
      name: "Queensland TMR",
      countries: ["AU"],
      attribution: "Queensland Department of Transport and Main Roads",
      catalogueUrl: "https://www.data.qld.gov.au/",
    },
    {
      id: "transport-for-nsw",
      name: "Transport for NSW",
      countries: ["AU"],
      attribution: "Transport for NSW Open Data",
      catalogueUrl: "https://opendata.transport.nsw.gov.au/",
    },
    {
      id: "opentrafficcammap",
      name: "OpenTrafficCamMap USA",
      countries: ["US"],
      attribution: "OpenTrafficCamMap contributors",
      catalogueUrl: "https://github.com/OpenTrafficCam/",
    },
  ],
  sampling: { kind: "provider-balanced", maxMarkers: MAX_GLOBE_CAMERA_MARKERS },
};

export const publicEventLayerDefinition: LayerDefinition = {
  id: "public-events",
  label: "Public events / news",
  description:
    "Public briefing records; only events with source coordinates appear on the map.",
  status: "operational",
  category: "reporting",
  observationKind: "public-event",
  enabledByDefault: true,
  capabilities: {
    map: true,
    globe: true,
    inspector: true,
    search: false,
    providerFiltering: false,
  },
  display: {
    markerColor: "#fbbf24",
    markerStrokeColor: "#fef3c7",
    markerTextColor: "#fde68a",
    markerClassName:
      "size-2 border-amber-100 bg-amber-300 shadow-[0_0_7px_rgba(251,191,36,0.55)]",
    legendLabel: "Public event",
    iconKey: "newspaper",
  },
  // Event provenance is carried per record by the briefing feed rather than by
  // a fixed provider catalogue, so no static provider list is declared here.
  providers: [],
};

function plannedLayer(
  id: KnownLayerId,
  label: string,
  category: LayerCategory,
  iconKey: string,
): LayerDefinition {
  return {
    id,
    label,
    description: `${label} is not connected in this workspace. No feed is implemented or probed.`,
    status: "planned",
    category,
    observationKind: id,
    enabledByDefault: false,
    capabilities: noCapabilities,
    display: {
      markerColor: "#94a3b8",
      markerStrokeColor: "#e2e8f0",
      markerTextColor: "#cbd5f5",
      markerClassName: "size-2 border-slate-100 bg-slate-300",
      legendLabel: label,
      iconKey,
    },
    providers: [],
  };
}

export const plannedLayerDefinitions: LayerDefinition[] = [
  plannedLayer("aircraft", "Aircraft", "movement", "aircraft"),
  plannedLayer("maritime", "Maritime", "movement", "ship"),
  plannedLayer("satellites", "Satellites", "movement", "satellite"),
  plannedLayer("natural-hazards", "Natural hazards", "environment", "hazard"),
  plannedLayer("weather", "Weather", "environment", "cloud"),
  plannedLayer("infrastructure", "Infrastructure", "infrastructure", "building"),
];

/** Boolean state keyed by layer id (enablement, visibility, ...). */
export type LayerFlags = Record<string, boolean>;

export type LayerRegistry = {
  readonly definitions: readonly LayerDefinition[];
  get(layerId: LayerId): LayerDefinition | undefined;
  /** Throws for unknown ids: shared renderers should never invent a layer. */
  require(layerId: LayerId): LayerDefinition;
  has(layerId: LayerId): boolean;
  byStatus(status: LayerStatus): LayerDefinition[];
  operational(): LayerDefinition[];
  planned(): LayerDefinition[];
  withCapability(capability: keyof LayerCapabilities): LayerDefinition[];
  defaultEnablement(): LayerFlags;
  /** Returns a new registry with extra/overriding definitions (immutable). */
  with(...definitions: LayerDefinition[]): LayerRegistry;
};

export function createLayerRegistry(
  definitions: readonly LayerDefinition[],
): LayerRegistry {
  const byId = new Map<LayerId, LayerDefinition>();
  for (const definition of definitions) byId.set(definition.id, definition);
  const ordered = [...byId.values()];

  return {
    definitions: ordered,
    get: (layerId) => byId.get(layerId),
    require(layerId) {
      const definition = byId.get(layerId);
      if (!definition) {
        throw new Error(`Unknown layer id: ${String(layerId)}`);
      }
      return definition;
    },
    has: (layerId) => byId.has(layerId),
    byStatus: (status) =>
      ordered.filter((definition) => definition.status === status),
    operational: () =>
      ordered.filter((definition) => definition.status === "operational"),
    planned: () =>
      ordered.filter((definition) => definition.status === "planned"),
    withCapability: (capability) =>
      ordered.filter((definition) => definition.capabilities[capability]),
    defaultEnablement() {
      const enablement: LayerFlags = {};
      for (const definition of ordered) {
        enablement[definition.id] =
          definition.status === "operational" && definition.enabledByDefault;
      }
      return enablement;
    },
    with: (...extra) => createLayerRegistry([...ordered, ...extra]),
  };
}

/** Application registry. Operational layers first, then planned placeholders. */
export const layerRegistry: LayerRegistry = createLayerRegistry([
  cameraLayerDefinition,
  publicEventLayerDefinition,
  ...plannedLayerDefinitions,
]);

export function layerProviderIdsForCountry(
  definition: LayerDefinition,
  countryCode: string,
): string[] {
  return definition.providers
    .filter((provider) => provider.countries.includes(countryCode))
    .map((provider) => provider.id);
}
