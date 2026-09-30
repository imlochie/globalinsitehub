import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import type {
  MaritimeProviderStatus,
  VesselRecord,
} from "@workspace/api-client-react";
import { GlobalLayerControl } from "../src/components/global-layer-control";
import { GlobalObservationInspector } from "../src/components/global-observation-inspector";
import { maritimeLayerPanel } from "../src/components/layer-panels/maritime-layer-panel";
import {
  createMaritimeLayerProviderAdapter,
  normalizeVesselRecord,
  observationKey,
  selectRenderableObservations,
  vesselFreshness,
  type MaritimeObservation,
} from "../src/lib/global-layers";
import {
  layerCoverage,
  layerRegistry,
  maritimeLayerDefinition,
} from "../src/lib/layer-registry";

const NOW = new Date("2026-09-30T06:00:00.000Z").getTime();

const vessel = (
  mmsi: string,
  provider = "digitraffic",
  overrides: Partial<VesselRecord> = {},
): VesselRecord => ({
  id: `${provider}:${mmsi}`,
  provider,
  mmsi,
  imo: null,
  callSign: null,
  name: `Vessel ${mmsi}`,
  shipType: 70,
  shipTypeLabel: "Cargo",
  latitude: 60.15,
  longitude: 24.95,
  courseOverGround: 121.4,
  heading: 118,
  speedOverGround: 9.4,
  navigationalStatus: 0,
  navigationalStatusLabel: "Under way using engine",
  destination: "HELSINKI",
  draughtMetres: 6.1,
  positionTimestamp: new Date(NOW - 60_000).toISOString(),
  receivedAt: new Date(NOW - 30_000).toISOString(),
  sourceUrl: "https://meri.digitraffic.fi/api/ais/v1/locations",
  attribution: "Source: Fintraffic / digitraffic.fi, license CC 4.0 BY",
  licence: "CC BY 4.0",
  ...overrides,
});

const providerStatus = (
  id: string,
  status: MaritimeProviderStatus["status"] = "available",
): MaritimeProviderStatus => ({
  id,
  name: `${id} feed`,
  attribution: `${id} attribution`,
  licence: "CC BY 4.0",
  licenceUrl: "https://example.test/licence",
  catalogueUrl: "https://example.test/docs",
  status,
  coverage: {
    scope: "regional",
    regions: [`${id} region`],
    note: `${id} covers only its own region.`,
  },
  vesselCount: 1,
  checkedAt: new Date(NOW).toISOString(),
  lastSuccessfulFetchAt: status === "available" ? new Date(NOW).toISOString() : null,
  message: `${id} message`,
});

/* -------------------------------------------------------------------------- */
/* Registry                                                                   */
/* -------------------------------------------------------------------------- */

test("maritime is operational, regional and never described as global", () => {
  const definition = layerRegistry.require("maritime");
  assert.equal(definition.status, "operational");
  assert.equal(definition.category, "movement");
  assert.equal(definition.observationKind, "vessel");
  assert.equal(definition.enabledByDefault, false);
  assert.equal(definition.capabilities.map, true);
  assert.equal(definition.capabilities.globe, true);
  assert.equal(definition.capabilities.inspector, true);
  assert.equal(definition.sampling?.kind, "provider-balanced");
  assert.deepEqual(
    definition.providers.map((provider) => provider.id),
    ["digitraffic", "barentswatch"],
  );
  assert.equal(
    layerRegistry.planned().some((entry) => entry.id === "maritime"),
    false,
  );

  const coverage = layerCoverage(definition);
  assert.equal(coverage.scope, "regional");
  assert.notEqual(coverage.regions.length, 0);
  assert.doesNotMatch(definition.description.toLowerCase(), /global/);
  assert.doesNotMatch(coverage.note.toLowerCase(), /global maritime/);
});

test("every maritime provider declares its own coverage and licence", () => {
  for (const provider of maritimeLayerDefinition.providers) {
    assert.equal(provider.coverage?.scope, "regional");
    assert.notEqual(provider.coverage?.regions.length, 0);
    assert.ok(provider.licence);
    assert.ok(provider.attribution);
  }
});

test("layer coverage derived from providers is never upgraded to global", () => {
  const derived = layerCoverage({
    ...maritimeLayerDefinition,
    coverage: undefined,
  });
  assert.equal(derived.scope, "regional");
  assert.match(derived.note, /Signalwatch has no source/);
});

test("operational describes sources, not runtime provider health", () => {
  // One provider healthy, one unconfigured: the layer is still operational and
  // still renders, because a source capable of supplying it exists.
  const panel = maritimeLayerPanel({
    enabled: true,
    onEnabledChange: () => {},
    provider: "all",
    onProviderChange: () => {},
    search: "",
    onSearchChange: () => {},
    providers: [
      providerStatus("digitraffic", "available"),
      providerStatus("barentswatch", "unavailable"),
    ],
    matchedCount: 5,
    returnedCount: 5,
    isLoading: false,
    isFetching: false,
    hasError: false,
    isUnavailable: false,
    isTruncated: false,
  });
  assert.equal(panel.definition.status, "operational");
  assert.equal(panel.status.tone, "good");

  const markup = renderToStaticMarkup(
    <Router ssrPath="/">
      <GlobalLayerControl layers={[panel]} />
    </Router>,
  );
  // The layer is present and the unconfigured provider is named, not hidden.
  assert.match(markup, /digitraffic feed · available/);
  assert.match(markup, /barentswatch feed · unavailable/);
  assert.match(markup, /Regional:/);
});

test("layer status never changes with provider health", () => {
  // Registry status is static data: no runtime value can flip it.
  const before = layerRegistry.require("maritime").status;
  const allDown = maritimeLayerPanel({
    enabled: true,
    onEnabledChange: () => {},
    provider: "all",
    onProviderChange: () => {},
    search: "",
    onSearchChange: () => {},
    providers: [
      providerStatus("digitraffic", "unavailable"),
      providerStatus("barentswatch", "unavailable"),
    ],
    matchedCount: 0,
    returnedCount: 0,
    isLoading: false,
    isFetching: false,
    hasError: false,
    isUnavailable: true,
    isTruncated: false,
  });
  assert.equal(allDown.definition.status, before);
  assert.equal(before, "operational");
  // Health is reported separately, and honestly.
  assert.equal(allDown.status.tone, "bad");
});

/* -------------------------------------------------------------------------- */
/* Normalization                                                              */
/* -------------------------------------------------------------------------- */

test("a valid vessel normalizes with stable identity and provenance", () => {
  const observation = normalizeVesselRecord(
    vessel("230008800"),
    [providerStatus("digitraffic")],
    NOW,
  );
  assert.ok(observation);
  assert.equal(observation.layerId, "maritime");
  assert.equal(observation.kind, "vessel");
  assert.equal(observation.key, observationKey("maritime", "digitraffic:230008800"));
  assert.equal(observation.mmsi, "230008800");
  assert.equal(observation.providerId, "digitraffic");
  assert.equal(observation.providerName, "digitraffic feed");
  assert.match(observation.attribution ?? "", /Fintraffic/);
  assert.equal(observation.licence, "CC BY 4.0");
  assert.equal(observation.record.mmsi, "230008800");
});

test("unusable coordinates are rejected instead of placed at null island", () => {
  assert.equal(
    normalizeVesselRecord(
      vessel("230008800", "digitraffic", { latitude: 999, longitude: 999 }),
      [],
      NOW,
    ),
    null,
  );
});

test("missing optional fields stay absent and are never zero-filled", () => {
  const observation = normalizeVesselRecord(
    vessel("230008800", "digitraffic", {
      name: null,
      imo: null,
      callSign: null,
      heading: null,
      courseOverGround: null,
      destination: null,
      draughtMetres: null,
    }),
    [],
    NOW,
  );
  assert.ok(observation);
  assert.equal(observation.label, "MMSI 230008800");
  assert.equal(observation.record.heading, null);
  assert.equal(observation.record.destination, null);
  assert.equal(observation.record.draughtMetres, null);
});

test("provider position time is never replaced by the Signalwatch receipt time", () => {
  const observation = normalizeVesselRecord(
    vessel("230008800", "digitraffic", { positionTimestamp: null }),
    [],
    NOW,
  );
  assert.ok(observation);
  assert.equal(observation.observedAt, null);
  assert.equal(observation.freshness, "unknown");
  assert.notEqual(observation.receivedAt, null);
});

/* -------------------------------------------------------------------------- */
/* Freshness                                                                  */
/* -------------------------------------------------------------------------- */

test("freshness is movement aware, so moored ships do not vanish", () => {
  const moving = vessel("230008800", "digitraffic", {
    speedOverGround: 12,
    positionTimestamp: new Date(NOW - 20 * 60_000).toISOString(),
  });
  const moored = vessel("230008801", "digitraffic", {
    speedOverGround: 0,
    navigationalStatus: 5,
    positionTimestamp: new Date(NOW - 20 * 60_000).toISOString(),
  });
  assert.equal(vesselFreshness(moving, NOW), "aging");
  assert.equal(vesselFreshness(moored, NOW), "fresh");
});

test("positions too old to be honest are removed, not annotated", () => {
  const ancient = vessel("230008800", "digitraffic", {
    speedOverGround: 12,
    positionTimestamp: new Date(NOW - 3 * 60 * 60_000).toISOString(),
  });
  assert.equal(vesselFreshness(ancient, NOW), "stale");
  assert.equal(normalizeVesselRecord(ancient, [], NOW), null);
});

test("a stale provider does not empty the other provider's region", () => {
  const adapter = createMaritimeLayerProviderAdapter(
    [providerStatus("digitraffic", "available"), providerStatus("barentswatch", "stale")],
    NOW,
  );
  const observations = [
    vessel("230008800", "digitraffic"),
    vessel("257011940", "barentswatch"),
  ]
    .map((record) => adapter.normalize(record))
    .filter((entry): entry is MaritimeObservation => entry !== null);
  assert.equal(observations.length, 2);
  assert.equal(
    observations.find((entry) => entry.providerId === "barentswatch")?.providerStatus
      ?.status,
    "stale",
  );
});

/* -------------------------------------------------------------------------- */
/* Generic integration                                                        */
/* -------------------------------------------------------------------------- */

test("vessels flow through the generic sampling and marker pipeline", () => {
  const adapter = createMaritimeLayerProviderAdapter([providerStatus("digitraffic")], NOW);
  const observations = Array.from({ length: 400 }, (_, index) =>
    adapter.normalize(
      vessel(String(230000000 + index), "digitraffic", {
        latitude: 59 + index / 1000,
        longitude: 24 + index / 1000,
      }),
    ),
  ).filter((entry): entry is MaritimeObservation => entry !== null);

  const selected = observations[399]!;
  const renderable = selectRenderableObservations(
    observations,
    { layerId: "maritime", id: selected.id },
    layerRegistry,
  );
  assert.equal(
    renderable.observations.length,
    maritimeLayerDefinition.sampling!.maxMarkers,
  );
  // Selection survives bounded sampling.
  assert.ok(renderable.observations.some((entry) => entry.key === selected.key));
});

test("the maritime control states regional coverage, never a global claim", () => {
  const panel = maritimeLayerPanel({
    enabled: true,
    onEnabledChange: () => {},
    provider: "all",
    onProviderChange: () => {},
    search: "",
    onSearchChange: () => {},
    providers: [providerStatus("digitraffic"), providerStatus("barentswatch", "unavailable")],
    matchedCount: 12,
    returnedCount: 12,
    isLoading: false,
    isFetching: false,
    hasError: false,
    isUnavailable: false,
    isTruncated: false,
  });
  const markup = renderToStaticMarkup(
    <Router ssrPath="/">
      <GlobalLayerControl layers={[panel]} />
    </Router>,
  );
  assert.match(markup, /Regional:/);
  assert.match(markup, /no maritime source there/);
  assert.match(markup, /barentswatch feed · unavailable/);
  assert.doesNotMatch(markup, /Global maritime/i);
  assert.doesNotMatch(markup, /worldwide/i);
});

test("the inspector shows vessel detail without inventing missing fields", () => {
  const observation = normalizeVesselRecord(
    vessel("230008800", "digitraffic", {
      name: "AURORA",
      callSign: null,
      imo: null,
      destination: "HELSINKI",
    }),
    [providerStatus("digitraffic")],
    NOW,
  );
  assert.ok(observation);
  const markup = renderToStaticMarkup(
    <Router ssrPath="/">
      <GlobalObservationInspector
        observation={observation}
        onClear={() => {}}
        registry={layerRegistry}
      />
    </Router>,
  );
  assert.match(markup, /AURORA/);
  assert.match(markup, /230008800/);
  assert.match(markup, /self-reported/i);
  assert.match(markup, /Received by Signalwatch/);
  assert.doesNotMatch(markup, /Unknown/);
  assert.doesNotMatch(markup, /N\/A/);
});

/* -------------------------------------------------------------------------- */
/* Architecture guards                                                        */
/* -------------------------------------------------------------------------- */

const sharedSourceFiles = [
  "../src/components/global-layer-control.tsx",
  "../src/components/global-observation-inspector.tsx",
  "../src/components/satellite-sector-globe.tsx",
  "../src/components/interactive-sector-globe.tsx",
  "../src/hooks/use-global-layer-data.ts",
  "../src/lib/observation-style.ts",
];

test("shared surfaces never branch on the maritime layer", async () => {
  for (const file of sharedSourceFiles) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /(===|!==)\s*["'](maritime)["']/,
      `${file} compares against the maritime layer id`,
    );
    assert.doesNotMatch(
      source,
      /(===|!==)\s*["'](vessel)["']/,
      `${file} compares against the vessel observation kind`,
    );
  }
});

test("vessel acquisition follows layer enablement and stays server-side", async () => {
  const hook = await readFile(
    new URL("../src/hooks/use-global-layer-data.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    hook,
    /useMaritimeLayerSource\(\{\s*enabled: layerState\.isLayerEnabled\("maritime"\)/,
  );

  const feed = await readFile(
    new URL("../src/hooks/use-vessel-feed.ts", import.meta.url),
    "utf8",
  );
  assert.match(feed, /enabled,/);
  assert.match(feed, /refetchInterval: enabled \? QUERY_REFETCH_MS : false/);
  // The browser must never talk to an AIS provider directly.
  assert.doesNotMatch(feed, /digitraffic\.fi|barentswatch\.no/);
});
