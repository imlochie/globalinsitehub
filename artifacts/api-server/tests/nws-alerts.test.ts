import assert from "node:assert/strict";
import { test } from "node:test";
import { alertCentre, nwsCoverage, parseNwsAlerts } from "../src/hazard-sources/nws";

const RECEIVED_AT = new Date("2026-09-30T12:00:00.000Z");

/** Shaped after the NWS alerts GeoJSON response. */
const payload = {
  type: "FeatureCollection",
  features: [
    {
      id: "urn:oid:2.49.0.1.840.0.abc",
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[[-97.5, 35.0], [-97.0, 35.0], [-97.0, 35.5], [-97.5, 35.5], [-97.5, 35.0]]],
      },
      properties: {
        "@id": "https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.abc",
        event: "Tornado Warning",
        headline: "Tornado Warning issued for Oklahoma County",
        description: "A tornado was reported near Oklahoma City.",
        areaDesc: "Oklahoma County, OK",
        severity: "Extreme",
        status: "Actual",
        onset: "2026-09-30T11:45:00+00:00",
        sent: "2026-09-30T11:44:00+00:00",
        expires: "2026-09-30T12:30:00+00:00",
      },
    },
    {
      // Zone-based alert: no geometry, so it cannot be placed.
      id: "urn:oid:2.49.0.1.840.0.zone",
      type: "Feature",
      geometry: null,
      properties: {
        event: "Flood Watch",
        areaDesc: "Multiple zones",
        severity: "Moderate",
        onset: "2026-09-30T10:00:00+00:00",
      },
    },
    {
      // Already expired at receipt time.
      id: "urn:oid:2.49.0.1.840.0.old",
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[[-80, 25], [-79, 25], [-79, 26], [-80, 26], [-80, 25]]] },
      properties: {
        event: "Coastal Flood Advisory",
        severity: "Minor",
        onset: "2026-09-30T06:00:00+00:00",
        expires: "2026-09-30T09:00:00+00:00",
      },
    },
  ],
};

test("an alert with geometry normalizes with the source's own category", () => {
  const records = parseNwsAlerts(payload, RECEIVED_AT);
  const tornado = records.find((entry) => entry.id.includes("abc"));
  assert.ok(tornado);
  // NWS assigns the category; it is never read out of the headline text.
  assert.equal(tornado.hazardType, "Tornado Warning");
  assert.equal(tornado.source, "noaa-nws");
  assert.equal(tornado.place, "Oklahoma County, OK");
  assert.equal(tornado.reviewStatus, "Actual");
  assert.equal(tornado.activityStatus, "open");
  assert.match(tornado.attribution, /National Weather Service/);
});

test("the NWS severity is carried verbatim and never scored", () => {
  const records = parseNwsAlerts(payload, RECEIVED_AT);
  const tornado = records.find((entry) => entry.id.includes("abc"));
  assert.equal(tornado?.sourceSeverity, "Extreme");
  // It is a label, not a magnitude, and must not leak into magnitude fields.
  assert.equal(tornado?.magnitudeValue, null);
  assert.equal(tornado?.magnitudeUnit, null);
});

test("observation time is the alert onset, never the receipt time", () => {
  const records = parseNwsAlerts(payload, RECEIVED_AT);
  const tornado = records.find((entry) => entry.id.includes("abc"));
  assert.ok(tornado);
  assert.equal(tornado.occurredAt.toISOString(), "2026-09-30T11:45:00.000Z");
  assert.equal(tornado.receivedAt.getTime(), RECEIVED_AT.getTime());
  assert.notEqual(tornado.occurredAt.getTime(), tornado.receivedAt.getTime());
});

test("a zone-based alert with no geometry is dropped, not pinned to a guess", () => {
  const records = parseNwsAlerts(payload, RECEIVED_AT);
  assert.equal(records.some((entry) => entry.id.includes("zone")), false);
});

test("an expired alert is reported closed rather than open", () => {
  const records = parseNwsAlerts(payload, RECEIVED_AT);
  const old = records.find((entry) => entry.id.includes("old"));
  assert.ok(old);
  assert.equal(old.activityStatus, "closed");
});

test("the polygon centre is derived and disclosed", () => {
  const centre = alertCentre(payload.features[0].geometry);
  assert.ok(centre);
  assert.ok(centre.longitude > -97.5 && centre.longitude < -97.0);
  const records = parseNwsAlerts(payload, RECEIVED_AT);
  assert.match(
    String(records[0]?.description),
    /centre of the warned area polygon, not a precise point/,
  );
});

test("coverage is the United States and never described as global", () => {
  assert.equal(nwsCoverage.scope, "regional");
  assert.match(nwsCoverage.note, /United States/);
  assert.match(nwsCoverage.note, /not that conditions are calm/);
  assert.doesNotMatch(nwsCoverage.note, /\bglobal\b/i);
});

test("malformed payloads yield no records instead of throwing", () => {
  assert.deepEqual(parseNwsAlerts(null, RECEIVED_AT), []);
  assert.deepEqual(parseNwsAlerts({ features: {} }, RECEIVED_AT), []);
  assert.deepEqual(
    parseNwsAlerts({ features: [{ id: "x", geometry: null, properties: {} }] }, RECEIVED_AT),
    [],
  );
});
