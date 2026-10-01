/**
 * Map 2.0 — scale bands and layer scale policy.
 *
 * Two things are under test here, and they are deliberately separate:
 *
 *   1. the band table itself, checked against Leaflet's actual ground
 *      resolution rather than against the numbers it was written from, so a
 *      future edit to the table has to survive the arithmetic;
 *   2. the policy that layers declare on top of it, checked for the thing it
 *      exists to prevent — a layer going silent without being able to say
 *      why, and a raster being drawn past the resolution of its source.
 *
 * Leaflet itself is never instantiated: these tests run without a DOM, which
 * is exactly why the scale model is pure and lives outside the component.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GlobalLayerControl } from "../src/components/global-layer-control";
import { weatherLayerPanel } from "../src/components/layer-panels/weather-layer-panel";
import {
  bandIndex,
  bandsBetween,
  isBandAtLeast,
  isBandAtMost,
  MAP_FOCUS_ZOOM,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_SCALE_BAND_QUESTION,
  MAP_SCALE_BAND_ZOOM,
  MAP_SCALE_BANDS,
  metresPerPixel,
  scaleBandForZoom,
  type MapScaleBand,
} from "../src/lib/map-scale";
import {
  createLayerRegistry,
  isLayerVisibleAtBand,
  layerRegistry,
  layerScalePolicy,
  validateLayerDefinition,
  weatherLayerDefinition,
  type LayerDefinition,
} from "../src/lib/layer-registry";
import {
  imageryRenderSignature,
  isBeyondScale,
  toRenderableImagery,
  type SpatialProduct,
} from "../src/lib/spatial-layers";

const NOW = new Date("2026-10-01T13:10:00.000Z");

/* -------------------------------------------------------------------------- */
/* The band table                                                             */
/* -------------------------------------------------------------------------- */

test("bands tile the zoom range with no gap and no overlap", () => {
  // A gap would make scaleBandForZoom fall through to its default and
  // silently report "global" in the middle of a street view.
  let expectedNext = MAP_MIN_ZOOM;
  for (const band of MAP_SCALE_BANDS) {
    const range = MAP_SCALE_BAND_ZOOM[band];
    assert.equal(
      range.minZoom,
      expectedNext,
      `band "${band}" should start at ${expectedNext}`,
    );
    assert.ok(range.maxZoom >= range.minZoom, `band "${band}" is inverted`);
    expectedNext = range.maxZoom + 1;
  }
  assert.equal(expectedNext - 1, MAP_MAX_ZOOM);
});

test("every zoom in range resolves to the band that contains it", () => {
  for (let zoom = MAP_MIN_ZOOM; zoom <= MAP_MAX_ZOOM; zoom += 1) {
    const band = scaleBandForZoom(zoom);
    const range = MAP_SCALE_BAND_ZOOM[band];
    assert.ok(
      zoom >= range.minZoom && zoom <= range.maxZoom,
      `zoom ${zoom} resolved to "${band}" (${range.minZoom}-${range.maxZoom})`,
    );
  }
});

test("the band edges match Leaflet's real ground resolution", () => {
  // Leaflet EPSG:3857: 256 px tiles across a 40_075_016.686 m equator.
  // These are the numbers the band boundaries were chosen from; if the
  // projection constants ever change the table has to be revisited.
  assert.ok(Math.abs(metresPerPixel(0) - 156_543.03) < 1);
  assert.ok(Math.abs(metresPerPixel(8) - 611.5) < 1);
  assert.ok(Math.abs(metresPerPixel(12) - 38.2) < 0.1);
  assert.ok(Math.abs(metresPerPixel(16) - 2.4) < 0.1);

  // `global` really is a scale at which a road is sub-pixel.
  assert.ok(metresPerPixel(MAP_SCALE_BAND_ZOOM.global.maxZoom) > 10_000);
  // `street` really is a scale at which a road has width.
  assert.ok(metresPerPixel(MAP_SCALE_BAND_ZOOM.street.maxZoom) < 10);
  // `streetContext` really is lane level.
  assert.ok(metresPerPixel(MAP_SCALE_BAND_ZOOM.streetContext.maxZoom) < 1);
});

test("out-of-range and malformed zooms clamp instead of throwing", () => {
  // Leaflet reports fractional and briefly out-of-range zooms mid-animation.
  assert.equal(scaleBandForZoom(-5), "global");
  assert.equal(scaleBandForZoom(0), "global");
  assert.equal(scaleBandForZoom(99), "streetContext");
  assert.equal(scaleBandForZoom(Number.NaN), "global");
  assert.equal(scaleBandForZoom(Number.POSITIVE_INFINITY), "global");
  // Fractional zooms floor, matching Leaflet's own tile-level choice.
  assert.equal(scaleBandForZoom(11.9), scaleBandForZoom(11));
  assert.equal(scaleBandForZoom(12.0), "street");
});

test("map defaults sit inside the band table", () => {
  // The initial zoom moved out of this module in Checkpoint C: it is now a
  // regional-profile decision, pinned in regional-priority.test.tsx.
  // Focusing a record should land on the city question, not the regional one.
  assert.equal(scaleBandForZoom(MAP_FOCUS_ZOOM), "city");
  assert.ok(MAP_FOCUS_ZOOM >= MAP_MIN_ZOOM && MAP_FOCUS_ZOOM <= MAP_MAX_ZOOM);
});

test("band ordering helpers run coarse to fine", () => {
  assert.ok(bandIndex("global") < bandIndex("city"));
  assert.ok(bandIndex("city") < bandIndex("streetContext"));
  assert.equal(isBandAtLeast("street", "city"), true);
  assert.equal(isBandAtLeast("city", "street"), false);
  assert.equal(isBandAtLeast("city", "city"), true);
  assert.equal(isBandAtMost("city", "street"), true);
  assert.deepEqual(bandsBetween("regional", "street"), [
    "regional",
    "city",
    "street",
  ]);
  // Endpoint order must not matter.
  assert.deepEqual(bandsBetween("street", "regional"), bandsBetween("regional", "street"));
});

test("every band states the question it answers", () => {
  for (const band of MAP_SCALE_BANDS) {
    assert.match(MAP_SCALE_BAND_QUESTION[band], /\?$/);
  }
});

/* -------------------------------------------------------------------------- */
/* Layer scale policy                                                         */
/* -------------------------------------------------------------------------- */

test("a layer without a policy is drawn at every scale", () => {
  // The regression guard: adding this model must not change any existing
  // layer's behaviour.
  for (const definition of layerRegistry.definitions) {
    if (definition.scale) continue;
    const policy = layerScalePolicy(definition);
    assert.equal(policy.minBand, "global");
    assert.equal(policy.maxBand, "streetContext");
    assert.equal(policy.note, null);
    for (const band of MAP_SCALE_BANDS) {
      assert.equal(isLayerVisibleAtBand(definition, band), true);
    }
  }
});

test("existing observation layers are unaffected by the scale model", () => {
  for (const id of ["cameras", "public-events", "maritime", "natural-hazards"]) {
    const definition = layerRegistry.require(id);
    assert.equal(definition.scale, undefined);
    for (const band of MAP_SCALE_BANDS) {
      assert.equal(isLayerVisibleAtBand(definition, band), true);
    }
  }
});

test("radar stops at street scale because of its sample spacing", () => {
  const policy = layerScalePolicy(weatherLayerDefinition);
  assert.equal(policy.minBand, "global");
  assert.equal(policy.maxBand, "street");
  assert.ok(policy.note);

  assert.equal(isLayerVisibleAtBand(weatherLayerDefinition, "global"), true);
  assert.equal(isLayerVisibleAtBand(weatherLayerDefinition, "regional"), true);
  assert.equal(isLayerVisibleAtBand(weatherLayerDefinition, "city"), true);
  assert.equal(isLayerVisibleAtBand(weatherLayerDefinition, "street"), true);
  assert.equal(
    isLayerVisibleAtBand(weatherLayerDefinition, "streetContext"),
    false,
  );

  // The limit must remain justified by the provider's own pixel size: one
  // MRMS sample is 564.774 m, and the cut is placed where a single sample
  // would cover more than a hundred screen pixels.
  const atCut = metresPerPixel(MAP_SCALE_BAND_ZOOM.streetContext.minZoom);
  assert.ok(564.774 / atCut > 100, "the suppression point is no longer extreme");
});

test("the registry can list layers for a band without naming any of them", () => {
  const atStreetContext = layerRegistry
    .visibleAtBand("streetContext")
    .map((definition) => String(definition.id));
  const atCity = layerRegistry
    .visibleAtBand("city")
    .map((definition) => String(definition.id));

  assert.ok(atCity.includes("weather"));
  assert.ok(!atStreetContext.includes("weather"));
  // Nothing else drops out, so this is a weather-specific policy and not an
  // accidental global filter.
  assert.deepEqual(
    atCity.filter((id) => id !== "weather"),
    atStreetContext,
  );
});

test("a scale range that can never draw is rejected at registration", () => {
  const broken: LayerDefinition = {
    ...weatherLayerDefinition,
    id: "broken-scale",
    scale: { minBand: "street", maxBand: "regional", note: "impossible" },
  };
  assert.throws(() => validateLayerDefinition(broken), /empty scale range/);
  assert.throws(() => createLayerRegistry([broken]), /empty scale range/);
});

test("a layer may not go silent without saying why", () => {
  const mute: LayerDefinition = {
    ...weatherLayerDefinition,
    id: "mute-scale",
    scale: { maxBand: "city" },
  };
  // A layer that disappears at some zoom and cannot explain itself is
  // indistinguishable from a bug, so the registry refuses it.
  assert.throws(() => validateLayerDefinition(mute), /gives no note/);
});

/* -------------------------------------------------------------------------- */
/* Scale reaching the surface model                                           */
/* -------------------------------------------------------------------------- */

function radarProduct(overrides: Partial<SpatialProduct> = {}): SpatialProduct {
  return {
    id: "nws-radar-base-reflectivity",
    layerId: "weather",
    kind: "imagery",
    providerId: "noaa-nws-radar",
    providerName: "NOAA / National Weather Service",
    productName: "Radar base reflectivity (MRMS)",
    productDescription: "MRMS composite base reflectivity.",
    attribution:
      "National Oceanic and Atmospheric Administration, NOAA, National Weather Service, NWS",
    sourceUrl: "https://radar.weather.gov/",
    licence: "U.S. public domain (NOAA/NWS)",
    coverage: {
      scope: "regional",
      regions: ["Continental United States"],
      note: "NOAA observes the continental United States only.",
      areas: [
        {
          name: "Continental United States",
          west: -127,
          south: 23,
          east: -65,
          north: 50,
        },
      ],
    },
    sourceTimestamp: "2026-10-01T13:05:00.000Z",
    ingestionTimestamp: "2026-10-01T13:08:00.000Z",
    validTime: null,
    runTime: null,
    refreshIntervalMs: 600_000,
    staleAfterMs: 1_800_000,
    availability: "covered",
    message: "NOAA radar is reachable.",
    imagery: {
      protocol: "wms",
      endpoint:
        "https://mapservices.weather.noaa.gov/eventdriven/services/radar/radar_base_reflectivity_time/ImageServer/WMSServer",
      layer: "radar_base_reflectivity_time",
      version: "1.3.0",
      crs: "EPSG:3857",
      supportedCrs: ["CRS:84", "EPSG:4326", "EPSG:3857"],
      format: "image/png",
      transparent: true,
      timeParameter: "time",
      opacity: 0.68,
    },
    field: null,
    ...overrides,
  } as SpatialProduct;
}

const WEATHER_SCALE = layerScalePolicy(weatherLayerDefinition);
const OVER_CONUS = { west: -100, south: 30, east: -80, north: 45 };
const OVER_EUROPE = { west: 10, south: 45, east: 20, north: 55 };

test("an unknown band never suppresses a surface", () => {
  // Same rule as an unknown viewport: silence must be a decision, not a gap.
  assert.equal(isBeyondScale({ band: null, scale: WEATHER_SCALE }), false);
  assert.equal(isBeyondScale({ band: "streetContext", scale: null }), false);

  const surface = toRenderableImagery(radarProduct(), OVER_CONUS, NOW, {
    scale: WEATHER_SCALE,
  });
  assert.ok(surface);
  assert.equal(surface.availability, "covered");
  assert.equal(surface.render, true);
});

test("zooming past the sample spacing stops the draw and says so", () => {
  const surface = toRenderableImagery(radarProduct(), OVER_CONUS, NOW, {
    band: "streetContext",
    scale: WEATHER_SCALE,
  });
  assert.ok(surface);
  assert.equal(surface.availability, "beyond-resolution");
  assert.equal(surface.render, false);
  // It must not read as a weather report, and must not read as an outage.
  assert.ok(!/no precipitation|no rain|clear|unavailable/i.test(surface.message));
  assert.match(surface.message, /565 m|samples/i);
});

test("inside coverage and inside scale still draws", () => {
  for (const band of ["global", "regional", "city", "street"] as MapScaleBand[]) {
    const surface = toRenderableImagery(radarProduct(), OVER_CONUS, NOW, {
      band,
      scale: WEATHER_SCALE,
    });
    assert.ok(surface);
    assert.equal(surface.render, true, `band ${band} should draw`);
  }
});

test("missing coverage outranks being zoomed in too far", () => {
  // Both conditions hold over Europe at street-context zoom. The user needs
  // to be told there is no source, which is the more fundamental fact; the
  // resolution caveat would imply a source exists and is merely too coarse.
  const surface = toRenderableImagery(radarProduct(), OVER_EUROPE, NOW, {
    band: "streetContext",
    scale: WEATHER_SCALE,
  });
  assert.ok(surface);
  assert.equal(surface.availability, "outside-coverage");
  assert.match(surface.message, /does not observe this area/);
});

test("provider failure still outranks every view-derived state", () => {
  const surface = toRenderableImagery(
    radarProduct({ availability: "unavailable", message: "NOAA did not answer." }),
    OVER_CONUS,
    NOW,
    { band: "streetContext", scale: WEATHER_SCALE },
  );
  assert.ok(surface);
  assert.equal(surface.availability, "unavailable");
});

/* -------------------------------------------------------------------------- */
/* Available vs active                                                        */
/* -------------------------------------------------------------------------- */

function renderControl(enabled: boolean, surfaces: Parameters<typeof weatherLayerPanel>[0]["surfaces"] = []) {
  const panel = weatherLayerPanel({
    enabled,
    onEnabledChange: () => {},
    products: [radarProduct()],
    surfaces,
    isLoading: false,
    isFetching: false,
    hasError: false,
    isUnavailable: false,
    now: NOW,
  });
  return renderToStaticMarkup(
    React.createElement(GlobalLayerControl, { layers: [panel] }),
  );
}

test("weather reads as available and inactive when switched off", () => {
  const html = renderControl(false);
  // The distinction the directive requires: an admitted source that the user
  // has not turned on must never read as unavailable or planned.
  assert.match(html, /layer-state-available-inactive/);
  assert.ok(!/layer-state-unavailable/.test(html));
  assert.ok(!/row-planned-layer-weather/.test(html));
  assert.match(html, /Available/);
  assert.match(html, /Inactive/);
});

test("weather reads as available and active when switched on", () => {
  const html = renderControl(true);
  assert.match(html, /layer-state-available-active/);
  assert.match(html, />Active</);
});

test("an enabled layer that draws nothing explains which silence it is", () => {
  const outside = toRenderableImagery(radarProduct(), OVER_EUROPE, NOW, {
    band: "city",
    scale: WEATHER_SCALE,
  });
  assert.ok(outside);
  const html = renderControl(true, [outside]);
  assert.match(html, /text-weather-view-state-nws-radar-base-reflectivity/);
  assert.match(html, /No radar source here/);
  // The phrases that would turn a missing source into a weather claim.
  assert.ok(!/No precipitation/i.test(html));
  assert.ok(!/>Clear</i.test(html));
});

test("the view-state notice is absent while the layer is off", () => {
  const outside = toRenderableImagery(radarProduct(), OVER_EUROPE, NOW, {
    band: "city",
    scale: WEATHER_SCALE,
  });
  assert.ok(outside);
  // A layer that is off is not making any claim about anywhere, so it must
  // not announce a coverage gap.
  const html = renderControl(false, [outside]);
  assert.ok(!/No radar source here/.test(html));
});

/* -------------------------------------------------------------------------- */
/* Panning must not re-request provider tiles                                 */
/* -------------------------------------------------------------------------- */

test("panning inside coverage does not change the tile identity", () => {
  // The whole reason viewport reporting is safe to add. These two views are
  // different objects, produce different surface objects, and must produce
  // the same tile layers — otherwise every pan would tear down and rebuild
  // the WMS layers and re-request NOAA tiles, breaking the ten-minute floor.
  const kansas = { west: -100, south: 36, east: -94, north: 40 };
  const ohio = { west: -84, south: 38, east: -80, north: 42 };

  const a = toRenderableImagery(radarProduct(), kansas, NOW, {
    band: "city",
    scale: WEATHER_SCALE,
  });
  const b = toRenderableImagery(radarProduct(), ohio, NOW, {
    band: "street",
    scale: WEATHER_SCALE,
  });
  assert.ok(a && b);
  assert.notEqual(a, b, "the surfaces really are different objects");
  assert.equal(imageryRenderSignature([a]), imageryRenderSignature([b]));
});

test("leaving coverage does change the tile identity", () => {
  const inside = toRenderableImagery(radarProduct(), OVER_CONUS, NOW, {
    band: "city",
    scale: WEATHER_SCALE,
  });
  const outside = toRenderableImagery(radarProduct(), OVER_EUROPE, NOW, {
    band: "city",
    scale: WEATHER_SCALE,
  });
  assert.ok(inside && outside);
  // A surface that stops drawing must actually remove its layers.
  assert.notEqual(
    imageryRenderSignature([inside]),
    imageryRenderSignature([outside]),
  );
  assert.equal(imageryRenderSignature([outside]), "");
});

test("zooming past the sample spacing removes the tiles", () => {
  const drawn = toRenderableImagery(radarProduct(), OVER_CONUS, NOW, {
    band: "street",
    scale: WEATHER_SCALE,
  });
  const suppressed = toRenderableImagery(radarProduct(), OVER_CONUS, NOW, {
    band: "streetContext",
    scale: WEATHER_SCALE,
  });
  assert.ok(drawn && suppressed);
  assert.notEqual(imageryRenderSignature([drawn]), "");
  assert.equal(imageryRenderSignature([suppressed]), "");
});

test("a new frame changes the tile identity", () => {
  // Otherwise a refreshed radar frame would never reach the screen.
  const base = toRenderableImagery(radarProduct(), OVER_CONUS, NOW, {
    band: "city",
    scale: WEATHER_SCALE,
  });
  const framed = toRenderableImagery(radarProduct(), OVER_CONUS, NOW, {
    band: "city",
    scale: WEATHER_SCALE,
    time: "2026-10-01T13:00:00.000Z",
  });
  assert.ok(base && framed);
  assert.notEqual(
    imageryRenderSignature([base]),
    imageryRenderSignature([framed]),
  );
});

test("the signature ignores freshness and availability churn", () => {
  // A surface that goes stale keeps drawing the same tiles; only the words
  // beside it change. Rebuilding layers for that would re-request imagery
  // for a purely cosmetic reason. Verified to fail if either `freshness` or
  // `availability` is leaked into the signature.
  const fresh = toRenderableImagery(radarProduct(), OVER_CONUS, NOW, {
    band: "city",
    scale: WEATHER_SCALE,
  });
  const stale = toRenderableImagery(
    radarProduct({ sourceTimestamp: "2026-10-01T11:00:00.000Z" }),
    OVER_CONUS,
    NOW,
    { band: "city", scale: WEATHER_SCALE },
  );
  assert.ok(fresh && stale);
  assert.equal(fresh.freshness, "fresh");
  assert.equal(stale.freshness, "stale");
  assert.equal(stale.render, true, "stale imagery is still real data");
  assert.equal(imageryRenderSignature([fresh]), imageryRenderSignature([stale]));
});

/* -------------------------------------------------------------------------- */
/* The panel must not contradict itself                                       */
/* -------------------------------------------------------------------------- */

/**
 * Checkpoint B found three ways the panel disagreed with the map. Each of
 * these reproduces one of them.
 */
function panelFor(
  enabled: boolean,
  viewport: { west: number; south: number; east: number; north: number },
  band: MapScaleBand,
  overrides: Partial<SpatialProduct> = {},
  flags: Record<string, unknown> = {},
) {
  const product = radarProduct(overrides);
  const surface = toRenderableImagery(product, viewport, NOW, {
    band,
    scale: WEATHER_SCALE,
  });
  return weatherLayerPanel({
    enabled,
    onEnabledChange: () => {},
    products: [product],
    surfaces: surface ? [surface] : [],
    isLoading: false,
    isFetching: false,
    hasError: false,
    isUnavailable: false,
    now: NOW,
    ...flags,
  });
}

function metric(panel: ReturnType<typeof weatherLayerPanel>, testId: string) {
  return panel.metrics?.find((entry) => entry.testId === testId)?.value;
}

test('"Surfaces drawn" counts what is on the map, not what the server serves', () => {
  // The server reports the product as covered whenever NOAA answers, which
  // is true no matter where the user is looking. Counting products claimed
  // one surface was drawn over Europe while the map was empty.
  assert.equal(metric(panelFor(true, OVER_CONUS, "city"), "weather-surfaces-drawn"), "1");
  assert.equal(metric(panelFor(true, OVER_EUROPE, "city"), "weather-surfaces-drawn"), "0");
  assert.equal(
    metric(panelFor(true, OVER_CONUS, "streetContext"), "weather-surfaces-drawn"),
    "0",
  );
});

test("the headline never claims surfaces are available while drawing none", () => {
  // Previously the headline read "Weather surfaces available" directly
  // above the body saying "No radar source here".
  const europe = panelFor(true, OVER_EUROPE, "city");
  assert.equal(europe.status.label, "No radar source in this view");
  assert.equal(europe.status.tone, "quiet");

  const zoomed = panelFor(true, OVER_CONUS, "streetContext");
  assert.equal(zoomed.status.label, "Not drawn at this zoom");
  assert.equal(zoomed.status.tone, "quiet");

  // An honest coverage limit is not a fault, so it must not be toned as one.
  assert.notEqual(europe.status.tone, "bad");
  assert.notEqual(zoomed.status.tone, "warn");

  // And the working case is unchanged.
  assert.equal(
    panelFor(true, OVER_CONUS, "city").status.label,
    "Weather surfaces available",
  );
});

test("stale still reports as stale rather than as silence", () => {
  // Stale imagery is drawn, so the silence branch must not swallow it.
  const stale = panelFor(true, OVER_CONUS, "city", {
    sourceTimestamp: "2026-10-01T11:00:00.000Z",
  });
  assert.equal(stale.status.label, "Weather surface is stale");
  assert.equal(metric(stale, "weather-surfaces-drawn"), "1");
});

test("a provider outage reads as not available without erasing the source", () => {
  const down = panelFor(true, OVER_CONUS, "city", { availability: "unavailable" }, {
    isUnavailable: true,
  });
  assert.equal(down.reachable, false);
  const html = renderToStaticMarkup(
    React.createElement(GlobalLayerControl, { layers: [down] }),
  );
  assert.match(html, /layer-state-unavailable-active/);
  assert.match(html, />Not available</);
  // The layer is still admitted and implemented: it must not fall back into
  // the planned group, and must not read as a layer Signalwatch never built.
  assert.ok(!/row-planned-layer-weather/.test(html));
  assert.match(html, /Weather provider unavailable/);
});

test("the four admitted/reachable/active combinations stay distinct", () => {
  const seen = new Set<string>();
  for (const enabled of [false, true]) {
    for (const unavailable of [false, true]) {
      const panel = panelFor(
        enabled,
        OVER_CONUS,
        "city",
        unavailable ? { availability: "unavailable" } : {},
        { isUnavailable: unavailable },
      );
      const html = renderToStaticMarkup(
        React.createElement(GlobalLayerControl, { layers: [panel] }),
      );
      const id = /data-testid="(layer-state-[a-z-]+)"/.exec(html)?.[1];
      assert.ok(id, "badge must always render a state id");
      seen.add(id);
    }
  }
  // Four inputs, four distinguishable readouts. Any collapse here is a lie
  // about one of: whether a source exists, whether it answers, whether the
  // user asked for it.
  assert.equal(seen.size, 4);
});

test("layers with no runtime feed are not marked unreachable", () => {
  // `reachable` is optional; absent must mean "no reason to think otherwise"
  // rather than defaulting a feed-less layer into an outage state.
  const panel = panelFor(true, OVER_CONUS, "city");
  const { reachable: _dropped, ...withoutReachable } = panel;
  const html = renderToStaticMarkup(
    React.createElement(GlobalLayerControl, { layers: [withoutReachable] }),
  );
  assert.match(html, /layer-state-available-active/);
});
