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

import {
  bandIndex,
  MAP_SCALE_BANDS,
  type MapScaleBand,
} from "./map-scale";

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

/**
 * What a layer *is*, structurally.
 *
 *   observation — discrete records, each with its own coordinate and identity.
 *                 Rendered as markers, selectable, sampled.
 *   imagery     — a continuous raster surface served by a provider. No record
 *                 identity, no single coordinate. Rendered viewport-driven,
 *                 not selectable, never sampled.
 *   field       — a gridded numeric surface (model output). Contract only in
 *                 this batch; no field provider is implemented.
 *
 * This is required rather than defaulted on purpose. A silent
 * `"observation"` default would let a future spatial layer register as a
 * point layer and inherit marker sampling and inspector selection, which is
 * exactly the failure this discriminant exists to prevent.
 *
 * See docs/research/weather-layer-architecture.md.
 */
export type LayerKind = "observation" | "imagery" | "field";

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
  /**
   * Renderable on the globe.
   *
   * Means different things for the two kinds, which is why consumers must
   * check `kind` rather than treating this as one capability:
   *   observation layer -> its records may be drawn as point markers;
   *   spatial layer     -> its surface may be projected onto the sphere.
   * A spatial layer with `globe: true` must never be asked for markers.
   */
  globe: boolean;
  /** Selectable records open the shared observation inspector. */
  inspector: boolean;
  /** Layer exposes a free-text catalogue search control. */
  search: boolean;
  /** Layer records are attributed to selectable providers. */
  providerFiltering: boolean;
};

/**
 * Presentation metadata used by shared renderers (globe, map, controls).
 *
 * The four `marker*` fields are optional because a spatial layer genuinely
 * has no markers — a radar mosaic is not drawn as dots, and giving it a
 * marker colour would be a fiction. `validateLayerDefinition` requires them
 * for `kind: "observation"`, so observation layers cannot quietly omit them.
 */
export type LayerDisplay = {
  /** Marker fill colour used by globe/map renderers. Observation layers only. */
  markerColor?: string;
  /** Marker stroke colour. Observation layers only. */
  markerStrokeColor?: string;
  /** Label colour used for the selected marker caption. Observation layers only. */
  markerTextColor?: string;
  /** Tailwind classes for the non-WebGL fallback marker dot. Observation layers only. */
  markerClassName?: string;
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
 * The range of map scales at which a layer is honest to draw.
 *
 * This is rendering *policy*, declared by the layer, so that shared map code
 * can decide what to show at the current scale without ever naming a layer.
 * The alternative — `if (layerId === "weather" && zoom > 15)` in the
 * renderer — is exactly the contamination the registry exists to prevent.
 *
 * Both ends mean something different:
 *
 *   minBand  below this scale the layer is noise. A thousand street cameras
 *            at world zoom is not information.
 *   maxBand  above this scale the layer would claim detail its source does
 *            not have. A raster drawn far past its native ground resolution
 *            is interpolation presented as observation.
 *
 * `note` is shown to the user when the layer is in range but suppressed, so
 * a layer that is enabled and silent can always explain itself. An absent
 * policy means the layer is drawn at every scale.
 */
export type LayerScalePolicy = {
  /** Coarsest scale at which this layer is drawn. Defaults to `global`. */
  minBand?: MapScaleBand;
  /** Finest scale at which this layer is drawn. Defaults to `streetContext`. */
  maxBand?: MapScaleBand;
  /** Why the limit exists, in the user's words. Required when either end is set. */
  note?: string;
};

export type ResolvedLayerScalePolicy = {
  minBand: MapScaleBand;
  maxBand: MapScaleBand;
  note: string | null;
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
  /** Structural kind. Decides which pipeline and renderer the layer uses. */
  kind: LayerKind;
  /**
   * Observation discriminant produced by this layer's normalizer.
   *
   * Only meaningful for `kind: "observation"`. Spatial layers set it to their
   * own id, which keeps the field total without implying records exist.
   */
  observationKind: string;
  enabledByDefault: boolean;
  capabilities: LayerCapabilities;
  display: LayerDisplay;
  /** Empty for planned layers: no feed is implemented or probed. */
  providers: LayerProviderDefinition[];
  /** Only set where the renderer must bound marker counts. */
  sampling?: LayerSamplingStrategy;
  /**
   * Scales at which this layer is drawn. Omit to draw at every scale.
   * Shared renderers read this instead of branching on the layer id.
   */
  scale?: LayerScalePolicy;
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
/**
 * The layer's scale policy with both ends resolved.
 *
 * An undeclared policy is the full range rather than a guess: a layer that
 * has not thought about scale must keep behaving exactly as it did before
 * this model existed.
 */
export function layerScalePolicy(
  definition: LayerDefinition,
): ResolvedLayerScalePolicy {
  const declared = definition.scale;
  return {
    minBand: declared?.minBand ?? MAP_SCALE_BANDS[0],
    maxBand: declared?.maxBand ?? MAP_SCALE_BANDS[MAP_SCALE_BANDS.length - 1],
    note: declared?.note ?? null,
  };
}

/** True when the layer should be drawn at this scale. */
export function isLayerVisibleAtBand(
  definition: LayerDefinition,
  band: MapScaleBand,
): boolean {
  const { minBand, maxBand } = layerScalePolicy(definition);
  const index = bandIndex(band);
  return index >= bandIndex(minBand) && index <= bandIndex(maxBand);
}

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
  kind: "observation",
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
    {
      id: "qldtraffic-cameras",
      name: "QLDTraffic cameras (Queensland TMR)",
      countries: ["AU"],
      attribution:
        "State of Queensland (Department of Transport and Main Roads), QLDTraffic",
      catalogueUrl:
        "https://www.data.qld.gov.au/dataset/131940-traffic-and-travel-information-geojson-api",
    },
    {
      id: "digitraffic-weathercam",
      name: "Fintraffic Digitraffic road weather cameras",
      countries: ["FI"],
      attribution: "Source: Fintraffic / digitraffic.fi, license CC 4.0 BY",
      catalogueUrl: "https://www.digitraffic.fi/en/road-traffic/",
    },
    {
      id: "hk-td-traffic-snapshots",
      name: "Hong Kong Transport Department traffic snapshots",
      countries: ["HK"],
      attribution:
        "Source: Transport Department, the Government of the Hong Kong SAR, via DATA.GOV.HK (intellectual property rights owned by the Government and the Transport Department)",
      catalogueUrl:
        "https://data.gov.hk/en-data/dataset/hk-td-tis_2-traffic-snapshot-images",
    },
  ],
  sampling: { kind: "provider-balanced", maxMarkers: MAX_GLOBE_CAMERA_MARKERS },
};

export const MAX_GLOBE_PUBLIC_EVENT_MARKERS = 200;

/**
 * Public events.
 *
 * Geolocated civic reporting from road/transport authorities: incidents,
 * crashes, closures, roadworks, flooding-affected roads and major events.
 *
 * The layer's meaning is broader than its current providers. QLDTraffic and
 * Transport for NSW are simply the free, openly licensed sources available
 * today; other civic sources can join without changing what the layer means.
 *
 * Categories are always the category the authority assigned. A record about a
 * road closed by flooding is a civic incident here, not a natural hazard.
 */
export const publicEventLayerDefinition: LayerDefinition = {
  id: "public-events",
  label: "Public events",
  description:
    "Civic incidents from free, openly licensed road authority feeds. Regional coverage only.",
  status: "operational",
  category: "reporting",
  kind: "observation",
  observationKind: "public-event",
  enabledByDefault: true,
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
    markerTextColor: "#fde68a",
    markerClassName:
      "size-2 border-amber-100 bg-amber-300 shadow-[0_0_7px_rgba(251,191,36,0.55)]",
    legendLabel: "Public event",
    tooltipNote: "authority reported",
    iconKey: "newspaper",
  },
  providers: [
    {
      id: "qldtraffic",
      name: "QLDTraffic (Queensland TMR)",
      countries: ["AU"],
      attribution:
        "State of Queensland (Department of Transport and Main Roads), QLDTraffic",
      catalogueUrl:
        "https://www.data.qld.gov.au/dataset/131940-traffic-and-travel-information-geojson-api",
      licence: "CC BY 4.0 AU",
      coverage: {
        scope: "regional",
        regions: ["Queensland road network"],
        note: "Crashes, hazards, congestion, flooding, roadworks and special events. Current conditions only.",
      },
    },
    {
      id: "tfnsw",
      name: "Transport for NSW Live Traffic",
      countries: ["AU"],
      attribution: "Transport for NSW",
      catalogueUrl:
        "https://opendata.transport.nsw.gov.au/data/dataset/live-traffic-hazards",
      licence: "CC BY 4.0",
      coverage: {
        scope: "regional",
        regions: ["New South Wales road network"],
        note: "Incidents, fires, floods, alpine conditions, major events and roadworks. Requires a free TfNSW API key.",
      },
    },
  ],
  coverage: {
    scope: "regional",
    regions: ["Queensland road network", "New South Wales road network"],
    note:
      "Regional coverage: Queensland and New South Wales roads only. Empty space " +
      "elsewhere means Signalwatch has no civic incident source there, not that no " +
      "incidents are occurring. Current conditions only, not a historical archive.",
  },
  sampling: {
    kind: "provider-balanced",
    maxMarkers: MAX_GLOBE_PUBLIC_EVENT_MARKERS,
  },
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
  kind: "observation",
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
  kind: "observation",
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
    markerColor: "#fb7185",
    markerStrokeColor: "#ffe4e6",
    markerTextColor: "#fda4af",
    markerClassName:
      "size-2 border-rose-100 bg-rose-400 shadow-[0_0_7px_rgba(251,113,133,0.55)]",
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
    {
      id: "nasa-firms",
      name: "NASA FIRMS active fire detections",
      countries: [],
      attribution: "Source: NASA FIRMS (LANCE / EOSDIS)",
      catalogueUrl: "https://firms.modaps.eosdis.nasa.gov/active_fire/",
      licence: "NASA EOSDIS open data",
      coverage: {
        scope: "global",
        regions: ["Worldwide"],
        note: "VIIRS 375 m satellite fire detections, sampled by overpass. A detection is not a confirmed fire.",
      },
    },
    {
      id: "noaa-nws",
      name: "NOAA National Weather Service alerts",
      countries: ["US"],
      attribution: "Source: NOAA / National Weather Service",
      catalogueUrl: "https://www.weather.gov/documentation/services-web-alerts",
      licence: "U.S. public domain (NOAA/NWS open data)",
      coverage: {
        scope: "regional",
        regions: ["United States and its territories"],
        note: "Active NWS alerts. No coverage outside the United States.",
      },
    },
  ],
  coverage: {
    scope: "global",
    regions: ["Worldwide", "United States and its territories"],
    note:
      "Global reach, bounded completeness: earthquakes from magnitude 2.5 up in the " +
      "past 24 hours, curated open natural events worldwide, satellite fire " +
      "detections sampled by overpass, and National Weather Service alerts for the " +
      "United States only. An area with no markers means these sources reported " +
      "nothing there, not that nothing is happening.",
  },
  sampling: { kind: "provider-balanced", maxMarkers: MAX_GLOBE_HAZARD_MARKERS },
};

/**
 * Weather — the first spatial layer.
 *
 * This layer does not produce observations. NOAA publishes a rendered radar
 * mosaic covering a bounded part of the world; Signalwatch asks the provider
 * for that surface and draws it, viewport by viewport. There are no records,
 * so there is nothing to select, nothing to search and nothing to sample —
 * which is why `inspector`, `search`, `providerFiltering` and `globe` are all
 * false and no `sampling` strategy is declared.
 *
 * Coverage is the field that matters most here. The mosaic stops at the edge
 * of NOAA's network. Beyond it Signalwatch has no radar source, and the
 * coverage note says exactly that rather than letting an empty map imply
 * clear skies.
 *
 * Admission: docs/research/providers/nws-radar-wms-admission.md.
 * Architecture: docs/research/weather-layer-architecture.md.
 */
export const weatherLayerDefinition: LayerDefinition = {
  id: "weather",
  label: "Weather",
  description:
    "Continuous radar surfaces published by national meteorological services. " +
    "Rendered as provider imagery, not as point records.",
  status: "operational",
  category: "environment",
  kind: "imagery",
  observationKind: "weather",
  enabledByDefault: false,
  capabilities: {
    // Drawn on the 2D map as a raster overlay.
    map: true,
    // The globe renders this as a projected spatial surface, never as
      // markers. See lib/globe-imagery.ts.
      globe: true,
    // There is no record to select, so the observation inspector must never
    // open for this layer. Clicking imagery is not a selection.
    inspector: false,
    // Nothing to text-search: a surface has no title or place name.
    search: false,
    // One admitted product; products are listed in the panel, not filtered.
    providerFiltering: false,
  },
  display: {
    legendLabel: "Radar surface",
    tooltipNote: "provider imagery",
    iconKey: "cloud",
  },
  /**
   * Drawn from world scale down to street scale, then stopped.
   *
   * The limit is read off the provider's own metadata, not chosen for taste.
   * The MRMS mosaic publishes a pixel size of 564.774 m (recorded in
   * docs/research/providers/nws-radar-wms-admission.md). Leaflet's ground
   * resolution reaches that at about zoom 8; by the top of the `street`
   * band (zoom 15, 4.78 m/px) one source pixel already covers roughly 118
   * screen pixels, and in the `streetContext` band (zoom 16-18) it covers
   * between 236 and 945. At that point nothing on screen is observation —
   * it is interpolation between samples half a kilometre apart, drawn
   * sharply enough to look like detail.
   *
   * There is no upper limit at the coarse end: a continental mosaic is
   * exactly what the world view should show.
   */
  scale: {
    maxBand: "street",
    note:
      "Radar samples are 565 m across, so the mosaic is not drawn below street " +
      "scale. Zoomed in further it would show interpolation, not observation.",
  },
  providers: [
    {
      id: "noaa-nws-radar",
      name: "NOAA / National Weather Service",
      countries: ["US"],
      // Verbatim copyrightText from the service's own metadata. NOAA content
      // is public domain, but the disclaimer forbids implying endorsement or
      // affiliation, so the attribution is reproduced exactly as published.
      attribution:
        "National Oceanic and Atmospheric Administration, NOAA, National Weather Service, NWS",
      catalogueUrl:
        "https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity_time/ImageServer",
      licence: "U.S. public domain (NOAA/NWS)",
      coverage: {
        scope: "regional",
        regions: [
          "Continental United States",
          "Alaska",
          "Hawaii",
          "Caribbean (Puerto Rico and the U.S. Virgin Islands)",
          "Guam",
        ],
        note:
          "MRMS composite base reflectivity. NOAA observes the continental United " +
          "States, Alaska, Hawaii, the Caribbean and Guam only. Elsewhere there is " +
          "no radar source, which is not a report of clear conditions.",
      },
    },
  ],
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
    kind: "observation",
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
  /** Definitions of one structural kind. Shared pipelines filter with this. */
  byKind(kind: LayerKind): LayerDefinition[];
  /** Definitions whose scale policy admits this band. */
  visibleAtBand(band: MapScaleBand): LayerDefinition[];
  defaultEnablement(): LayerFlags;
  /** Returns a new registry with extra/overriding definitions (immutable). */
  with(...definitions: LayerDefinition[]): LayerRegistry;
};

/** True for layers that produce discrete, selectable records. */
export function isObservationLayer(definition: LayerDefinition): boolean {
  return definition.kind === "observation";
}

/** True for layers that produce continuous surfaces (imagery or field). */
export function isSpatialLayer(definition: LayerDefinition): boolean {
  return definition.kind === "imagery" || definition.kind === "field";
}

/**
 * Rejects definitions whose kind and configuration contradict each other.
 *
 * These are not style rules. Each one blocks a specific way the two layer
 * kinds could quietly corrupt each other:
 *
 *  - a spatial layer carrying `sampling` would be handed to the marker
 *    sampler, whose `maxMarkers` cap is meaningless for a raster and would
 *    silently cap nothing while implying a bound exists;
 *  - a spatial layer with `inspector: true` would let a click on a surface
 *    open the record inspector and fabricate a selected observation;
 *  - a spatial layer with `globe: true` MAY now be rendered on the globe, but
 *    only by the spatial-surface renderer: see the capability note below;
 *  - an observation layer missing marker colours would render invisibly.
 *
 * Throwing is correct: a misconfigured layer is a programming error that
 * should never reach a user as a subtly wrong map.
 */
export function validateLayerDefinition(definition: LayerDefinition): void {
  const id = String(definition.id);

  if (definition.scale) {
    const { minBand, maxBand, note } = layerScalePolicy(definition);
    if (bandIndex(minBand) > bandIndex(maxBand)) {
      throw new Error(
        `Layer "${id}" declares an empty scale range: minBand "${minBand}" is finer than maxBand "${maxBand}", so the layer could never be drawn.`,
      );
    }
    if (!note) {
      throw new Error(
        `Layer "${id}" restricts its scale range but gives no note. A layer that goes silent must be able to say why.`,
      );
    }
  }

  if (isSpatialLayer(definition)) {
    if (definition.sampling) {
      throw new Error(
        `Layer "${id}" is ${definition.kind} and must not declare a sampling strategy: marker caps do not apply to continuous surfaces.`,
      );
    }
    if (definition.capabilities.inspector) {
      throw new Error(
        `Layer "${id}" is ${definition.kind} and must not declare the inspector capability: a surface has no selectable record.`,
      );
    }
    // `globe` is deliberately permitted for spatial layers from Checkpoint C3
    // onward. It no longer means "turn this into globe markers" — it means
    // "an authorised globe renderer exists for this surface". The two
    // renderers are kept apart by kind, not by this flag: marker consumers
    // must filter on `kind === "observation"` as well, which the globe
    // legend does. The inspector and sampling bans above are what actually
    // keep a surface out of the record pipelines.
    return;
  }

  const missing = (
    ["markerColor", "markerStrokeColor", "markerTextColor", "markerClassName"] as const
  ).filter((key) => !definition.display[key]);
  if (missing.length > 0) {
    throw new Error(
      `Layer "${id}" is an observation layer and must declare ${missing.join(", ")}.`,
    );
  }
}

export function createLayerRegistry(
  definitions: readonly LayerDefinition[],
): LayerRegistry {
  const byId = new Map<LayerId, LayerDefinition>();
  for (const definition of definitions) {
    validateLayerDefinition(definition);
    byId.set(definition.id, definition);
  }
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
    byKind: (kind) => ordered.filter((definition) => definition.kind === kind),
    visibleAtBand: (band) =>
      ordered.filter((definition) => isLayerVisibleAtBand(definition, band)),
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
  weatherLayerDefinition,
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

/**
 * Display names for the ISO alpha-2 codes providers declare.
 *
 * A code with no entry falls back to the code itself rather than to a guessed
 * country name — the selector should never invent a label for a provider
 * whose country has not been named here.
 */
const COUNTRY_LABELS: Record<string, string> = {
  AU: "Australia",
  FI: "Finland",
  HK: "Hong Kong SAR",
  NO: "Norway",
  US: "United States",
};

export type LayerCountry = { code: string; label: string };

/**
 * Countries a layer actually has providers for, derived from the registry.
 *
 * Shared UI reads this instead of hard-coding a country list. That is not
 * cosmetic: the Digitraffic road weather cameras were registered as a
 * provider but stayed unreachable in the UI because the camera country
 * selector was a hard-coded Australia/United States pair, so a registered,
 * admitted provider could not be selected. Deriving the list means
 * registering a provider is sufficient to surface it.
 */
export function layerCountries(definition: LayerDefinition): LayerCountry[] {
  const codes = new Set(
    definition.providers.flatMap((provider) => provider.countries),
  );
  return [...codes]
    .map((code) => ({ code, label: COUNTRY_LABELS[code] ?? code }))
    .sort((left, right) => left.label.localeCompare(right.label));
}
