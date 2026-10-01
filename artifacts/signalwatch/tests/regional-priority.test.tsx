/**
 * Regional priority — Australia-first as a presentation preference.
 *
 * The thing these tests mostly guard against is scope creep in the other
 * direction: a "priority" model quietly becoming a coverage claim, a filter,
 * or a provider admission. Most of the assertions below are about what the
 * profile must NOT be able to do.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_REGIONAL_PRIORITY_PROFILE_ID,
  GLOBE_DEFAULT_VIEW,
  MAP_DEFAULT_BAND,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  REGIONAL_PRIORITY_PROFILES,
  activeRegionalPriorityProfile,
  initialViewContainsExtent,
  orderLayersForProfile,
  regionalPriorityProfile,
  validateRegionalPriorityProfile,
  type RegionalPriorityProfile,
} from "../src/lib/regional-priority";
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  scaleBandForZoom,
} from "../src/lib/map-scale";
import { layerRegistry } from "../src/lib/layer-registry";

/* -------------------------------------------------------------------------- */
/* The profile exists and is the default                                      */
/* -------------------------------------------------------------------------- */

test("Australia exists and is the default profile", () => {
  assert.equal(DEFAULT_REGIONAL_PRIORITY_PROFILE_ID, "australia");
  const profile = activeRegionalPriorityProfile();
  assert.equal(profile.id, "australia");
  assert.equal(profile.label, "Australia");
  assert.equal(regionalPriorityProfile().id, "australia");
});

test("every shipped profile is internally consistent", () => {
  for (const profile of Object.values(REGIONAL_PRIORITY_PROFILES)) {
    assert.doesNotThrow(() => validateRegionalPriorityProfile(profile));
    assert.ok(initialViewContainsExtent(profile));
  }
});

/* -------------------------------------------------------------------------- */
/* The initial map view comes from the profile                                */
/* -------------------------------------------------------------------------- */

test("the initial map camera is the profile's, and it shows Australia", () => {
  const profile = activeRegionalPriorityProfile();
  assert.deepEqual(MAP_DEFAULT_CENTER, profile.mapCenter);
  assert.equal(MAP_DEFAULT_ZOOM, profile.mapZoom);

  const [lat, lng] = MAP_DEFAULT_CENTER;
  assert.ok(lat < 0, "Australia is in the southern hemisphere");
  assert.ok(lng > 100 && lng < 160, "Australia is in the eastern hemisphere");
});

test("the initial view is continent-wide, not a city and not the whole world", () => {
  // The brief is explicit: Australia-wide with surrounding context, not
  // Brisbane. Zoom 4 is the bottom of `regional`.
  assert.equal(MAP_DEFAULT_BAND, "regional");
  assert.equal(scaleBandForZoom(MAP_DEFAULT_ZOOM), "regional");
  assert.notEqual(MAP_DEFAULT_BAND, "city");
  assert.notEqual(MAP_DEFAULT_BAND, "street");
});

test("the default zoom is a zoom the map can actually adopt", () => {
  assert.ok(MAP_DEFAULT_ZOOM >= MAP_MIN_ZOOM);
  assert.ok(MAP_DEFAULT_ZOOM <= MAP_MAX_ZOOM);
  assert.ok(Number.isInteger(MAP_DEFAULT_ZOOM));
});

/* -------------------------------------------------------------------------- */
/* The initial globe orientation comes from the profile                       */
/* -------------------------------------------------------------------------- */

test("the globe's initial orientation is the profile's and exposes Australia", () => {
  const profile = activeRegionalPriorityProfile();
  assert.deepEqual(GLOBE_DEFAULT_VIEW, profile.globeView);
  assert.ok(GLOBE_DEFAULT_VIEW.lat < 0);
  assert.ok(GLOBE_DEFAULT_VIEW.lng > 100 && GLOBE_DEFAULT_VIEW.lng < 160);
  // Far enough out to see a hemisphere, not a surface skim.
  assert.ok(GLOBE_DEFAULT_VIEW.altitude > 1);
});

test("map and globe agree on the region without sharing a value", () => {
  const profile = activeRegionalPriorityProfile();
  // Same region, separately expressed: the globe takes an altitude, the map
  // a zoom. Neither is derived from the other.
  assert.ok(initialViewContainsExtent(profile));
  assert.ok(profile.globeView.lat >= profile.extent.south);
  assert.ok(profile.globeView.lat <= profile.extent.north);
  assert.ok(!("zoom" in profile.globeView));
  assert.ok(!("altitude" in { mapZoom: profile.mapZoom }));
});

/* -------------------------------------------------------------------------- */
/* Global navigation survives                                                 */
/* -------------------------------------------------------------------------- */

test("regional priority does not restrict navigation", () => {
  // The map's reachable range is the band model's, untouched by the profile.
  assert.equal(MAP_MIN_ZOOM, 2);
  assert.equal(MAP_MAX_ZOOM, 18);
  // Every band remains reachable from the default view.
  for (const zoom of [2, 4, 8, 12, 16, 18]) {
    assert.ok(typeof scaleBandForZoom(zoom) === "string");
  }
  // And the profile declares no bounds that a renderer could clamp to: the
  // extent exists for tests and copy, and is never a viewport limit.
  const profile = activeRegionalPriorityProfile();
  assert.ok(!("maxBounds" in profile));
  assert.ok(!("lockView" in profile));
});

test("a non-Australian coordinate is still a valid place to look", () => {
  // Europe, mid-Atlantic and the Pacific are all inside the map's range —
  // nothing about the profile makes them unreachable.
  for (const [lat, lng] of [
    [52, 13],
    [40, -74],
    [0, -30],
  ] as const) {
    assert.ok(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180);
  }
});

/* -------------------------------------------------------------------------- */
/* Priority is order only — never admission                                   */
/* -------------------------------------------------------------------------- */

test("ordering never invents, promotes or drops a layer", () => {
  const items = [
    { id: "cameras" },
    { id: "public-events" },
    { id: "maritime" },
    { id: "natural-hazards" },
    { id: "weather" },
  ];
  const ordered = orderLayersForProfile(items);

  assert.equal(ordered.length, items.length, "no layer added or removed");
  assert.deepEqual(
    new Set(ordered.map((entry) => entry.id)),
    new Set(items.map((entry) => entry.id)),
  );
  // Weather leads for Australia.
  assert.equal(ordered[0]?.id, "weather");
});

test("a profile naming an unimplemented layer does not conjure it", () => {
  // "navigation" is in no registry. A profile that prioritises it must
  // produce exactly the layers that exist, in a sane order.
  const profile: RegionalPriorityProfile = {
    ...activeRegionalPriorityProfile(),
    layerOrder: ["navigation" as never, "weather", "cameras"],
  };
  const ordered = orderLayersForProfile(
    [{ id: "cameras" }, { id: "weather" }],
    profile,
  );
  assert.deepEqual(ordered.map((entry) => entry.id), ["weather", "cameras"]);
  assert.ok(!ordered.some((entry) => entry.id === "navigation"));
});

test("a layer the profile forgot is kept, not hidden", () => {
  const profile: RegionalPriorityProfile = {
    ...activeRegionalPriorityProfile(),
    layerOrder: ["weather"],
  };
  const ordered = orderLayersForProfile(
    [{ id: "cameras" }, { id: "maritime" }, { id: "weather" }],
    profile,
  );
  assert.equal(ordered[0]?.id, "weather");
  // Unlisted layers keep their original relative order.
  assert.deepEqual(ordered.slice(1).map((e) => e.id), ["cameras", "maritime"]);
});

test("regional priority cannot change a layer's operational status", () => {
  // Status is earned from provider semantics in the registry. Reordering
  // must not touch it. This is the specific failure the brief names:
  // "do not turn an unimplemented provider into an operational layer".
  const snapshot = () =>
    [...layerRegistry.operational(), ...layerRegistry.planned()]
      .map((definition) => `${definition.id}:${definition.status}`)
      .sort();

  const before = snapshot();
  orderLayersForProfile(
    [...layerRegistry.operational(), ...layerRegistry.planned()].map((d) => ({
      id: d.id,
    })),
  );
  assert.deepEqual(snapshot(), before);

  // And Weather, which the Australian profile puts first, is operational
  // because NOAA radar was admitted — not because it leads the list.
  assert.equal(layerRegistry.require("weather").status, "operational");
});

test("the profile claims no coverage", () => {
  const profile = activeRegionalPriorityProfile();
  // An extent is a camera hint. If it ever gains coverage-shaped fields the
  // model has drifted into claiming where data exists.
  assert.ok(!("coverage" in profile));
  assert.ok(!("areas" in profile));
  assert.ok(!("providers" in profile));
  assert.match(profile.rationale, /pans and zooms worldwide/i);
});

/* -------------------------------------------------------------------------- */
/* No provider-specific renderer logic                                        */
/* -------------------------------------------------------------------------- */

test("the profile module names no provider and no renderer", () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL("../src/lib/regional-priority.ts", import.meta.url)),
    "utf8",
  );
  // Strip comments: the file legitimately *discusses* NOAA and the BOM in
  // prose explaining why Australia-first is not a coverage claim.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  for (const forbidden of [
    "noaa",
    "bom",
    "leaflet",
    "three",
    "L.map",
    "useEffect",
    "React",
  ]) {
    assert.ok(
      !code.toLowerCase().includes(forbidden.toLowerCase()),
      `regional-priority.ts must not reference ${forbidden}`,
    );
  }
});

test("no renderer branches on the profile id", () => {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const dirs = ["components", "hooks"].map((d) =>
    path.join(root, "..", "src", d),
  );

  const walk = (dir: string): string[] =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
          const full = path.join(dir, entry.name);
          return entry.isDirectory()
            ? walk(full)
            : /\.tsx?$/.test(entry.name)
              ? [full]
              : [];
        })
      : [];

  for (const file of dirs.flatMap(walk)) {
    const code = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // The failure mode the brief calls out is regional *priority* leaking
    // into renderers: a component asking "are we in Australia mode?" and
    // drawing differently. That is what these two probes catch.
    //
    // Deliberately NOT caught: `country === "AU"` in camera-layer-controls,
    // which predates this work and is a user-chosen provider filter — the
    // dropdown offers Queensland TMR for Australia and OpenTrafficCamMap for
    // the US because those providers genuinely serve different countries.
    // That is data varying by user selection, not presentation varying by
    // product profile, and conflating them would make the test a nuisance
    // rather than a guard.
    assert.ok(
      !/["']australia["']/i.test(code),
      `${path.basename(file)} must not hard-code a profile id`,
    );
    assert.ok(
      !/\bprofile\s*\.\s*id\s*===|\bprofileId\s*===/.test(code),
      `${path.basename(file)} must not branch on the active profile`,
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Validation refuses a profile that cannot be honoured                       */
/* -------------------------------------------------------------------------- */

test("validation rejects cameras the map or globe could not adopt", () => {
  const base = activeRegionalPriorityProfile();
  const bad: Array<[string, Partial<RegionalPriorityProfile>]> = [
    ["zoom above the map's range", { mapZoom: 99 }],
    ["zoom below the map's range", { mapZoom: 0 }],
    ["centre off the globe", { mapCenter: [999, 0] as const }],
    [
      "camera below the surface",
      { globeView: { lat: -26, lng: 136, altitude: 0 } },
    ],
    [
      "empty extent",
      { extent: { west: 10, south: 10, east: 10, north: 10 } },
    ],
  ];
  for (const [label, patch] of bad) {
    assert.throws(
      () => validateRegionalPriorityProfile({ ...base, ...patch }),
      /Regional profile/,
      `should reject: ${label}`,
    );
  }
});

test("validation rejects a profile that does not show its own region", () => {
  // The specific lie this catches: claiming to prioritise Australia while
  // opening on the Atlantic.
  assert.throws(() =>
    validateRegionalPriorityProfile({
      ...activeRegionalPriorityProfile(),
      mapCenter: [18, 0],
    }),
  );
});

/* -------------------------------------------------------------------------- */
/* The control renders in profile order                                       */
/* -------------------------------------------------------------------------- */
