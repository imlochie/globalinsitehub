import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import type {
  HazardRecord,
  HazardSourceStatus,
} from "@workspace/api-client-react";
import { GlobalLayerControl } from "../src/components/global-layer-control";
import { GlobalObservationInspector } from "../src/components/global-observation-inspector";
import { naturalHazardLayerPanel } from "../src/components/layer-panels/natural-hazard-layer-panel";
import { isHazardSourcedEvent } from "../src/hooks/layer-sources/public-event-layer-source";
import {
  createNaturalHazardLayerProviderAdapter,
  isNaturalHazardObservation,
  normalizeHazardRecord,
  observationKey,
  selectRenderableObservations,
  type NaturalHazardObservation,
} from "../src/lib/global-layers";
import {
  layerCoverage,
  layerRegistry,
  naturalHazardLayerDefinition,
} from "../src/lib/layer-registry";

const OBSERVED_AT = "2026-09-29T23:53:20.000Z";
const RECEIVED_AT = "2026-09-30T04:00:00.000Z";

const hazard = (
  id: string,
  source = "usgs",
  overrides: Partial<HazardRecord> = {},
): HazardRecord =>
  ({
    id: `${source}:${id}`,
    source,
    hazardType: "earthquake",
    title: `M 5.1 - test event ${id}`,
    latitude: -5.1,
    longitude: 152.4,
    occurredAt: OBSERVED_AT,
    updatedAt: null,
    receivedAt: RECEIVED_AT,
    activityStatus: null,
    magnitudeValue: 5.1,
    magnitudeUnit: "mww",
    magnitudeDescription: null,
    depthKm: 63.2,
    reviewStatus: "reviewed",
    place: "112 km SSE of Kokopo",
    description: null,
    sourceUrl: "https://earthquake.usgs.gov/earthquakes/eventpage/test",
    attribution: "Credit: U.S. Geological Survey",
    licence: "U.S. public domain (USGS)",
    ...overrides,
  }) as unknown as HazardRecord;

const sourceStatus = (
  id: string,
  status: "available" | "unavailable" = "available",
): HazardSourceStatus =>
  ({
    id,
    name: `${id} source`,
    attribution: `${id} attribution`,
    licence: "test licence",
    licenceUrl: "https://example.test/licence",
    catalogueUrl: "https://example.test/docs",
    status,
    coverage: { scope: "global", regions: ["Worldwide"], note: `${id} note` },
    hazardCount: 1,
    checkedAt: RECEIVED_AT,
    message: `${id} message`,
  }) as unknown as HazardSourceStatus;

/* -------------------------------------------------------------------------- */
/* Registry                                                                   */
/* -------------------------------------------------------------------------- */

test("natural hazards is a real operational layer in the registry", () => {
  const definition = layerRegistry.require("natural-hazards");
  assert.equal(definition, naturalHazardLayerDefinition);
  assert.equal(definition.status, "operational");
  assert.equal(definition.category, "environment");
  assert.equal(definition.observationKind, "natural-hazard");
  assert.ok(definition.capabilities.map);
  assert.ok(definition.capabilities.globe);
  assert.ok(definition.capabilities.inspector);
  assert.ok(
    layerRegistry
      .operational()
      .some((entry) => entry.id === "natural-hazards"),
  );
  assert.ok(
    !layerRegistry.planned().some((entry) => entry.id === "natural-hazards"),
  );
});

test("every hazard source carries attribution, licence and coverage", () => {
  for (const provider of naturalHazardLayerDefinition.providers) {
    assert.ok(provider.attribution.length > 0, `${provider.id} attribution`);
    assert.ok((provider.licence ?? "").length > 0, `${provider.id} licence`);
    assert.ok(provider.catalogueUrl.startsWith("https://"));
    assert.ok((provider.coverage?.note ?? "").length > 0);
  }
});

test("coverage states worldwide reach and its completeness limits", () => {
  const coverage = layerCoverage(naturalHazardLayerDefinition);
  assert.equal(coverage.scope, "global");
  // Global reach must not be sold as a complete hazard census.
  assert.match(coverage.note, /magnitude 2\.5/i);
  assert.match(coverage.note, /not that nothing is happening/i);
});

/* -------------------------------------------------------------------------- */
/* Normalization                                                              */
/* -------------------------------------------------------------------------- */

test("a hazard record normalizes with stable identity and provenance", () => {
  const observation = normalizeHazardRecord(hazard("us7000abcd"), [
    sourceStatus("usgs"),
  ]);
  assert.ok(observation);
  assert.equal(observation.layerId, "natural-hazards");
  assert.equal(observation.kind, "natural-hazard");
  assert.equal(observation.id, "usgs:us7000abcd");
  assert.equal(
    observation.key,
    observationKey("natural-hazards", "usgs:us7000abcd"),
  );
  assert.equal(observation.providerId, "usgs");
  assert.equal(observation.providerName, "usgs source");
  assert.equal(observation.attribution, "Credit: U.S. Geological Survey");
  assert.equal(observation.catalogueUrl, "https://example.test/docs");
  assert.equal(observation.magnitudeUnit, "mww");
  assert.equal(observation.depthKm, 63.2);
  assert.ok(isNaturalHazardObservation(observation));
});

test("the source observation time is never the Signalwatch receipt time", () => {
  const observation = normalizeHazardRecord(hazard("a"), [sourceStatus("usgs")]);
  assert.ok(observation);
  assert.equal(observation.observedAt, OBSERVED_AT);
  assert.equal(observation.receivedAt, RECEIVED_AT);
  assert.notEqual(observation.observedAt, observation.receivedAt);
});

test("records without usable coordinates or times are dropped", () => {
  const sources = [sourceStatus("usgs")];
  assert.equal(
    normalizeHazardRecord(hazard("a", "usgs", { latitude: 91 }), sources),
    null,
  );
  assert.equal(
    normalizeHazardRecord(hazard("b", "usgs", { longitude: 1000 }), sources),
    null,
  );
  assert.equal(
    normalizeHazardRecord(
      hazard("c", "usgs", { occurredAt: "not-a-date" as never }),
      sources,
    ),
    null,
  );
});

test("an unknown source still normalizes, falling back to its own id", () => {
  const observation = normalizeHazardRecord(hazard("a", "usgs"), []);
  assert.ok(observation);
  assert.equal(observation.providerName, "usgs");
  assert.equal(observation.providerStatus, null);
  assert.equal(observation.catalogueUrl, null);
});

test("the provider adapter keys observations by their source", () => {
  const adapter = createNaturalHazardLayerProviderAdapter([
    sourceStatus("usgs"),
    sourceStatus("nasa-eonet"),
  ]);
  assert.equal(adapter.layerId, "natural-hazards");
  assert.equal(adapter.providerId(hazard("a", "nasa-eonet")), "nasa-eonet");
});

test("records from different sources are kept apart, never fuzzily merged", () => {
  const sources = [sourceStatus("usgs"), sourceStatus("nasa-eonet")];
  const observations = [
    hazard("1", "usgs", { title: "M 6.0 - Near Reykjavik" }),
    hazard("1", "nasa-eonet", {
      title: "M 6.0 - Near Reykjavik",
      hazardType: "Volcanoes",
    }),
  ]
    .map((record) => normalizeHazardRecord(record, sources))
    .filter((observation): observation is NaturalHazardObservation =>
      observation !== null,
    );

  // Identical titles, different providers: both survive with distinct keys and
  // distinct provenance rather than being collapsed into one marker.
  assert.equal(observations.length, 2);
  assert.notEqual(observations[0].key, observations[1].key);
  assert.deepEqual(
    observations.map((observation) => observation.providerId),
    ["usgs", "nasa-eonet"],
  );
});

/* -------------------------------------------------------------------------- */
/* Generic engine                                                             */
/* -------------------------------------------------------------------------- */

test("hazards flow through the generic rendering path unchanged", () => {
  const sources = [sourceStatus("usgs")];
  const observations = Array.from({ length: 12 }, (_, index) =>
    normalizeHazardRecord(hazard(`event-${index}`), sources),
  ).filter((observation): observation is NaturalHazardObservation =>
    observation !== null,
  );

  const result = selectRenderableObservations(
    observations,
    null,
    layerRegistry,
  );
  assert.equal(result.observations.length, 12);
  const sample = result.samples.find(
    (entry) => entry.layerId === "natural-hazards",
  );
  assert.ok(sample);
  assert.equal(sample.total, 12);
  assert.equal(sample.shown, 12);
  assert.equal(sample.omitted, 0);
});

test("selection survives sampling for a hazard observation", () => {
  const sources = [sourceStatus("usgs")];
  const observations = Array.from({ length: 5 }, (_, index) =>
    normalizeHazardRecord(hazard(`event-${index}`), sources),
  ).filter((observation): observation is NaturalHazardObservation =>
    observation !== null,
  );
  const selected = observations[4];

  const result = selectRenderableObservations(
    observations,
    { layerId: selected.layerId, id: selected.id },
    layerRegistry,
  );
  assert.ok(
    result.observations.some(
      (observation) => observation.key === selected.key,
    ),
  );
});

/* -------------------------------------------------------------------------- */
/* Presentation                                                               */
/* -------------------------------------------------------------------------- */

test("the layer panel reports actual source status, not a blanket claim", () => {
  const degraded = naturalHazardLayerPanel({
    enabled: true,
    onEnabledChange: () => {},
    source: "all",
    onSourceChange: () => {},
    search: "",
    onSearchChange: () => {},
    sources: [sourceStatus("usgs"), sourceStatus("nasa-eonet", "unavailable")],
    matchedCount: 40,
    returnedCount: 40,
    isLoading: false,
    isFetching: false,
    hasError: false,
    isUnavailable: false,
    isTruncated: false,
  });
  assert.equal(degraded.status.tone, "warn");
  assert.match(degraded.status.label, /some hazard sources unavailable/i);

  const down = naturalHazardLayerPanel({
    enabled: true,
    onEnabledChange: () => {},
    source: "all",
    onSourceChange: () => {},
    search: "",
    onSearchChange: () => {},
    sources: [sourceStatus("usgs", "unavailable")],
    matchedCount: 0,
    returnedCount: 0,
    isLoading: false,
    isFetching: false,
    hasError: false,
    isUnavailable: true,
    isTruncated: false,
  });
  // A dead source reads as "unavailable", never as "no hazards".
  assert.equal(down.status.tone, "bad");
  assert.match(down.status.label, /unavailable/i);
  assert.doesNotMatch(down.status.label, /no hazards/i);
});

test("the control renders the layer with its real coverage and source rows", () => {
  const panel = naturalHazardLayerPanel({
    enabled: true,
    onEnabledChange: () => {},
    source: "all",
    onSourceChange: () => {},
    search: "",
    onSearchChange: () => {},
    sources: [sourceStatus("usgs"), sourceStatus("nasa-eonet", "unavailable")],
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
  assert.match(markup, /Natural hazards/);
  assert.match(markup, /row-natural-hazards-source-usgs/);
  assert.match(markup, /row-natural-hazards-source-nasa-eonet/);
  assert.match(markup, /magnitude 2\.5/i);
});

test("the inspector shows only fields the source actually supplied", () => {
  const observation = normalizeHazardRecord(
    hazard("us7000abcd", "usgs", { magnitudeDescription: null }),
    [sourceStatus("usgs")],
  );
  assert.ok(observation);

  const markup = renderToStaticMarkup(
    <Router ssrPath="/">
      <GlobalObservationInspector
        observation={observation}
        onClear={() => {}}
      />
    </Router>,
  );
  assert.match(markup, /Magnitude \(mww\)/);
  assert.match(markup, /63.2 km/);
  assert.match(markup, /Credit: U.S. Geological Survey/);
  // Absent fields are omitted rather than rendered as Unknown / N/A / 0.
  assert.doesNotMatch(markup, /Magnitude description/);
  assert.doesNotMatch(markup, /Unknown/);
  assert.doesNotMatch(markup, /N\/A/);
});

test("EONET observations carry NASA's approximation disclaimer", () => {
  const observation = normalizeHazardRecord(
    hazard("EONET_6789", "nasa-eonet", {
      hazardType: "Wildfires",
      magnitudeValue: 2400,
      magnitudeUnit: "acres",
      depthKm: null,
      reviewStatus: null,
      activityStatus: "open",
      attribution:
        "Source: NASA Earth Observatory Natural Event Tracker (EONET)",
    }),
    [sourceStatus("nasa-eonet")],
  );
  assert.ok(observation);

  const markup = renderToStaticMarkup(
    <Router ssrPath="/">
      <GlobalObservationInspector
        observation={observation}
        onClear={() => {}}
      />
    </Router>,
  );
  assert.match(markup, /approximations at best/i);
  assert.match(markup, /Magnitude \(acres\)/);
});

/* -------------------------------------------------------------------------- */
/* Layer boundaries and shared-surface purity                                 */
/* -------------------------------------------------------------------------- */

test("hazard-source records are excluded from public events by id, not wording", () => {
  assert.equal(isHazardSourcedEvent({ id: "usgs-us7000abcd" }), true);
  assert.equal(isHazardSourcedEvent({ id: "eonet-EONET_6789" }), true);
  // A news story about an earthquake remains a public event.
  assert.equal(
    isHazardSourcedEvent({ id: "abc-news-quake-hits-region" }),
    false,
  );
});

const sharedSourceFiles = [
  "../src/components/global-layer-control.tsx",
  "../src/components/global-observation-inspector.tsx",
  "../src/components/satellite-sector-globe.tsx",
  "../src/components/interactive-sector-globe.tsx",
  "../src/hooks/use-global-layer-data.ts",
  "../src/lib/observation-style.ts",
];

test("shared surfaces never branch on the natural-hazards layer", async () => {
  for (const file of sharedSourceFiles) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /(===|!==)\s*["'](natural-hazards)["']/,
      `${file} compares against the natural-hazards layer id`,
    );
    assert.doesNotMatch(
      source,
      /(===|!==)\s*["'](natural-hazard)["']/,
      `${file} compares against the natural-hazard observation kind`,
    );
  }
});

test("hazard acquisition follows layer enablement and stays server-side", async () => {
  const hook = await readFile(
    new URL("../src/hooks/use-global-layer-data.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    hook,
    /useNaturalHazardLayerSource\(\{\s*enabled: layerState\.isLayerEnabled\("natural-hazards"\)/,
  );

  const feed = await readFile(
    new URL("../src/hooks/use-hazard-feed.ts", import.meta.url),
    "utf8",
  );
  // The browser only ever talks to the Signalwatch API.
  assert.doesNotMatch(feed, /earthquake\.usgs\.gov/);
  assert.doesNotMatch(feed, /eonet\.gsfc\.nasa\.gov/);
  assert.match(feed, /useGetMonitoringHazards/);
});
