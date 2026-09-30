/**
 * Shared AIS decoding helpers.
 *
 * Only two kinds of transformation happen here:
 *   1. dropping documented "not available" sentinel values, and
 *   2. naming codes that the AIS message standard (ITU-R M.1371) itself names.
 *
 * Nothing is inferred. A ship type and a navigational status are values the
 * vessel broadcasts about itself; naming code 70 "Cargo" restates the vessel's
 * own claim and is not an assessment by Signalwatch. No category is invented,
 * and no vessel is classified from its name, movement or destination.
 */

/** Course over ground: 360.0 means "not available". */
export function courseOverGround(value: unknown): number | null {
  const course = finite(value);
  if (course === null) return null;
  if (course >= 360 || course < 0) return null;
  return course;
}

/** Speed over ground in knots: 102.3 / 102.4 mean "not available". */
export function speedOverGround(value: unknown): number | null {
  const speed = finite(value);
  if (speed === null) return null;
  if (speed < 0 || speed >= 102.3) return null;
  return speed;
}

/** True heading: 511 means "not available". */
export function trueHeading(value: unknown): number | null {
  const heading = finite(value);
  if (heading === null) return null;
  if (heading < 0 || heading > 359) return null;
  return Math.round(heading);
}

/** IMO number: 0 (or absent) means the vessel reported none. */
export function imoNumber(value: unknown): string | null {
  const imo = finite(value);
  if (imo === null || imo <= 0) {
    const text = trimmedText(value);
    return text && text !== "0" ? text : null;
  }
  return String(Math.trunc(imo));
}

/** AIS text fields are fixed width and arrive padded with spaces or @. */
export function aisText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/@+/g, " ").trim();
  return text.length > 0 ? text : null;
}

export function trimmedText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function finite(value: unknown): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

export function isValidCoordinates(
  latitude: number | null,
  longitude: number | null,
): boolean {
  return (
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

const NAVIGATIONAL_STATUS: Record<number, string> = {
  0: "Under way using engine",
  1: "At anchor",
  2: "Not under command",
  3: "Restricted manoeuvrability",
  4: "Constrained by draught",
  5: "Moored",
  6: "Aground",
  7: "Engaged in fishing",
  8: "Under way sailing",
  11: "Under tow astern",
  12: "Under tow alongside or pushing",
  14: "AIS-SART, MOB-AIS or EPIRB-AIS active",
};

/** Codes 9, 10, 13 are reserved and 15 is "undefined"; those stay unlabelled. */
export function navigationalStatusLabel(code: number | null): string | null {
  if (code === null) return null;
  return NAVIGATIONAL_STATUS[code] ?? null;
}

export function navigationalStatus(value: unknown): number | null {
  const code = finite(value);
  if (code === null || code < 0 || code > 15) return null;
  // 15 means the vessel did not supply a status.
  return code === 15 ? null : Math.trunc(code);
}

const SHIP_TYPE_EXACT: Record<number, string> = {
  30: "Fishing",
  31: "Towing",
  32: "Towing (long or wide tow)",
  33: "Dredging or underwater operations",
  34: "Diving operations",
  35: "Military operations",
  36: "Sailing",
  37: "Pleasure craft",
  50: "Pilot vessel",
  51: "Search and rescue vessel",
  52: "Tug",
  53: "Port tender",
  54: "Anti-pollution equipment",
  55: "Law enforcement",
  58: "Medical transport",
  59: "Vessel operating under RR Resolution No. 18",
};

const SHIP_TYPE_GROUP: Record<number, string> = {
  20: "Wing in ground craft",
  40: "High speed craft",
  60: "Passenger",
  70: "Cargo",
  80: "Tanker",
  90: "Other type",
};

/**
 * Labels the ship-type code exactly as the AIS standard defines it. Unknown or
 * reserved codes (including 0, "not available") return null so the UI can omit
 * the field rather than print a guess.
 */
export function shipTypeLabel(code: number | null): string | null {
  if (code === null || code <= 0) return null;
  if (SHIP_TYPE_EXACT[code]) return SHIP_TYPE_EXACT[code]!;
  const group = Math.trunc(code / 10) * 10;
  return SHIP_TYPE_GROUP[group] ?? null;
}

export function shipType(value: unknown): number | null {
  const code = finite(value);
  if (code === null || code <= 0 || code > 99) return null;
  return Math.trunc(code);
}

/** MMSI is an identifier, not a quantity: keep it as a string. */
export function mmsiString(value: unknown): string | null {
  const text = trimmedText(typeof value === "number" ? String(value) : value);
  if (!text) return null;
  return /^\d{6,9}$/.test(text) ? text : null;
}

export function epochMillis(value: unknown): Date | null {
  const millis = finite(value);
  if (millis === null || millis <= 0) return null;
  const date = new Date(millis);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function isoDate(value: unknown): Date | null {
  const text = trimmedText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}
