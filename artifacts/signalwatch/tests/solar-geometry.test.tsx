/**
 * Solar geometry.
 *
 * These are not round-trip tests. Almost every expectation below is an
 * independently known astronomical fact — the obliquity of the ecliptic, the
 * dates and magnitudes of the equation-of-time extremes, which pole is lit
 * at a solstice — so the algorithm is checked against the sky rather than
 * against itself.
 *
 * Reference values were produced by this implementation and then verified
 * against published astronomy before being pinned:
 *
 *   obliquity           23.44 deg       -> declination extremes +/-23.438
 *   EoT minimum         ~ -14.2 min, around 11 February
 *   EoT maximum         ~ +16.4 min, around 3 November
 *   equinox declination 0
 *
 * If a future change breaks one of these, the change is wrong, not the test.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  GLOBE_RADIUS,
  SOLAR_LIVE_REFRESH_MS,
  calculateSolarPosition,
  geoToGlobeVector,
  isDaylight,
  julianCentury,
  julianDay,
  normaliseLongitude,
  resolveSolarInstant,
  solarAltitudeFactor,
  solarLightPosition,
} from "../src/lib/solar-geometry";

const at = (iso: string) => calculateSolarPosition(new Date(iso));
/** Obliquity of the ecliptic, degrees. The axial tilt of the Earth. */
const OBLIQUITY = 23.44;

/* -------------------------------------------------------------------------- */
/* Julian day                                                                 */
/* -------------------------------------------------------------------------- */

test("the Julian day of J2000.0 is 2451545.0", () => {
  // J2000.0 is 2000-01-01T12:00:00 TT, conventionally taken as 12:00 UTC
  // here. This is the epoch every series in the module is referenced to, so
  // an error here would shift everything.
  assert.ok(Math.abs(julianDay(new Date("2000-01-01T12:00:00Z")) - 2_451_545.0) < 1e-6);
  assert.ok(Math.abs(julianCentury(new Date("2000-01-01T12:00:00Z"))) < 1e-9);
});

test("the Julian day of the Unix epoch is 2440587.5", () => {
  assert.ok(Math.abs(julianDay(new Date(0)) - 2_440_587.5) < 1e-9);
});

/* -------------------------------------------------------------------------- */
/* Declination: equinoxes and solstices                                       */
/* -------------------------------------------------------------------------- */

test("declination is zero at an equinox", () => {
  // The equinox is *defined* as the moment the Sun crosses the celestial
  // equator, so declination must be ~0 at these instants.
  assert.ok(Math.abs(at("2026-03-20T14:46:00Z").declination) < 0.01);
  assert.ok(Math.abs(at("2026-09-23T00:06:00Z").declination) < 0.01);
});

test("declination reaches the obliquity at the solstices", () => {
  const june = at("2026-06-21T08:25:00Z").declination;
  const december = at("2026-12-21T20:50:00Z").declination;

  assert.ok(june > 23.4 && june < 23.45, `June declination ${june}`);
  assert.ok(december < -23.4 && december > -23.45, `Dec declination ${december}`);
  // The two solstices are symmetric about the equator.
  assert.ok(Math.abs(june + december) < 0.01);
});

test("declination never exceeds the obliquity over a full year", () => {
  let min = 90;
  let max = -90;
  for (let day = 0; day < 365; day += 1) {
    const value = calculateSolarPosition(
      new Date(Date.UTC(2026, 0, 1 + day, 12)),
    ).declination;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  assert.ok(max <= OBLIQUITY && max > OBLIQUITY - 0.1, `max ${max}`);
  assert.ok(min >= -OBLIQUITY && min < -OBLIQUITY + 0.1, `min ${min}`);
});

test("the subsolar latitude is the declination", () => {
  // Not a tautology worth skipping: it is the definition that makes the
  // marker and the lighting consistent, and a refactor could break it.
  for (const iso of [
    "2026-01-15T03:00:00Z",
    "2026-06-21T08:25:00Z",
    "2026-11-02T19:30:00Z",
  ]) {
    const position = at(iso);
    assert.equal(position.subsolarLatitude, position.declination);
  }
});

/* -------------------------------------------------------------------------- */
/* Equation of time                                                           */
/* -------------------------------------------------------------------------- */

test("the equation of time matches its published annual extremes", () => {
  let min = { value: 99, date: "" };
  let max = { value: -99, date: "" };
  for (let day = 0; day < 365; day += 1) {
    const when = new Date(Date.UTC(2026, 0, 1 + day, 12));
    const value = calculateSolarPosition(when).equationOfTimeMinutes;
    if (value < min.value) min = { value, date: when.toISOString().slice(0, 10) };
    if (value > max.value) max = { value, date: when.toISOString().slice(0, 10) };
  }
  // Published: about -14.2 minutes in mid-February, +16.4 in early November.
  assert.ok(min.value < -14 && min.value > -14.5, `EoT min ${min.value}`);
  assert.ok(max.value > 16.2 && max.value < 16.7, `EoT max ${max.value}`);
  assert.match(min.date, /^2026-02-1[01234]$/, `EoT min on ${min.date}`);
  assert.match(max.date, /^2026-11-0[2345]$/, `EoT max on ${max.date}`);
});

/* -------------------------------------------------------------------------- */
/* Longitude progression                                                      */
/* -------------------------------------------------------------------------- */

test("the subsolar point moves 15 degrees west per hour", () => {
  const base = new Date("2026-03-20T00:00:00Z").getTime();
  for (let hour = 1; hour <= 12; hour += 1) {
    const before = calculateSolarPosition(new Date(base + (hour - 1) * 3_600_000));
    const after = calculateSolarPosition(new Date(base + hour * 3_600_000));
    const delta = normaliseLongitude(
      after.subsolarLongitude - before.subsolarLongitude,
    );
    // 15 degrees westward, give or take the equation of time's drift.
    assert.ok(
      Math.abs(delta + 15) < 0.05,
      `hour ${hour}: moved ${delta} degrees`,
    );
  }
});

test("the subsolar point is near Greenwich at 12:00 UTC and the dateline at 00:00", () => {
  const noon = at("2026-03-20T12:00:00Z");
  const midnight = at("2026-03-20T00:00:00Z");

  // Offset from Greenwich at noon is exactly the equation of time, converted
  // at 15 degrees per hour. This is why the Sun is not over Greenwich at
  // 12:00 — it looks like a bug and is not.
  const expected = -noon.equationOfTimeMinutes / 4;
  assert.ok(Math.abs(noon.subsolarLongitude - expected) < 1e-6);
  assert.ok(Math.abs(noon.subsolarLongitude) < 5);

  assert.ok(Math.abs(Math.abs(midnight.subsolarLongitude) - 180) < 5);
});

test("longitude is normalised to (-180, 180]", () => {
  for (let hour = 0; hour < 48; hour += 1) {
    const { subsolarLongitude, hourAngle } = calculateSolarPosition(
      new Date(Date.UTC(2026, 5, 1, hour)),
    );
    assert.ok(subsolarLongitude > -180 && subsolarLongitude <= 180);
    assert.ok(hourAngle > -180 && hourAngle <= 180);
  }
});

test("the hour angle is the negated subsolar longitude", () => {
  for (const iso of ["2026-02-01T05:00:00Z", "2026-08-14T22:17:00Z"]) {
    const position = at(iso);
    assert.ok(
      Math.abs(
        normaliseLongitude(position.hourAngle + position.subsolarLongitude),
      ) < 1e-9,
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Hemisphere behaviour                                                       */
/* -------------------------------------------------------------------------- */

test("at the June solstice the Arctic is lit and the Antarctic is not", () => {
  const june = at("2026-06-21T08:25:00Z");
  assert.ok(isDaylight(june, 90, 0), "North Pole must be in daylight");
  assert.ok(isDaylight(june, 90, 180), "midnight sun is longitude-independent");
  assert.ok(!isDaylight(june, -90, 0), "South Pole must be in darkness");
});

test("at the December solstice the poles swap", () => {
  const december = at("2026-12-21T20:50:00Z");
  assert.ok(!isDaylight(december, 90, 0));
  assert.ok(isDaylight(december, -90, 0));
});

test("Australian daylight at a known instant is right", () => {
  // 2026-06-21T08:25Z is 16:25 in Perth (UTC+8) and 18:25 in Sydney
  // (UTC+10). Midwinter sunset is around 17:20 in Perth and 16:55 in
  // Sydney, so Perth is still lit and Sydney is not.
  const june = at("2026-06-21T08:25:00Z");
  assert.ok(isDaylight(june, -31.95, 115.86), "Perth should be in daylight");
  assert.ok(!isDaylight(june, -33.87, 151.21), "Sydney should be dark");
});

test("the terminator separates day from night and sits where the cosine is zero", () => {
  const position = at("2026-06-21T08:25:00Z");
  // Walk a meridian; the sign must change exactly where isDaylight flips.
  let flips = 0;
  for (let lat = -89; lat <= 89; lat += 1) {
    const here = solarAltitudeFactor(position, lat, 0);
    const next = solarAltitudeFactor(position, lat + 1, 0);
    if (Math.sign(here) !== Math.sign(next)) {
      flips += 1;
      assert.equal(isDaylight(position, lat, 0), here > 0);
    }
  }
  assert.equal(flips, 1, "a meridian crosses the terminator exactly once here");
});

/* -------------------------------------------------------------------------- */
/* Subsolar point consistency — the light and the marker must agree           */
/* -------------------------------------------------------------------------- */

test("the subsolar point is the maximum of the illumination field", () => {
  // Brute force the whole globe on a one-degree grid and confirm the
  // analytic subsolar point is where the Sun is highest. This is the test
  // that makes "the marker and the lighting agree" a fact rather than a
  // hope: if one says Australia and the other says the Atlantic, it fails.
  const position = at("2026-06-21T08:25:00Z");
  let best = { lat: 0, lng: 0, value: -2 };
  for (let lat = -90; lat <= 90; lat += 1) {
    for (let lng = -180; lng < 180; lng += 1) {
      const value = solarAltitudeFactor(position, lat, lng);
      if (value > best.value) best = { lat, lng, value };
    }
  }
  assert.ok(Math.abs(best.lat - position.subsolarLatitude) <= 1);
  assert.ok(
    Math.abs(normaliseLongitude(best.lng - position.subsolarLongitude)) <= 1,
  );
  // And the Sun is directly overhead there.
  assert.ok(
    solarAltitudeFactor(
      position,
      position.subsolarLatitude,
      position.subsolarLongitude,
    ) > 0.9999,
  );
});

test("the antipode of the subsolar point is the darkest place on Earth", () => {
  const position = at("2026-03-20T14:46:00Z");
  const value = solarAltitudeFactor(
    position,
    -position.subsolarLatitude,
    normaliseLongitude(position.subsolarLongitude + 180),
  );
  assert.ok(value < -0.9999, `antipode cosine ${value}`);
});

/* -------------------------------------------------------------------------- */
/* Globe geometry — the coordinate-inversion guard                            */
/* -------------------------------------------------------------------------- */

test("geoToGlobeVector reproduces three-globe's polar2Cartesian exactly", () => {
  // Independent oracle, transcribed from three-globe's own source. The brief
  // calls a mismatch between the globe's coordinate system and the data's a
  // hard failure: the Sun would light one place while the markers sat on
  // another. A library upgrade that changed the convention fails here.
  const oracle = (lat: number, lng: number, alt = 0) => {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((90 - lng) * Math.PI) / 180;
    const r = 100 * (1 + alt);
    return {
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.cos(phi),
      z: r * Math.sin(phi) * Math.sin(theta),
    };
  };

  assert.equal(GLOBE_RADIUS, 100);
  for (const [lat, lng, alt] of [
    [0, 0, 0],
    [90, 0, 0],
    [-90, 0, 0],
    [-33.87, 151.21, 0],
    [51.5, -0.1, 0],
    [-26, 136, 20],
  ] as const) {
    const mine = geoToGlobeVector(lat, lng, alt);
    const theirs = oracle(lat, lng, alt);
    assert.ok(Math.abs(mine.x - theirs.x) < 1e-9, `x at ${lat},${lng}`);
    assert.ok(Math.abs(mine.y - theirs.y) < 1e-9, `y at ${lat},${lng}`);
    assert.ok(Math.abs(mine.z - theirs.z) < 1e-9, `z at ${lat},${lng}`);
  }
});

test("the poles and the equator land where they should in world space", () => {
  // Sign conventions, stated explicitly so an inversion is obvious.
  const north = geoToGlobeVector(90, 0);
  assert.ok(north.y > 99.9, "north pole is +y");
  const south = geoToGlobeVector(-90, 0);
  assert.ok(south.y < -99.9, "south pole is -y");
  const equator = geoToGlobeVector(0, 0);
  assert.ok(Math.abs(equator.y) < 1e-9, "the equator is in the xz plane");
  assert.ok(
    Math.abs(Math.hypot(equator.x, equator.y, equator.z) - 100) < 1e-9,
  );
});

test("the solar light sits above the subsolar point, far enough to be parallel", () => {
  const position = at("2026-06-21T08:25:00Z");
  const light = solarLightPosition(position);
  const surface = geoToGlobeVector(
    position.subsolarLatitude,
    position.subsolarLongitude,
  );

  // Same direction from the centre: the light is directly over the subsolar
  // point, which is what makes the rendered terminator agree with the
  // analytic one.
  const lightLength = Math.hypot(light.x, light.y, light.z);
  const dot =
    (light.x * surface.x + light.y * surface.y + light.z * surface.z) /
    (lightLength * 100);
  assert.ok(dot > 0.999999, `light is off-axis: cos = ${dot}`);
  assert.ok(lightLength > 100 * 10, "light must be far enough for parallel rays");
});

test("the light tracks the Sun rather than staying put", () => {
  const morning = solarLightPosition(at("2026-06-21T00:00:00Z"));
  const evening = solarLightPosition(at("2026-06-21T12:00:00Z"));
  const moved = Math.hypot(
    morning.x - evening.x,
    morning.y - evening.y,
    morning.z - evening.z,
  );
  assert.ok(moved > 100, "twelve hours must move the light across the globe");
});

/* -------------------------------------------------------------------------- */
/* Determinism and timezone independence                                      */
/* -------------------------------------------------------------------------- */

test("the result depends only on the instant, never on the host timezone", () => {
  // Same instant, three spellings. A getHours() instead of getUTCHours()
  // anywhere in the module would break this.
  const a = at("2026-07-04T16:20:00Z");
  const b = calculateSolarPosition(new Date(Date.UTC(2026, 6, 4, 16, 20)));
  const c = calculateSolarPosition(new Date("2026-07-05T02:20:00+10:00"));
  assert.equal(a.subsolarLongitude, b.subsolarLongitude);
  assert.equal(a.subsolarLongitude, c.subsolarLongitude);
  assert.equal(a.declination, c.declination);
});

test("an invalid date is refused rather than silently producing NaN", () => {
  assert.throws(() => calculateSolarPosition(new Date("nonsense")), /valid Date/);
});

/* -------------------------------------------------------------------------- */
/* Temporal state                                                             */
/* -------------------------------------------------------------------------- */

test("live time resolves to now; paused and simulated hold their instant", () => {
  const now = new Date("2026-05-05T05:05:05Z");
  const fixed = new Date("1999-12-31T23:59:59Z");
  assert.equal(resolveSolarInstant({ mode: "live" }, now).getTime(), now.getTime());
  assert.equal(
    resolveSolarInstant({ mode: "paused", instant: fixed }, now).getTime(),
    fixed.getTime(),
  );
  assert.equal(
    resolveSolarInstant({ mode: "simulated", instant: fixed }, now).getTime(),
    fixed.getTime(),
  );
});

test("the live refresh cadence is slower than a frame and finer than a degree", () => {
  // The brief forbids driving React renders from the clock. One update a
  // minute is a quarter of a degree of rotation — invisible — while being
  // three orders of magnitude slower than a 60 Hz frame.
  assert.equal(SOLAR_LIVE_REFRESH_MS, 60_000);
  const degreesPerRefresh = (SOLAR_LIVE_REFRESH_MS / 3_600_000) * 15;
  assert.ok(degreesPerRefresh < 0.5, `${degreesPerRefresh} deg per refresh`);
  assert.ok(SOLAR_LIVE_REFRESH_MS > 1000 / 30);
});

test("solar time is not a weather frame time", () => {
  // Different temporal domains: one is calculated, one is observed. If a
  // SolarPosition ever grows provider fields the domains have merged.
  const position = at("2026-06-21T08:25:00Z");
  for (const forbidden of ["productId", "providerId", "validTime", "runTime", "freshness"]) {
    assert.ok(!(forbidden in position), `SolarPosition must not carry ${forbidden}`);
  }
});
