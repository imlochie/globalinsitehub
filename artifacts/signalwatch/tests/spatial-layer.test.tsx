import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GlobalLayerControl } from "../src/components/global-layer-control";
import { weatherLayerPanel } from "../src/components/layer-panels/weather-layer-panel";
import { combineSpatialSources } from "../src/hooks/use-global-layer-data";
import type { SpatialLayerSourceResult } from "../src/hooks/layer-sources/types";
import {
  createLayerRegistry,
  layerRegistry,
  validateLayerDefinition,
  weatherLayerDefinition,
  type LayerDefinition,
} from "../src/lib/layer-registry";
import {
  boundsIntersect,
  boundsToMercatorBbox,
  buildWmsGetMapUrl,
  buildWmsLayerOptions,
  evaluateFreshness,
  isOutsideCoverage,
  isRenderableCrs,
  resolveAvailability,
  surfaceAgeMs,
  toRenderableImagery,
  type SpatialProduct,
} from "../src/lib/spatial-layers";
import {
  findObservation,
  selectRenderableObservations,
  type BaseObservation,
} from "../src/lib/global-layers";

const NOW = new Date("2026-10-01T13:10:00.000Z");

/** Matches the DTO the API server publishes for the admitted radar product. */
function radarProduct(overrides: Partial<SpatialProduct> = {}): SpatialProduct {
  return {
    id: "nws-radar-base-reflectivity",
    layerId: "weather",
    kind: "imagery",
    providerId: "noaa-nws-radar",
    providerName: "NOAA / National Weather Service",
    productName: "Radar base reflectivity (MRMS)",
    productDescription:
      "Multi-Radar/Multi-Sensor composite base reflectivity from the WSR-88D network.",
    attribution:
      "National Oceanic and Atmospheric Administration, NOAA, National Weather Service, NWS",
    sourceUrl: "https://radar.weather.gov/",
    licence: "U.S. public domain (NOAA/NWS)",
    coverage: {
      scope: "regional",
      regions: ["Continental United States", "Alaska", "Guam"],
      note:
        "NOAA observes the continental United States, Alaska, Hawaii, the Caribbean " +
        "and Guam only. Elsewhere there is no radar source, which is not a report of " +
        "clear conditions.",
      areas: [
        {
          name: "Continental United States",
          west: -127,
          south: 23,
          east: -64,
          north: 51,
        },
        { name: "Guam", west: 143, south: 12, east: 150.00479, north: 21 },
      ],
    },
    sourceTimestamp: "2026-10-01T13:06:59.000Z",
    ingestionTimestamp: "2026-10-01T13:10:00.000Z",
    validTime: null,
    runTime: null,
    refreshIntervalMs: 600_000,
    staleAfterMs: 1_800_000,
    availability: "covered",
    message: "NOAA/NWS radar mosaic is current.",
    imagery: {
      protocol: "wms",
      endpoint:
        "https://mapservices.weather.noaa.gov/eventdriven/services/radar/radar_base_reflectivity_time/ImageServer/WMSServer",
      layer: "radar_base_reflectivity_time",
      version: "1.3.0",
      crs: "EPSG:3857",
      format: "image/png",
      transparent: true,
      timeParameter: "time",
      opacity: 0.68,
    },
    field: null,
    ...overrides,
  } as SpatialProduct;
}

/* -------------------------------------------------------------------------- */
/* Registry: the kind discriminant                                            */
/* -------------------------------------------------------------------------- */

test("the application registry still registers observation layers unchanged", () => {
  for (const id of ["cameras", "public-events", "maritime", "natural-hazards"]) {
    const definition = layerRegistry.require(id);
    assert.equal(definition.kind, "observation");
    assert.equal(definition.capabilities.inspector, true);
  }
  assert.equal(layerRegistry.byKind("observation").length >= 4, true);
});

test("weather registers in the one authoritative registry as an imagery layer", () => {
  const definition = layerRegistry.require("weather");
  assert.equal(definition.kind, "imagery");
  assert.equal(definition.status, "operational");
  assert.deepEqual(
    layerRegistry.byKind("imagery").map((entry) => String(entry.id)),
    ["weather"],
  );
  // Registry responsibilities are shared across kinds, not duplicated.
  assert.equal(definition.label, "Weather");
  assert.equal(definition.category, "environment");
  assert.equal(definition.providers[0].id, "noaa-nws-radar");
  assert.equal(definition.providers[0].coverage?.scope, "regional");
});

test("an imagery layer declares no inspector, search or sampling", () => {
  const definition = layerRegistry.require("weather");
  assert.equal(definition.capabilities.map, true);
  // A surface still has no record to select and no marker to sample.
  assert.equal(definition.capabilities.inspector, false);
  assert.equal(definition.capabilities.search, false);
  assert.equal(definition.sampling, undefined);
  // Checkpoint C3 refined the globe rule: a spatial layer may now declare
  // `globe`, which means "an authorised globe renderer exists for this
  // surface" — never "turn this into markers". The bans above are what keep
  // it out of the record pipelines; see tests/globe-imagery.test.tsx.
  assert.equal(definition.capabilities.globe, true);
});

test("a field layer registers with the same shared machinery", () => {
  const fieldLayer: LayerDefinition = {
    ...weatherLayerDefinition,
    id: "test-field",
    kind: "field",
    observationKind: "test-field",
  };
  const registry = createLayerRegistry([fieldLayer]);
  assert.equal(registry.require("test-field").kind, "field");
  assert.equal(registry.byKind("field").length, 1);
});

test("a spatial layer declaring a sampling cap is rejected", () => {
  assert.throws(
    () =>
      validateLayerDefinition({
        ...weatherLayerDefinition,
        sampling: { kind: "provider-balanced", maxMarkers: 50 },
      }),
    /must not declare a sampling strategy/,
  );
});

test("a spatial layer claiming the inspector capability is rejected", () => {
  assert.throws(
    () =>
      createLayerRegistry([
        {
          ...weatherLayerDefinition,
          capabilities: { ...weatherLayerDefinition.capabilities, inspector: true },
        },
      ]),
    /must not declare the inspector capability/,
  );
});

test("a spatial layer claiming the globe capability is accepted from C3", () => {
  // Superseded Checkpoint B rule. The globe gained a surface renderer, so
  // the capability is no longer a contradiction for a spatial layer. What
  // is still rejected is a spatial layer claiming record semantics.
  assert.doesNotThrow(() =>
    createLayerRegistry([
      {
        ...weatherLayerDefinition,
        capabilities: { ...weatherLayerDefinition.capabilities, globe: true },
      },
    ]),
  );
  assert.throws(
    () =>
      createLayerRegistry([
        {
          ...weatherLayerDefinition,
          capabilities: {
            ...weatherLayerDefinition.capabilities,
            globe: true,
            inspector: true,
          },
        },
      ]),
    /must not declare the inspector capability/,
  );
});

test("an observation layer without marker colours is rejected", () => {
  assert.throws(
    () =>
      createLayerRegistry([
        {
          ...weatherLayerDefinition,
          id: "broken-points",
          kind: "observation",
        },
      ]),
    /must declare markerColor/,
  );
});

/* -------------------------------------------------------------------------- */
/* Imagery contract                                                           */
/* -------------------------------------------------------------------------- */

test("WMS layer options carry the provider's CRS, format, version and attribution", () => {
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  assert.ok(surface);
  const options = buildWmsLayerOptions(surface);
  assert.equal(options.layers, "radar_base_reflectivity_time");
  assert.equal(options.version, "1.3.0");
  assert.equal(options.crs, "EPSG:3857");
  assert.equal(options.format, "image/png");
  assert.equal(options.transparent, true);
  assert.equal(options.opacity, 0.68);
  assert.equal(
    options.attribution,
    "National Oceanic and Atmospheric Administration, NOAA, National Weather Service, NWS",
  );
});

test("the time parameter is omitted unless a frame is explicitly selected", () => {
  const latest = toRenderableImagery(radarProduct(), null, NOW);
  assert.ok(latest);
  // Omitting it is how the provider is asked for its most recent frame.
  assert.equal("time" in buildWmsLayerOptions(latest), false);

  const pinned = toRenderableImagery(radarProduct(), null, NOW, {
    time: "2026-10-01T12:30:00Z",
  });
  assert.ok(pinned);
  assert.equal(buildWmsLayerOptions(pinned).time, "2026-10-01T12:30:00Z");
});

test("a service with no time dimension never gains a time parameter", () => {
  const product = radarProduct({
    imagery: { ...radarProduct().imagery!, timeParameter: null },
  });
  const surface = toRenderableImagery(product, null, NOW, {
    time: "2026-10-01T12:30:00Z",
  });
  assert.ok(surface);
  assert.equal("time" in buildWmsLayerOptions(surface), false);
});

test("GetMap URLs are built with an x,y bbox, which is correct for EPSG:3857", () => {
  const service = radarProduct().imagery!;
  const url = new URL(
    buildWmsGetMapUrl(service, {
      bbox: [-13_358_338, 2_875_744, -7_514_065, 6_446_275],
      width: 1024,
      height: 768,
    }),
  );
  assert.equal(url.searchParams.get("SERVICE"), "WMS");
  assert.equal(url.searchParams.get("VERSION"), "1.3.0");
  assert.equal(url.searchParams.get("REQUEST"), "GetMap");
  assert.equal(url.searchParams.get("LAYERS"), "radar_base_reflectivity_time");
  assert.equal(url.searchParams.get("CRS"), "EPSG:3857");
  assert.equal(
    url.searchParams.get("BBOX"),
    "-13358338,2875744,-7514065,6446275",
  );
  assert.equal(url.searchParams.get("WIDTH"), "1024");
  assert.equal(url.searchParams.get("FORMAT"), "image/png");
  assert.equal(url.searchParams.get("TRANSPARENT"), "TRUE");
  assert.equal(url.searchParams.get("TIME"), null);
});

test("a selected frame appears in the GetMap URL under the provider's parameter name", () => {
  const service = radarProduct().imagery!;
  const url = new URL(
    buildWmsGetMapUrl(service, {
      bbox: [0, 0, 1, 1],
      width: 256,
      height: 256,
      time: "2026-10-01T13:06:59Z",
    }),
  );
  assert.equal(url.searchParams.get("TIME"), "2026-10-01T13:06:59Z");
});

test("declared degree bounds convert to a Web Mercator bbox", () => {
  const [west, south, east, north] = boundsToMercatorBbox({
    west: -125,
    south: 24,
    east: -66,
    north: 50,
  });
  assert.ok(west < east);
  assert.ok(south < north);
  assert.ok(Math.abs(west - -13_914_936) < 2);
  assert.ok(Math.abs(north - 6_446_275) < 2);
});

test("a CRS the map cannot request faithfully is not drawn", () => {
  const product = radarProduct({
    imagery: { ...radarProduct().imagery!, crs: "EPSG:2263" },
  });
  const surface = toRenderableImagery(product, null, NOW);
  assert.ok(surface);
  // Substituting a CRS would place a plausible surface in the wrong spot.
  assert.equal(surface.render, false);
  assert.match(surface.message, /cannot request without reprojecting/);
  assert.equal(isRenderableCrs("EPSG:3857"), true);
  assert.equal(isRenderableCrs("EPSG:2263"), false);
});

/* -------------------------------------------------------------------------- */
/* Coverage                                                                   */
/* -------------------------------------------------------------------------- */

test("a viewport overlapping coverage is covered and drawn", () => {
  const viewport = { west: -100, south: 30, east: -80, north: 45 };
  const surface = toRenderableImagery(radarProduct(), viewport, NOW);
  assert.ok(surface);
  assert.equal(surface.availability, "covered");
  assert.equal(surface.render, true);
  // Every observed area travels with the surface so the renderer clips to
  // each one individually.
  assert.deepEqual(
    surface.areas.map((area) => area.name),
    ["Continental United States", "Guam"],
  );
});

test("a viewport outside coverage draws nothing and makes no weather claim", () => {
  const viewport = { west: 10, south: 45, east: 20, north: 55 }; // central Europe
  const surface = toRenderableImagery(radarProduct(), viewport, NOW);
  assert.ok(surface);
  assert.equal(surface.availability, "outside-coverage");
  assert.equal(surface.render, false);
  // The wording must describe a missing source, never absent precipitation.
  assert.match(surface.message, /does not observe this area/);
  assert.ok(!/no precipitation|no rain|clear skies/i.test(surface.message));
});

test("a viewport straddling the coverage edge still renders the covered part", () => {
  // Spans the Pacific coast and open ocean west of it.
  const viewport = { west: -180, south: 20, east: -100, north: 50 };
  const surface = toRenderableImagery(radarProduct(), viewport, NOW);
  assert.ok(surface);
  assert.equal(surface.availability, "covered");
  assert.equal(surface.render, true);
  // The clip is the provider's areas, not the viewport, so the uncovered
  // ocean in view is simply never requested.
  assert.equal(surface.areas[0].west, -127);
});

test("coverage areas are never merged into one envelope", () => {
  // Merging the CONUS box with Guam would produce -127..150, declaring the
  // whole Pacific, Europe and Asia covered. Tested explicitly because this
  // is the single most damaging shortcut available in this model.
  const product = radarProduct();
  const europe = { west: 10, south: 45, east: 20, north: 55 };
  assert.equal(isOutsideCoverage(product.coverage.areas, europe), true);
  const merged = {
    west: Math.min(...product.coverage.areas.map((a) => a.west)),
    east: Math.max(...product.coverage.areas.map((a) => a.east)),
    south: Math.min(...product.coverage.areas.map((a) => a.south)),
    north: Math.max(...product.coverage.areas.map((a) => a.north)),
  };
  assert.equal(boundsIntersect(merged, europe), true);
});

test("bounds intersection is exact at the edges", () => {
  const conus = {
    name: "Continental United States",
    west: -127,
    south: 23,
    east: -64,
    north: 51,
  };
  assert.equal(
    boundsIntersect(conus, { west: -180, south: 0, east: -127, north: 23 }),
    true,
  );
  assert.equal(
    boundsIntersect(conus, { west: -180, south: 0, east: -128, north: 22 }),
    false,
  );
  // A global product has no areas and is never outside coverage.
  assert.equal(isOutsideCoverage([], { west: 0, south: 0, east: 1, north: 1 }), false);
  // An unknown viewport never pre-emptively hides a surface.
  assert.equal(isOutsideCoverage([conus], null), false);
});

/* -------------------------------------------------------------------------- */
/* Freshness and availability                                                 */
/* -------------------------------------------------------------------------- */

test("freshness uses the product's own stale threshold, not a shared one", () => {
  const product = radarProduct();
  assert.equal(evaluateFreshness(product, NOW), "fresh");
  assert.equal(
    evaluateFreshness(product, new Date("2026-10-01T14:00:00.000Z")),
    "stale",
  );
  assert.equal(surfaceAgeMs(product, NOW), 181_000);
});

test("a product with no published frame time is unknown, never fresh", () => {
  const product = radarProduct({ sourceTimestamp: null });
  assert.equal(evaluateFreshness(product, NOW), "unknown");
  assert.equal(surfaceAgeMs(product, NOW), null);
  // Still drawable: the provider is serving data, the time is just unstated.
  const surface = toRenderableImagery(product, null, NOW);
  assert.equal(surface?.render, true);
});

test("a stale surface is still drawn, and says so", () => {
  const late = new Date("2026-10-01T14:00:00.000Z");
  const surface = toRenderableImagery(radarProduct(), null, late);
  assert.ok(surface);
  assert.equal(surface.availability, "stale");
  assert.equal(surface.freshness, "stale");
  assert.equal(surface.render, true);
});

test("an unavailable provider outranks coverage, and draws nothing", () => {
  const product = radarProduct({
    availability: "unavailable",
    imagery: null,
    message: "NOAA/NWS radar declined the request (HTTP 403).",
  });
  // No imagery service at all: there is nothing to hand the renderer.
  assert.equal(toRenderableImagery(product, null, NOW), null);
  assert.equal(
    resolveAvailability(product, { west: 10, south: 45, east: 20, north: 55 }, NOW),
    "unavailable",
  );
});

test("an unconfigured product is distinguished from an unavailable one", () => {
  const product = radarProduct({ availability: "unconfigured", imagery: null });
  assert.equal(resolveAvailability(product, null, NOW), "unconfigured");
});

/* -------------------------------------------------------------------------- */
/* Pipeline separation                                                        */
/* -------------------------------------------------------------------------- */

function spatialSource(
  overrides: Partial<SpatialLayerSourceResult> = {},
): SpatialLayerSourceResult {
  const product = radarProduct();
  const surface = toRenderableImagery(product, null, NOW);
  return {
    layerId: "weather",
    enabled: true,
    kind: "imagery",
    products: [product],
    imagery: surface ? [surface] : [],
    status: {
      isLoading: false,
      isFetching: false,
      hasError: false,
      isUnavailable: false,
    },
    refetch: () => {},
    ...overrides,
  };
}

test("combineSpatialSources yields surfaces and status, never observations", () => {
  const { imagery, statusByLayer } = combineSpatialSources([spatialSource()]);
  assert.equal(imagery.length, 1);
  assert.equal(imagery[0].key, "weather:nws-radar-base-reflectivity");
  assert.equal(statusByLayer.weather.isUnavailable, false);
  // Surfaces have no record identity; nothing here can be selected.
  assert.equal("latitude" in imagery[0], false);
  assert.equal("longitude" in imagery[0], false);
});

test("a disabled spatial layer reports status but contributes no surface", () => {
  const { imagery, statusByLayer } = combineSpatialSources([
    spatialSource({ enabled: false }),
  ]);
  assert.equal(imagery.length, 0);
  assert.ok(statusByLayer.weather);
});

test("surfaces that must not be drawn never reach the renderer", () => {
  const product = radarProduct();
  const outside = toRenderableImagery(
    product,
    { west: 10, south: 45, east: 20, north: 55 },
    NOW,
  );
  const { imagery } = combineSpatialSources([
    spatialSource({ imagery: outside ? [outside] : [] }),
  ]);
  assert.equal(imagery.length, 0);
});

test("marker sampling caps are not applied to imagery layers", () => {
  // The observation sampler is driven entirely by the observation array and
  // the registry's sampling strategy. The weather layer declares neither, so
  // enabling it cannot change what the sampler does.
  type Point = BaseObservation<"cameras", "camera">;
  const observations: Point[] = Array.from({ length: 5 }, (_, index) => ({
    layerId: "cameras",
    kind: "camera",
    id: `cam-${index}`,
    key: `cameras:cam-${index}`,
    latitude: 40 + index,
    longitude: -100,
    label: `Camera ${index}`,
    observedAt: null,
    detail: null,
    providerId: "qld-tmr",
    providerName: "QLDTraffic",
    sourceUrl: "https://example.test",
    attribution: "Test",
    catalogueUrl: "https://example.test",
    providerStatus: null,
  }));

  const sampled = selectRenderableObservations(observations, null, layerRegistry);
  assert.equal(sampled.observations.length, 5);
  assert.equal(layerRegistry.require("weather").sampling, undefined);
  // The sampler never produces a bucket for the imagery layer, because no
  // observation ever carries its layer id.
  assert.equal(
    sampled.samples.some((sample) => sample.layerId === "weather"),
    false,
  );
});

/* -------------------------------------------------------------------------- */
/* Panel / provenance UI                                                      */
/* -------------------------------------------------------------------------- */

function renderWeatherPanel(input: Parameters<typeof weatherLayerPanel>[0]) {
  return renderToStaticMarkup(
    React.createElement(GlobalLayerControl, {
      layers: [weatherLayerPanel(input)],
    }),
  );
}

const basePanelInput = {
  enabled: true,
  onEnabledChange: () => {},
  isLoading: false,
  isFetching: false,
  hasError: false,
  isUnavailable: false,
  now: NOW,
};

test("the weather panel exposes provider, product, frame time and check time", () => {
  const markup = renderWeatherPanel({
    ...basePanelInput,
    products: [radarProduct()],
  });
  assert.ok(markup.includes("Radar base reflectivity (MRMS)"));
  assert.ok(markup.includes("NOAA / National Weather Service"));
  // Frame valid time and retrieval time are both shown, and are different.
  assert.ok(markup.includes("2026-10-01 13:06:59Z"));
  assert.ok(markup.includes("2026-10-01 13:10:00Z"));
  assert.ok(markup.includes("3 min ago"));
});

test("the weather panel states coverage, attribution, licence and a source link", () => {
  const markup = renderWeatherPanel({
    ...basePanelInput,
    products: [radarProduct()],
  });
  assert.ok(markup.includes("no radar source"));
  assert.ok(
    markup.includes(
      "National Oceanic and Atmospheric Administration, NOAA, National Weather Service, NWS",
    ),
  );
  assert.ok(markup.includes("U.S. public domain (NOAA/NWS)"));
  assert.ok(markup.includes("https://radar.weather.gov/"));
  // The rendering contract is discoverable, not hidden in code.
  assert.ok(markup.includes("WMS 1.3.0 · EPSG:3857 · image/png"));
});

test("the weather panel reports staleness without hiding the surface", () => {
  const markup = renderWeatherPanel({
    ...basePanelInput,
    now: new Date("2026-10-01T14:00:00.000Z"),
    products: [radarProduct({ availability: "stale" })],
  });
  assert.ok(markup.includes("Weather surface is stale"));
  assert.ok(markup.includes("53 min ago"));
});

test("the weather panel reports provider failure as a source problem", () => {
  const markup = renderWeatherPanel({
    ...basePanelInput,
    isUnavailable: true,
    products: [
      radarProduct({
        availability: "unavailable",
        imagery: null,
        sourceTimestamp: null,
        message: "NOAA/NWS radar declined the request (HTTP 403).",
      }),
    ],
  });
  assert.ok(markup.includes("Weather provider unavailable"));
  assert.ok(markup.includes("HTTP 403"));
  assert.ok(markup.includes("not published"));
  assert.ok(!/no precipitation|no rain|clear skies/i.test(markup));
});

test("an empty weather response blames the source, not the weather", () => {
  const markup = renderWeatherPanel({ ...basePanelInput, products: [] });
  assert.ok(
    markup.includes(
      "a statement about the source, not about the weather",
    ),
  );
});

test("a forecast product would show its valid time and model run", () => {
  // No field provider exists yet; this pins that the shared panel already
  // keeps model time separate from observation time when one arrives.
  const markup = renderWeatherPanel({
    ...basePanelInput,
    products: [
      radarProduct({
        productName: "Synthetic forecast fixture",
        validTime: "2026-10-01T18:00:00.000Z",
        runTime: "2026-10-01T06:00:00.000Z",
      }),
    ],
  });
  assert.ok(markup.includes("Forecast valid"));
  assert.ok(markup.includes("2026-10-01 18:00:00Z"));
  assert.ok(markup.includes("Model run"));
  assert.ok(markup.includes("2026-10-01 06:00:00Z"));
});

/* -------------------------------------------------------------------------- */
/* Regression: imagery must not touch the observation path                    */
/* -------------------------------------------------------------------------- */

test("a surface cannot be resolved as a selected observation", () => {
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  assert.ok(surface);
  // The observation finder works on { layerId, id }. The surface's product
  // id is deliberately not reachable through it, because selecting a
  // continuous surface would mean fabricating a record that does not exist.
  const observations: BaseObservation[] = [];
  assert.equal(
    findObservation(observations, {
      layerId: "weather",
      id: surface.productId,
    }),
    null,
  );
});

test("the inspector never opens for the imagery layer", () => {
  // The inspector is gated on the registry's inspector capability, which the
  // validator forbids a spatial layer from declaring. Clicking imagery
  // therefore cannot produce a selected record.
  assert.equal(layerRegistry.require("weather").capabilities.inspector, false);
  assert.deepEqual(
    layerRegistry
      .withCapability("inspector")
      .map((definition) => String(definition.id))
      .sort(),
    ["cameras", "maritime", "natural-hazards", "public-events"],
  );
});

test("the globe draws markers for observation layers only", () => {
  // `globe` now spans two renderers, so the marker guarantee is expressed
  // the way marker consumers must actually express it: capability AND kind.
  const globeLayers = layerRegistry.withCapability("globe");
  assert.ok(globeLayers.length > 0);

  const markerLayers = globeLayers.filter((d) => d.kind === "observation");
  assert.ok(markerLayers.length > 0);
  // Every layer eligible for markers can actually produce one.
  for (const definition of markerLayers) {
    assert.ok(definition.display.markerColor);
  }
  // Every globe-capable spatial layer is a surface, never a marker source.
  for (const definition of globeLayers.filter((d) => d.kind !== "observation")) {
    assert.equal(definition.capabilities.inspector, false);
    assert.equal(definition.sampling, undefined);
  }
});

test("registering weather leaves the observation layers untouched", () => {
  for (const id of ["cameras", "public-events", "maritime", "natural-hazards"]) {
    const definition = layerRegistry.require(id);
    assert.equal(definition.kind, "observation");
    assert.equal(definition.status, "operational");
    assert.equal(definition.capabilities.map, true);
    assert.equal(definition.capabilities.inspector, true);
    // Marker presentation is intact for every point layer.
    assert.ok(definition.display.markerColor);
    assert.ok(definition.display.markerClassName);
  }
  // Sampling strategies are unchanged by the new kind.
  assert.deepEqual(layerRegistry.require("cameras").sampling, {
    kind: "provider-balanced",
    maxMarkers: 180,
  });
});

test("default enablement keeps weather off until it is asked for", () => {
  const enablement = layerRegistry.defaultEnablement();
  assert.equal(enablement.weather, false);
  assert.equal(enablement.cameras, true);
});
