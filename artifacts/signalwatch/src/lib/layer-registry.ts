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

/**
 * Layer status is a statement about *sources*, not about runtime health.
 *
 *   operational — Signalwatch has at least one legitimate, free source capable
 *                 of supplying this layer in the current deployment.
 *   planned     — no such source is confirmed, so no feed is implemented or
 *                 probed.
 *
 * `operational` deliberately does NOT mean "every registered provider is
 * configured and healthy". A layer with two providers stays operational when
 * one is down or simply unconfigured: the other still supplies its region, and
 * the failing provider is reported as `unavailable` next to the layer rather
 * than by hiding the layer. Runtime health lives in `LayerFetchStatus` and in
 * the per-provider status returned by the API — never in this field.
 */
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

/**
 * How much of the world a source actually observes.
 *
 * Coverage is declared per provider because it is a property of the feed, not
 * of the layer. A layer's coverage is derived from its providers by
 * `layerCoverage()` — a layer is only `global` when every provider is global.
 * This exists so the UI can state a limitation instead of leaving the user to
 * infer that an empty ocean is an empty ocean.
 */
export type LayerCoverageScope = "global" | "regional" | "local";

export type LayerCoverage = {
  scope: LayerCoverageScope;
  /** Human-readable regions actually observed. Empty only for global sources. */
  regions: string[];
  /** Short plain-language caption shown next to the layer control. */
  note: string;
};

export type LayerProviderDefinition = {
  id: string;
  name: string;
  /** ISO-3166 alpha-2 codes this provider publishes records for. */
  countries: string[];
  /** Human-readable rights/attribution note surfaced in the UI. */
  attribution: string;
  catalogueUrl: string;
  /** Licence short name, where the provider requires one to be shown. */
  licence?: string;
  /** What this provider actually observes. Required for operational layers. */
  coverage?: LayerCoverage;
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
  /**
   * Coverage stated at layer level. Omit to derive it from the providers;
   * set it only when the layer's honest coverage differs from the union of
   * its providers.
   */
  coverage?: LayerCoverage;
};

/**
 * Coverage of a layer: the explicit layer-level statement when present,
 * otherwise derived from the providers. Deriving never upgrades the scope —
 * one regional provider makes the layer regional.
 */
export function layerCoverage(definition: LayerDefinition): LayerCoverage {
  if (definition.coverage) return definition.coverage;
  const covered = definition.providers.flatMap((provider) =>
    provider.coverage ? [provider.coverage] : [],
  );
  if (covered.length === 0) {
    return {
      scope: "local",
      regions: [],
      note: "No coverage is declared for this layer.",
    };
  }
  const regions = [...new Set(covered.flatMap((coverage) => coverage.regions))];
  const scope: LayerCoverageScope = covered.every(
    (coverage) => coverage.scope === "global",
  )
    ? "global"
    : covered.some((coverage) => coverage.scope !== "local")
      ? "regional"
      : "local";
  return {
    scope,
    regions,
    note:
      scope === "global"
        ? "Worldwide coverage."
        : `Covers ${regions.join("; ")}. Elsewhere Signalwatch has no source for this layer.`,
  };
}

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

export const MAX_GLOBE_VESSEL_MARKERS = 220;

/**
 * Maritime is operational and deliberately REGIONAL.
 *
 * Both sources are free, openly licensed government feeds with no subscription,
 * no per-request billing and no usage plan. Neither is worldwide, so the layer
 * must never be described as global maritime tracking: outside the declared
 * regions Signalwatch simply has no maritime source.
 */
export const maritimeLayerDefinition: LayerDefinition = {
  id: "maritime",
  label: "Maritime",
  description:
    "Vessel positions from free, openly licensed government AIS feeds. Regional coverage only.",
  status: "operational",
  category: "movement",
  observationKind: "vessel",
  enabledByDefault: false,
  capabilities: {
    map: true,
    globe: true,
    inspector: true,
    search: true,
    providerFiltering: true,
  },
  display: {
    markerColor: "#5eead4",
    markerStrokeColor: "#ccfbf1",
    markerTextColor: "#99f6e4",
    markerClassName:
      "size-2 border-teal-100 bg-teal-300 shadow-[0_0_7px_rgba(94,234,212,0.55)]",
    legendLabel: "Vessel (AIS)",
    tooltipNote: "self-reported AIS",
    iconKey: "ship",
  },
  providers: [
    {
      id: "digitraffic",
      name: "Fintraffic Digitraffic",
      countries: ["FI"],
      attribution: "Source: Fintraffic / digitraffic.fi, license CC 4.0 BY",
      catalogueUrl: "https://www.digitraffic.fi/en/marine-traffic/",
      licence: "CC BY 4.0",
      coverage: {
        scope: "regional",
        regions: ["Finnish waterways and the surrounding Baltic reception area"],
        note: "Class A transponders only; fishing vessels are removed at source.",
      },
    },
    {
      id: "barentswatch",
      name: "Kystverket / BarentsWatch",
      countries: ["NO"],
      attribution:
        "Contains data from Kystverket / BarentsWatch, licensed under NLOD 2.0",
      catalogueUrl: "https://developer.barentswatch.no/docs/AIS/live-ais-api/",
      licence: "NLOD 2.0",
      coverage: {
        scope: "regional",
        regions: [
          "Norwegian economic zone",
          "Svalbard and Jan Mayen protection zones",
        ],
        note: "Excludes fishing vessels under 15 m and leisure craft under 45 m.",
      },
    },
  ],
  coverage: {
    scope: "regional",
    regions: [
      "Finnish waterways and the surrounding Baltic reception area",
      "Norwegian economic zone",
      "Svalbard and Jan Mayen protection zones",
    ],
    note:
      "Regional coverage: Finnish and Norwegian waters only. Empty sea elsewhere " +
      "means Signalwatch has no maritime source there, not that no vessels are present.",
  },
  sampling: { kind: "provider-balanced", maxMarkers: MAX_GLOBE_VESSEL_MARKERS },
};

export const MAX_GLOBE_HAZARD_MARKERS = 200;

/**
 * Natural hazards.
 *
 * Structured hazard observations published by hazard-oriented data sources.
 * This is deliberately not the same thing as the public-events layer: nothing
 * here originates in a news headline, and a hazard type is always the category
 * the source itself assigned.
 *
 * Coverage is global in reach but bounded in completeness, and the note says
 * so: USGS publishes worldwide earthquakes only from magnitude 2.5 up, and
 * EONET is a curated tracker rather than an exhaustive census. An empty area
 * therefore means "nothing reported by these two sources", not "nothing
 * happened".
 */
export const naturalHazardLayerDefinition: LayerDefinition = {
  id: "natural-hazards",
  label: "Natural hazards",
  description:
    "Earthquake and natural-event observations from free, openly licensed hazard sources.",
  status: "operational",
  category: "environment",
  observationKind: "natural-hazard",
  enabledByDefault: false,
  capabilities: {
    map: true,
    globe: true,
    inspector: true,
    search: true,
    providerFiltering: true,
  },
  display: {
    markerColor: "#fbbf24",
    markerStrokeColor: "#fef3c7",
    markerTextColor: "#fcd34d",
    markerClassName:
      "size-2 border-amber-100 bg-amber-300 shadow-[0_0_7px_rgba(251,191,36,0.55)]",
    legendLabel: "Natural hazard",
    tooltipNote: "source-reported",
    iconKey: "hazard",
  },
  providers: [
    {
      id: "usgs",
      name: "USGS Earthquake Hazards Program",
      countries: [],
      attribution: "Credit: U.S. Geological Survey",
      catalogueUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
      licence: "U.S. public domain (USGS)",
      coverage: {
        scope: "global",
        regions: ["Worldwide"],
        note: "Magnitude 2.5 and above, past 24 hours. Smaller earthquakes are not included.",
      },
    },
    {
      id: "nasa-eonet",
      name: "NASA EONET",
      countries: [],
      attribution:
        "Source: NASA Earth Observatory Natural Event Tracker (EONET)",
      catalogueUrl: "https://eonet.gsfc.nasa.gov/docs/v3",
      licence: "NASA ESDIS open data",
      coverage: {
        scope: "global",
        regions: ["Worldwide"],
        note: "Curated open natural events. NASA states these records are approximations, not official extents.",
      },
    },
  ],
  coverage: {
    scope: "global",
    regions: ["Worldwide"],
    note:
      "Global reach, bounded completeness: earthquakes from magnitude 2.5 up in the " +
      "past 24 hours, plus curated open natural events. An area with no markers means " +
      "these two sources reported nothing there, not that nothing is happening.",
  },
  sampling: { kind: "provider-balanced", maxMarkers: MAX_GLOBE_HAZARD_MARKERS },
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
  plannedLayer("satellites", "Satellites", "movement", "satellite"),
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
  maritimeLayerDefinition,
  naturalHazardLayerDefinition,
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
