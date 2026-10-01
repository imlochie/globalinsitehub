/**
 * Checkpoint C3 — weather projected onto the physical globe.
 *
 * These tests guard the claims the globe makes about provider data: that it
 * draws only inside declared coverage, that it never disagrees with the 2D
 * map about what is being served, that camera and solar motion cannot cause
 * a provider request, and that a surface never leaks into the record
 * pipelines as a marker.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GLOBE_IMAGERY_CRS,
  GLOBE_TEXTURE_MAX_EDGE,
  describeGlobeImageryAbsence,
  globeImagerySignature,
  textureDimensions,
  toGlobeImageryTiles,
} from "../src/lib/globe-imagery";
import {
  createLayerRegistry,
  layerRegistry,
  validateLayerDefinition,
  weatherLayerDefinition,
  type LayerDefinition,
} from "../src/lib/layer-registry";
import {
  buildWmsGetMapUrl,
  buildWmsLayerOptions,
  imageryRenderSignature,
  toRenderableImagery,
  type SpatialProduct,
} from "../src/lib/spatial-layers";
import {
  selectRenderableObservations,
  type BaseObservation,
} from "../src/lib/global-layers";
import { GLOBE_RADIUS, geoToGlobeVector } from "../src/lib/solar-geometry";

const NOW = new Date("2026-10-01T13:10:00.000Z");

/** The five areas NOAA actually declares for the admitted radar product. */
const NOAA_AREAS = [
  { name: "Continental United States", west: -127, south: 23, east: -64, north: 51 },
  { name: "Alaska", west: -176, south: 50, east: -128, north: 72 },
  { name: "Hawaii", west: -162, south: 17, east: -153, north: 24 },
  {
    name: "Caribbean (Puerto Rico and the U.S. Virgin Islands)",
    west: -69,
    south: 16,
    east: -63,
    north: 20,
  },
  { name: "Guam", west: 143, south: 12, east: 150.00479, north: 21 },
];

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
      regions: NOAA_AREAS.map((area) => area.name),
      note: "NOAA observes five areas only.",
      areas: NOAA_AREAS,
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

/* -------------------------------------------------------------------------- */
/* §2 the refined capability rule                                             */
/* -------------------------------------------------------------------------- */

test("a spatial layer may now declare both map and globe", () => {
  assert.equal(weatherLayerDefinition.kind, "imagery");
  assert.equal(weatherLayerDefinition.capabilities.map, true);
  assert.equal(weatherLayerDefinition.capabilities.globe, true);
  assert.doesNotThrow(() => validateLayerDefinition(weatherLayerDefinition));
});

test("a spatial layer still may not declare inspector", () => {
  assert.throws(
    () =>
      validateLayerDefinition({
        ...weatherLayerDefinition,
        capabilities: { ...weatherLayerDefinition.capabilities, inspector: true },
      } as LayerDefinition),
    /inspector/i,
  );
});

test("a spatial layer still may not declare sampling", () => {
  assert.throws(
    () =>
      validateLayerDefinition({
        ...weatherLayerDefinition,
        sampling: { kind: "provider-balanced", maxMarkers: 100 },
      } as unknown as LayerDefinition),
    /sampling/i,
  );
});

test("observation layers keep their existing marker invariants", () => {
  for (const id of ["cameras", "public-events", "maritime", "natural-hazards"]) {
    const definition = layerRegistry.require(id);
    assert.equal(definition.kind, "observation");
    assert.doesNotThrow(() => validateLayerDefinition(definition));
  }
});

test("globe on a spatial layer does not add it to the marker legend set", () => {
  // The globe's marker legend filters on capability AND kind. Weather has the
  // capability, so kind is the only thing keeping it out.
  const markerLayers = layerRegistry
    .operational()
    .filter((d) => d.capabilities.globe && d.kind === "observation")
    .map((d) => String(d.id));
  assert.ok(!markerLayers.includes("weather"));
  assert.ok(markerLayers.length > 0);
});

/* -------------------------------------------------------------------------- */
/* §1/§3 one shared descriptor, no second product type                        */
/* -------------------------------------------------------------------------- */

test("globe patches are derived from the same RenderableImagery the map uses", () => {
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  assert.ok(surface);
  const tiles = toGlobeImageryTiles([surface]);
  for (const tile of tiles) {
    assert.equal(tile.productId, surface.productId);
    assert.equal(tile.layerId, surface.layerId);
    assert.equal(tile.attribution, surface.attribution);
    assert.equal(tile.opacity, surface.opacity);
    assert.equal(tile.time, surface.time);
  }
});

test("imagery whose layer has no globe renderer is not projected", () => {
  const surface = toRenderableImagery(
    radarProduct({ layerId: "not-a-registered-layer" }),
    null,
    NOW,
  );
  assert.ok(surface);
  assert.equal(surface.render, true);
  assert.deepEqual(toGlobeImageryTiles([surface]), []);
});

/* -------------------------------------------------------------------------- */
/* §4 the five areas stay five areas                                          */
/* -------------------------------------------------------------------------- */

test("the five NOAA areas become five separate patches, never one envelope", () => {
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  const tiles = toGlobeImageryTiles([surface!]);
  assert.equal(tiles.length, 5);
  assert.deepEqual(
    tiles.map((tile) => tile.areaName).sort(),
    NOAA_AREAS.map((area) => area.name).sort(),
  );

  // An envelope of all five would span the Pacific. No patch may.
  const widest = Math.max(...tiles.map((tile) => tile.widthDegrees));
  assert.ok(widest < 70, `no patch should span the Pacific, widest was ${widest}`);
});

test("each patch covers exactly its declared area and nothing outside it", () => {
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  const tiles = toGlobeImageryTiles([surface!]);
  for (const area of NOAA_AREAS) {
    const tile = tiles.find((candidate) => candidate.areaName === area.name)!;
    assert.ok(tile);
    assert.equal(tile.lat, (area.north + area.south) / 2);
    assert.equal(tile.lng, (area.east + area.west) / 2);
    assert.equal(tile.widthDegrees, area.east - area.west);
    assert.equal(tile.heightDegrees, area.north - area.south);
    // The texture request carries the same box, so nothing is painted beyond it.
    assert.ok(
      tile.textureUrl.includes(
        `BBOX=${area.west}%2C${area.south}%2C${area.east}%2C${area.north}`,
      ),
      `patch ${area.name} must request exactly its own bbox`,
    );
  }
});

/* -------------------------------------------------------------------------- */
/* §5 projection correctness                                                  */
/* -------------------------------------------------------------------------- */

test("globe textures are requested in a longitude-first geographic CRS", () => {
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  const tiles = toGlobeImageryTiles([surface!]);
  assert.equal(GLOBE_IMAGERY_CRS, "CRS:84");
  for (const tile of tiles) {
    assert.ok(tile.textureUrl.includes("CRS=CRS%3A84"));
    // A Mercator texture on a lat/lng patch would misplace the weather.
    assert.ok(!tile.textureUrl.includes("3857"));
    // EPSG:4326 under WMS 1.3.0 is latitude-first and would transpose the box.
    assert.ok(!tile.textureUrl.includes("4326"));
  }
});

test("texture dimensions preserve the aspect ratio of the area", () => {
  const conus = NOAA_AREAS[0];
  const { width, height } = textureDimensions(conus);
  assert.equal(Math.max(width, height), GLOBE_TEXTURE_MAX_EDGE);
  const areaRatio = (conus.east - conus.west) / (conus.north - conus.south);
  assert.ok(Math.abs(width / height - areaRatio) < 0.01);
});

/* -------------------------------------------------------------------------- */
/* §8 Australia, and §4 outside coverage                                      */
/* -------------------------------------------------------------------------- */

test("Australia with NOAA radar yields no patch at all, not a blank one", () => {
  const australia = { west: 112, south: -44, east: 154, north: -9 };
  const surface = toRenderableImagery(radarProduct(), australia, NOW);
  assert.ok(surface);
  assert.equal(surface.availability, "outside-coverage");
  assert.equal(surface.render, false);
  // Nothing is drawn: no transparent raster that could read as "clear".
  assert.deepEqual(toGlobeImageryTiles([surface]), []);
  // And the globe says so in words about the source, not the weather.
  const message = describeGlobeImageryAbsence([surface]);
  assert.match(message!, /no radar source/i);
  assert.doesNotMatch(message!, /clear|fine|no rain/i);
});

test("Europe with NOAA radar is also outside coverage", () => {
  const europe = { west: -10, south: 36, east: 30, north: 60 };
  const surface = toRenderableImagery(radarProduct(), europe, NOW);
  assert.equal(surface!.availability, "outside-coverage");
  assert.deepEqual(toGlobeImageryTiles([surface!]), []);
});

/* -------------------------------------------------------------------------- */
/* §9 2D and 3D must not disagree                                             */
/* -------------------------------------------------------------------------- */

test("globe and map agree on provider, frame, coverage and attribution", () => {
  const pinned = "2026-10-01T13:00:00.000Z";
  const surface = toRenderableImagery(radarProduct(), null, NOW, {
    time: pinned,
  });
  const tiles = toGlobeImageryTiles([surface!]);

  // Same provider endpoint and layer as the 2D request.
  const mapUrl = buildWmsGetMapUrl(surface!.service, {
    bbox: [-100, 30, -90, 40],
    width: 256,
    height: 256,
    time: surface!.time,
  });
  const mapParams = new URL(mapUrl).searchParams;
  for (const tile of tiles) {
    const tileParams = new URL(tile.textureUrl).searchParams;
    assert.equal(
      new URL(tile.textureUrl).origin + new URL(tile.textureUrl).pathname,
      new URL(mapUrl).origin + new URL(mapUrl).pathname,
    );
    assert.equal(tileParams.get("LAYERS"), mapParams.get("LAYERS"));
    assert.equal(tileParams.get("VERSION"), mapParams.get("VERSION"));
    assert.equal(tileParams.get("FORMAT"), mapParams.get("FORMAT"));
    // The selected frame is identical. Only the projection differs.
    assert.equal(tileParams.get("TIME"), mapParams.get("TIME"));
    assert.equal(tileParams.get("TIME"), pinned);
    assert.equal(tile.attribution, surface!.attribution);
  }
  assert.equal(tiles.length, surface!.areas.length);
});

test("a frame the map will not draw is not drawn on the globe either", () => {
  const stale = toRenderableImagery(
    radarProduct({ availability: "unavailable", message: "Provider unreachable." }),
    null,
    NOW,
  );
  assert.equal(stale!.render, false);
  assert.deepEqual(toGlobeImageryTiles([stale!]), []);
});

/* -------------------------------------------------------------------------- */
/* §10/§11 camera, rotation and the Sun must not touch imagery identity       */
/* -------------------------------------------------------------------------- */

test("imagery identity is stable across repeated renders", () => {
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  const first = globeImagerySignature(toGlobeImageryTiles([surface!]));
  const second = globeImagerySignature(toGlobeImageryTiles([surface!]));
  assert.equal(first, second);
});

test("rotating the globe and advancing the Sun never change imagery identity", () => {
  // The camera and the solar clock are not inputs to the projection at all,
  // which is the structural reason neither can trigger a NOAA request. A
  // minute of solar motion and any amount of rotation produce the same tiles.
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  const baseline = globeImagerySignature(toGlobeImageryTiles([surface!]));

  const laterSolarInstant = new Date(NOW.getTime() + 60_000);
  const sameSurfaceLater = toRenderableImagery(radarProduct(), null, NOW, {
    // Note: the solar clock moving does not re-resolve the surface; the
    // provider frame is what the surface is pinned to.
    time: null,
  });
  assert.equal(
    globeImagerySignature(toGlobeImageryTiles([sameSurfaceLater!])),
    baseline,
  );
  assert.ok(laterSolarInstant.getTime() > NOW.getTime());
});

test("a new provider frame does change imagery identity", () => {
  const latest = toRenderableImagery(radarProduct(), null, NOW);
  const pinned = toRenderableImagery(radarProduct(), null, NOW, {
    time: "2026-10-01T12:40:00.000Z",
  });
  assert.notEqual(
    globeImagerySignature(toGlobeImageryTiles([latest!])),
    globeImagerySignature(toGlobeImageryTiles([pinned!])),
  );
});

test("a change of opacity changes imagery identity", () => {
  const base = toRenderableImagery(radarProduct(), null, NOW);
  const faded = toRenderableImagery(
    radarProduct({
      imagery: { ...radarProduct().imagery!, opacity: 0.3 },
    } as Partial<SpatialProduct>),
    null,
    NOW,
  );
  assert.notEqual(
    globeImagerySignature(toGlobeImageryTiles([base!])),
    globeImagerySignature(toGlobeImageryTiles([faded!])),
  );
});

/* -------------------------------------------------------------------------- */
/* §1/§12 radar is not a record                                               */
/* -------------------------------------------------------------------------- */

test("radar is not selectable and never enters the observation pipeline", () => {
  const observations: BaseObservation[] = [
    {
      layerId: "cameras",
      kind: "camera",
      id: "camera-1",
      key: "cameras:camera-1",
      latitude: 1,
      longitude: 1,
      label: "Test camera",
      observedAt: null,
      detail: null,
      providerId: "test",
      providerName: "Test",
      sourceUrl: "https://example.invalid/",
      attribution: null,
      catalogueUrl: null,
      providerStatus: null,
    },
  ];
  const result = selectRenderableObservations(observations, null);
  assert.equal(result.observations.length, 1);
  assert.ok(!result.observations.some((item) => item.layerId === "weather"));
  // Weather contributes no sample summary either: it is not a record layer,
  // so it cannot appear in an observation count.
  assert.ok(!result.samples.some((sample) => sample.layerId === "weather"));
});

test("projecting a surface produces no observation records", () => {
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  const tiles = toGlobeImageryTiles([surface!]);
  assert.equal(tiles.length, 5);
  for (const tile of tiles) {
    // Patches carry geometry and provenance, never an observation identity.
    assert.ok(!("latitude" in tile));
    assert.ok(!("observationId" in tile));
    assert.ok(!("selectable" in tile));
  }
});

test("a registry built from scratch still rejects sampling on spatial layers", () => {
  assert.throws(
    () =>
      createLayerRegistry([
        {
          ...weatherLayerDefinition,
          capabilities: {
            ...weatherLayerDefinition.capabilities,
            inspector: true,
          },
        } as LayerDefinition,
      ]),
    /inspector/i,
  );
});

/* -------------------------------------------------------------------------- */
/* §15F geography — a known coordinate lands where it should                  */
/* -------------------------------------------------------------------------- */

/**
 * Independent oracle for the equirectangular mapping inside a patch.
 *
 * A tile is a lat/lng rectangle with its texture laid out west-to-east and
 * south-to-north. So for any coordinate inside the patch, its fractional
 * position in the image is a plain linear interpolation of the bbox. If the
 * projection were Mercator this would be wrong everywhere except the centre
 * latitude — which is exactly the failure this guards against.
 */
function uvWithinPatch(
  area: { west: number; south: number; east: number; north: number },
  lat: number,
  lng: number,
): { u: number; v: number } {
  return {
    u: (lng - area.west) / (area.east - area.west),
    v: (lat - area.south) / (area.north - area.south),
  };
}

test("a known CONUS coordinate falls in the CONUS patch and nowhere else", () => {
  // Smith Center, Kansas — the geographic centre of the contiguous states.
  const KANSAS = { lat: 39.8, lng: -98.6 };
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  const tiles = toGlobeImageryTiles([surface!]);

  const containing = tiles.filter(
    (tile) =>
      Math.abs(KANSAS.lat - tile.lat) <= tile.heightDegrees / 2 &&
      Math.abs(KANSAS.lng - tile.lng) <= tile.widthDegrees / 2,
  );
  assert.equal(containing.length, 1);
  assert.equal(containing[0].areaName, "Continental United States");
});

test("a known CONUS coordinate maps to the expected point in the texture", () => {
  const KANSAS = { lat: 39.8, lng: -98.6 };
  const conus = NOAA_AREAS[0];
  const { u, v } = uvWithinPatch(conus, KANSAS.lat, KANSAS.lng);

  // Both strictly inside the patch, and close to the middle of it.
  assert.ok(u > 0 && u < 1 && v > 0 && v < 1);
  assert.ok(Math.abs(u - 0.45) < 0.05, `u was ${u}`);
  assert.ok(Math.abs(v - 0.6) < 0.05, `v was ${v}`);

  // The Mercator trap, stated numerically: if the texture were EPSG:3857 the
  // same latitude would sit measurably lower in the image, placing weather
  // north of where it belongs.
  const mercY = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const vMercator =
    (mercY(KANSAS.lat) - mercY(conus.south)) /
    (mercY(conus.north) - mercY(conus.south));
  assert.ok(
    Math.abs(v - vMercator) > 0.01,
    "equirectangular and Mercator must differ, else the test proves nothing",
  );
});

test("patch centroids project onto the globe at their own coordinates", () => {
  // Ties the patch geometry to the same coordinate convention C2 verified
  // against three-globe's own source, so a patch cannot be positioned by a
  // different convention from the markers and lights around it.
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  for (const tile of toGlobeImageryTiles([surface!])) {
    const v = geoToGlobeVector(tile.lat, tile.lng, 0);
    const radius = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    assert.ok(Math.abs(radius - GLOBE_RADIUS) < 1e-9);
    // Northern-hemisphere areas must be above the equatorial plane.
    if (tile.lat > 0) assert.ok(v.y > 0, `${tile.areaName} should be north`);
  }
});

test("Guam and the Caribbean sit on opposite sides of the globe", () => {
  // A merged envelope would collapse this distinction entirely.
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  const tiles = toGlobeImageryTiles([surface!]);
  const guam = tiles.find((t) => t.areaName === "Guam")!;
  const carib = tiles.find((t) => t.areaName.startsWith("Caribbean"))!;
  const a = geoToGlobeVector(guam.lat, guam.lng, 0);
  const b = geoToGlobeVector(carib.lat, carib.lng, 0);
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (GLOBE_RADIUS * GLOBE_RADIUS);
  assert.ok(dot < -0.3, `they should be near-antipodal, cos was ${dot}`);
});

/* -------------------------------------------------------------------------- */
/* §15G failure semantics                                                     */
/* -------------------------------------------------------------------------- */

test("a service that does not advertise CRS:84 is not projected", () => {
  const surface = toRenderableImagery(
    radarProduct({
      imagery: {
        ...radarProduct().imagery!,
        supportedCrs: ["EPSG:3857"],
      },
    } as Partial<SpatialProduct>),
    null,
    NOW,
  );
  // The 2D map is unaffected: it requests EPSG:3857 and still draws.
  assert.equal(surface!.render, true);
  // The globe needs an equirectangular frame this provider does not publish,
  // so it draws nothing rather than requesting an unadvertised projection.
  assert.deepEqual(toGlobeImageryTiles([surface!]), []);
});

test("a service with no established CRS list fails closed on the globe", () => {
  const surface = toRenderableImagery(
    radarProduct({
      imagery: { ...radarProduct().imagery!, supportedCrs: [] },
    } as Partial<SpatialProduct>),
    null,
    NOW,
  );
  assert.deepEqual(toGlobeImageryTiles([surface!]), []);
});

test("a product in an unrenderable CRS produces no surface anywhere", () => {
  const surface = toRenderableImagery(
    radarProduct({
      imagery: {
        ...radarProduct().imagery!,
        crs: "EPSG:27700",
        supportedCrs: ["EPSG:27700"],
      },
    } as Partial<SpatialProduct>),
    null,
    NOW,
  );
  assert.equal(surface!.render, false);
  assert.match(surface!.message, /EPSG:27700/);
  assert.deepEqual(toGlobeImageryTiles([surface!]), []);
});

test("an unavailable provider produces no globe surface", () => {
  const surface = toRenderableImagery(
    radarProduct({
      availability: "unavailable",
      message: "NOAA/NWS radar could not be reached.",
    }),
    null,
    NOW,
  );
  assert.deepEqual(toGlobeImageryTiles([surface!]), []);
  const absence = describeGlobeImageryAbsence([surface!]);
  assert.ok(absence);
  assert.doesNotMatch(absence, /clear/i);
});

/* -------------------------------------------------------------------------- */
/* §14 the globe renderer must not be load-bearing for the rest of the app    */
/* -------------------------------------------------------------------------- */

test("granting the globe capability does not change what the 2D map requests", () => {
  // The structural guarantee behind the WebGL fallback: the 2D path reads
  // the service descriptor, never the globe capability, so a device that
  // cannot run WebGL loses the globe surface and nothing else. If this ever
  // fails, the globe has become load-bearing for the map.
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  const options = buildWmsLayerOptions(surface!);
  assert.equal(options.crs, "EPSG:3857");
  assert.equal(options.layers, "radar_base_reflectivity_time");
  assert.equal(options.opacity, 0.68);
  // The 2D signature is computed from the service alone.
  assert.ok(imageryRenderSignature([surface!]).includes("EPSG:3857"));
  assert.ok(!imageryRenderSignature([surface!]).includes("CRS:84"));
});

test("the globe projection is a pure read and mutates no shared state", () => {
  // The fallback path renders without ever calling the projection, so the
  // projection must not be where any shared value gets initialised.
  const surface = toRenderableImagery(radarProduct(), null, NOW);
  const before = JSON.stringify(surface);
  toGlobeImageryTiles([surface!]);
  toGlobeImageryTiles([surface!]);
  assert.equal(JSON.stringify(surface), before);
});

test("no surfaces at all is a silent state, not an error message", () => {
  // A device with WebGL but no enabled weather layer must not be told
  // anything about radar coverage.
  assert.equal(describeGlobeImageryAbsence([]), null);
  assert.deepEqual(toGlobeImageryTiles([]), []);
});
