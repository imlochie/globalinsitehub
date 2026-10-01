import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIRMS_CACHE_TTL_MS,
  FIRMS_FEED_URL,
  firmsAcquiredAt,
  firmsCoverage,
  parseFirmsDetections,
} from "../src/hazard-sources/firms";

const RECEIVED_AT = new Date("2026-09-30T12:00:00.000Z");

/** Shaped after the FIRMS VIIRS C2 CSV product header. */
const csv = [
  "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight",
  "-33.8688,151.2093,330.1,0.4,0.36,2026-09-30,0142,N20,VIIRS,n,2.0NRT,295.3,12.7,N",
  "37.7749,-122.4194,350.5,0.5,0.45,2026-09-30,2110,N20,VIIRS,h,2.0NRT,300.1,45.2,D",
  // Unusable coordinates.
  "999,181,300,0.4,0.36,2026-09-30,0142,N20,VIIRS,l,2.0NRT,290,1.0,N",
  // Unusable time.
  "10,10,300,0.4,0.36,,,N20,VIIRS,n,2.0NRT,290,1.0,N",
].join("\n");

test("a detection normalizes with acquisition time and FRP", () => {
  const records = parseFirmsDetections(csv, RECEIVED_AT);
  assert.equal(records.length, 2);
  const [first] = records;
  assert.equal(first.source, "nasa-firms");
  assert.equal(first.latitude, -33.8688);
  assert.equal(first.occurredAt.toISOString(), "2026-09-30T01:42:00.000Z");
  assert.equal(first.magnitudeValue, 12.7);
  assert.equal(first.magnitudeUnit, "MW (fire radiative power)");
  assert.match(first.attribution, /NASA FIRMS/);
});

test("the satellite acquisition time is never the receipt time", () => {
  const [first] = parseFirmsDetections(csv, RECEIVED_AT);
  assert.equal(first.receivedAt.getTime(), RECEIVED_AT.getTime());
  assert.notEqual(first.occurredAt.getTime(), first.receivedAt.getTime());
});

test("FIRMS confidence is carried verbatim, not turned into a score", () => {
  const records = parseFirmsDetections(csv, RECEIVED_AT);
  assert.equal(records[0]?.sourceSeverity, "n");
  assert.equal(records[1]?.sourceSeverity, "h");
  // Confidence is not a magnitude and must not leak into one.
  assert.notEqual(records[0]?.magnitudeUnit, "confidence");
});

test("a detection is never described as a confirmed fire", () => {
  const records = parseFirmsDetections(csv, RECEIVED_AT);
  assert.equal(records[0]?.hazardType, "Active fire detection");
  assert.match(String(records[0]?.description), /not a confirmed fire/);
  assert.equal(records[0]?.activityStatus, null);
});

test("unusable rows are dropped rather than repaired", () => {
  const records = parseFirmsDetections(csv, RECEIVED_AT);
  assert.equal(records.some((entry) => entry.latitude === 999), false);
  assert.equal(records.length, 2);
});

test("the HHMM acquisition clock is assembled correctly", () => {
  assert.equal(
    firmsAcquiredAt("2026-09-30", "0142")?.toISOString(),
    "2026-09-30T01:42:00.000Z",
  );
  // FIRMS drops leading zeros on the time column.
  assert.equal(
    firmsAcquiredAt("2026-09-30", "42")?.toISOString(),
    "2026-09-30T00:42:00.000Z",
  );
  assert.equal(firmsAcquiredAt(undefined, "0142"), null);
  assert.equal(firmsAcquiredAt("2026-09-30", "nope"), null);
});

test("output is bounded and identity is stable", () => {
  const many = [
    csv.split("\n")[0],
    ...Array.from({ length: 50 }, (_, i) =>
      `${10 + i / 1000},${20 + i / 1000},330,0.4,0.36,2026-09-30,0142,N20,VIIRS,n,2.0NRT,295,5,N`,
    ),
  ].join("\n");
  assert.equal(parseFirmsDetections(many, RECEIVED_AT, 10).length, 10);

  // The same row twice collapses to one detection.
  const duplicated = [csv.split("\n")[0], csv.split("\n")[1], csv.split("\n")[1]].join("\n");
  assert.equal(parseFirmsDetections(duplicated, RECEIVED_AT).length, 1);
});

test("coverage is global but explicitly overpass-sampled", () => {
  assert.equal(firmsCoverage.scope, "global");
  assert.match(firmsCoverage.note, /sampled by satellite overpass/);
  assert.match(firmsCoverage.note, /not necessarily an area without fire/);
  assert.match(firmsCoverage.note, /not a confirmed fire/);
});

test("the retired Suomi NPP product is not used", () => {
  // FIRMS ceases Suomi NPP delivery on 2026-11-01 and directs users to
  // NOAA-20/21. OSIRIS pulls Suomi NPP; this migration must not.
  assert.ok(!FIRMS_FEED_URL.includes("suomi-npp"));
  assert.match(FIRMS_FEED_URL, /noaa-20-viirs-c2/);
});

test("the bulk product uses a slower cache than the query feeds", () => {
  // The shared hazard feed cache is 60s; re-pulling a multi-megabyte global
  // artefact at that rate would transfer nothing new.
  assert.ok(FIRMS_CACHE_TTL_MS >= 10 * 60_000);
});

test("malformed input yields no detections instead of throwing", () => {
  assert.deepEqual(parseFirmsDetections("", RECEIVED_AT), []);
  assert.deepEqual(parseFirmsDetections("latitude,longitude", RECEIVED_AT), []);
});
