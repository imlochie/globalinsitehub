/**
 * Solar geometry — where the Sun is over the Earth at a given instant.
 *
 * This is planetary mathematics, not meteorology. It takes no provider, no
 * network and no API key, and it must never live inside a weather module:
 * sunlight is available everywhere, including everywhere Signalwatch has no
 * weather source at all.
 *
 *
 * ALGORITHM
 * ---------
 * The NOAA Solar Calculator formulation, which follows Jean Meeus,
 * "Astronomical Algorithms" (2nd edition, Willmann-Bell, 1998), chapters 7
 * (Julian day), 22 (nutation and obliquity) and 25 (solar coordinates).
 * NOAA publishes it at
 * https://gml.noaa.gov/grad/solcalc/calcdetails.html
 *
 * It is the low-precision solar position: the Sun's apparent longitude from
 * a mean-orbit series with the equation of centre applied, the obliquity of
 * the ecliptic with the principal nutation term, and the equation of time
 * from Meeus chapter 28.
 *
 *
 * ACCURACY — and what is NOT claimed
 * ----------------------------------
 * NOAA states this calculation is accurate to roughly 0.01 degrees of solar
 * position for the years 1801 to 2099, degrading outside that range. One
 * hundredth of a degree is about 1.1 km on the Earth's surface, which at any
 * globe zoom is a small fraction of a pixel.
 *
 * This is therefore MORE than sufficient for its purpose: lighting a globe
 * and placing a subsolar marker. It is NOT a scientific ephemeris. It does
 * not model planetary perturbations beyond the equation of centre, it does
 * not apply atmospheric refraction, it treats the Earth as a sphere, and it
 * ignores the difference between UT1 and UTC (up to 0.9 s, about 0.004
 * degrees of rotation). Do not use it for eclipse prediction, precise
 * sunrise/sunset times at high latitude, or anything requiring arcsecond
 * accuracy.
 *
 *
 * CONVENTIONS
 * -----------
 * Input is an absolute instant. Everything is derived with getUTC* or the
 * epoch value, so the host machine's timezone cannot influence the result —
 * the single most likely way for this module to be subtly wrong.
 *
 * Latitude  : degrees, positive north, -90 to +90.
 * Longitude : degrees, positive east, normalised to (-180, +180].
 * Hour angle: degrees, positive west of the Greenwich meridian. This is the
 *             Greenwich hour angle, and equals -subsolarLongitude.
 */

/** Degrees in one hour of Earth rotation. */
const DEGREES_PER_HOUR = 15;
const MS_PER_DAY = 86_400_000;
/** Julian Day Number of the Unix epoch, 1970-01-01T00:00:00Z. */
const JD_UNIX_EPOCH = 2_440_587.5;
/** Julian Day of J2000.0, the epoch the series below are referenced to. */
const JD_J2000 = 2_451_545.0;
const DAYS_PER_JULIAN_CENTURY = 36_525;

const rad = (degrees: number): number => (degrees * Math.PI) / 180;
const deg = (radians: number): number => (radians * 180) / Math.PI;

/** Normalises degrees to [0, 360). */
export function normaliseDegrees(value: number): number {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Normalises a longitude to (-180, +180]. */
export function normaliseLongitude(value: number): number {
  const wrapped = normaliseDegrees(value);
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

export type SolarPosition = {
  /** The instant this was computed for. */
  timestampUtc: Date;
  /** Latitude of the subsolar point, degrees north. Equals the declination. */
  subsolarLatitude: number;
  /** Longitude of the subsolar point, degrees east, in (-180, +180]. */
  subsolarLongitude: number;
  /** Solar declination, degrees. Varies within about ±23.44 over a year. */
  declination: number;
  /** Greenwich hour angle, degrees west of Greenwich. = -subsolarLongitude. */
  hourAngle: number;
  /**
   * Equation of time, minutes. Apparent solar time minus mean solar time;
   * roughly -14 to +16 over a year. Exposed because it is the reason the
   * subsolar point is not exactly on the Greenwich meridian at 12:00 UTC,
   * which otherwise looks like a bug.
   */
  equationOfTimeMinutes: number;
};

/** Julian Day for an instant. Valid for any Date; no calendar branching. */
export function julianDay(timestampUtc: Date): number {
  return timestampUtc.getTime() / MS_PER_DAY + JD_UNIX_EPOCH;
}

/** Julian centuries since J2000.0. */
export function julianCentury(timestampUtc: Date): number {
  return (julianDay(timestampUtc) - JD_J2000) / DAYS_PER_JULIAN_CENTURY;
}

/**
 * Solar position for an instant.
 *
 * Pure: the same Date always yields the same answer, on any machine, in any
 * timezone. There is no `Date.now()` here on purpose — the caller owns the
 * temporal state, which is what lets a time scrubber be added later without
 * touching this module.
 */
export function calculateSolarPosition(timestampUtc: Date): SolarPosition {
  const time = timestampUtc.getTime();
  if (!Number.isFinite(time)) {
    throw new Error("calculateSolarPosition requires a valid Date.");
  }

  const t = julianCentury(timestampUtc);

  // Geometric mean longitude and mean anomaly of the Sun (Meeus 25.2, 25.3).
  const meanLongitude = normaliseDegrees(
    280.46646 + t * (36_000.76983 + t * 0.0003032),
  );
  const meanAnomaly = 357.52911 + t * (35_999.05029 - 0.0001537 * t);

  // Eccentricity of the Earth's orbit (Meeus 25.4).
  const eccentricity =
    0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  // Equation of centre: the correction from a circular to an elliptical
  // orbit. This is what makes the seasons unequal in length.
  const equationOfCentre =
    Math.sin(rad(meanAnomaly)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(rad(2 * meanAnomaly)) * (0.019993 - 0.000101 * t) +
    Math.sin(rad(3 * meanAnomaly)) * 0.000289;

  const trueLongitude = meanLongitude + equationOfCentre;

  // Apparent longitude: true longitude corrected for nutation and aberration.
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude =
    trueLongitude - 0.00569 - 0.00478 * Math.sin(rad(omega));

  // Mean obliquity of the ecliptic (Meeus 22.2), plus the principal
  // nutation term. This is the Earth's axial tilt — the reason there is a
  // declination to compute at all.
  const meanObliquity =
    23 +
    (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(rad(omega));

  // Declination (Meeus 25.7). The subsolar latitude is this by definition:
  // the point where the Sun is overhead lies on the latitude equal to the
  // Sun's declination.
  const declination = deg(
    Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(apparentLongitude))),
  );

  // Equation of time (Meeus 28.3), in minutes.
  const y = Math.tan(rad(obliquity / 2)) ** 2;
  const equationOfTimeMinutes =
    4 *
    deg(
      y * Math.sin(2 * rad(meanLongitude)) -
        2 * eccentricity * Math.sin(rad(meanAnomaly)) +
        4 *
          eccentricity *
          y *
          Math.sin(rad(meanAnomaly)) *
          Math.cos(2 * rad(meanLongitude)) -
        0.5 * y * y * Math.sin(4 * rad(meanLongitude)) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * rad(meanAnomaly)),
    );

  // Subsolar longitude: the meridian where apparent solar time is noon.
  // At 12:00 UTC with a zero equation of time the Sun is over Greenwich; it
  // moves 15 degrees west per hour.
  const utcHours =
    timestampUtc.getUTCHours() +
    timestampUtc.getUTCMinutes() / 60 +
    timestampUtc.getUTCSeconds() / 3600 +
    timestampUtc.getUTCMilliseconds() / 3_600_000;

  const subsolarLongitude = normaliseLongitude(
    -DEGREES_PER_HOUR * (utcHours + equationOfTimeMinutes / 60 - 12),
  );

  return {
    timestampUtc: new Date(time),
    subsolarLatitude: declination,
    subsolarLongitude,
    declination,
    hourAngle: normaliseLongitude(-subsolarLongitude),
    equationOfTimeMinutes,
  };
}

/* -------------------------------------------------------------------------- */
/* Globe geometry                                                             */
/* -------------------------------------------------------------------------- */

/** three-globe's sphere radius. Its own constant, mirrored here. */
export const GLOBE_RADIUS = 100;

export type GlobeVector = { x: number; y: number; z: number };

/**
 * Converts geographic coordinates to three-globe's world space.
 *
 * This MUST match `polar2Cartesian` in three-globe exactly, because the same
 * convention places observation markers and country polygons. The brief
 * calls a mismatch here a hard failure, and it would be: the Sun would light
 * a different part of the world from the one the markers sit on, and every
 * position on the globe would silently disagree with the data.
 *
 * Mirrored rather than imported because three-globe does not export it.
 * `tests/solar-geometry.test.tsx` pins the formula against the library's own
 * source so a future upgrade that changed the convention would fail loudly.
 */
export function geoToGlobeVector(
  latitude: number,
  longitude: number,
  relativeAltitude = 0,
): GlobeVector {
  const phi = rad(90 - latitude);
  const theta = rad(90 - longitude);
  const r = GLOBE_RADIUS * (1 + relativeAltitude);
  const phiSin = Math.sin(phi);
  return {
    x: r * phiSin * Math.cos(theta),
    y: r * Math.cos(phi),
    z: r * phiSin * Math.sin(theta),
  };
}

/**
 * Where to put the Sun's directional light.
 *
 * Far enough out that the rays reaching the globe are effectively parallel,
 * which is what makes the terminator a great circle rather than a visibly
 * curved cut. Derived from the same solar position as the subsolar marker,
 * so the two cannot disagree.
 */
export function solarLightPosition(
  position: SolarPosition,
  distanceInRadii = 20,
): GlobeVector {
  return geoToGlobeVector(
    position.subsolarLatitude,
    position.subsolarLongitude,
    distanceInRadii,
  );
}

/**
 * Cosine of the solar zenith angle at a point: 1 directly under the Sun, 0
 * on the terminator, negative at night.
 *
 * This is the same quantity a diffuse lighting model computes from the
 * surface normal and the light direction, which is why the rendered
 * terminator and this function agree by construction rather than by tuning.
 */
export function solarAltitudeFactor(
  position: SolarPosition,
  latitude: number,
  longitude: number,
): number {
  const latRad = rad(latitude);
  const declRad = rad(position.declination);
  // Local hour angle: how far this meridian is from the subsolar meridian.
  const localHourAngle = rad(
    normaliseLongitude(longitude - position.subsolarLongitude),
  );
  return (
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(localHourAngle)
  );
}

/** True when the Sun is above the horizon at a point. */
export function isDaylight(
  position: SolarPosition,
  latitude: number,
  longitude: number,
): boolean {
  return solarAltitudeFactor(position, latitude, longitude) > 0;
}

/* -------------------------------------------------------------------------- */
/* Temporal state                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The application's temporal state for solar rendering.
 *
 * Deliberately a value, not a hook, so a scrubber or a scenario clock can be
 * introduced later without the renderer changing shape. `live` is the only
 * mode implemented; the others exist so that adding them is a new case in
 * `resolveSolarInstant` rather than a rewrite.
 *
 * This is NOT a weather frame time. Radar time is provider data describing
 * when the atmosphere was observed; this describes which instant the
 * application is depicting. They coincide in live mode and diverge the
 * moment simulation exists, so they must never share a field.
 */
export type SolarTimeState =
  | { mode: "live" }
  | { mode: "paused"; instant: Date }
  | { mode: "simulated"; instant: Date };

export function resolveSolarInstant(
  state: SolarTimeState,
  now: Date = new Date(),
): Date {
  return state.mode === "live" ? now : state.instant;
}

/**
 * How often the live globe needs to recompute.
 *
 * The Earth turns 15 degrees an hour, so one minute of clock is a quarter of
 * a degree of rotation — around 28 km at the equator, and well under a pixel
 * at any sane globe zoom. Recomputing every 60 s is already generous.
 *
 * The brief is explicit that the clock must not drive high-frequency React
 * renders, and this is the number that keeps that true: one state update per
 * minute, not one per animation frame.
 */
export const SOLAR_LIVE_REFRESH_MS = 60_000;
