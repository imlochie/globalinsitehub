/**
 * Minimal WMS GetCapabilities reader.
 *
 * Signalwatch needs exactly two facts out of a capabilities document:
 *
 *   1. does the service still publish the layer we admitted, and
 *   2. what is the valid time of its most recent frame.
 *
 * Fact 2 is the whole reason this exists. Without it the UI could only show
 * "we fetched something just now", which says nothing about whether the
 * provider's own data is current — a radar service can happily serve a frame
 * that is two hours old. The admission record requires the frame's valid time
 * to be displayed and kept distinct from the retrieval time, so it has to be
 * read from the provider rather than assumed.
 *
 * This is a deliberately narrow, tolerant reader rather than an XML parser
 * dependency: it looks for one element and fails closed. If the document
 * changes shape, the result is `null` and the product reports an honest
 * "frame time not published", never a guessed timestamp.
 */

export type WmsTimeDimension = {
  /** Latest instant the service advertises, or null when unreadable. */
  latest: Date | null;
  /** The raw dimension text, kept for diagnostics and provenance. */
  raw: string | null;
};

/** Matches `<Dimension name="time" ...>value</Dimension>` (WMS 1.3.0) and
 *  `<Extent name="time" ...>value</Extent>` (WMS 1.1.1), namespace-tolerant. */
const TIME_DIMENSION =
  /<(?:\w+:)?(Dimension|Extent)\b([^>]*\bname\s*=\s*["']time["'][^>]*)>([\s\S]*?)<\/(?:\w+:)?\1>/i;

const DEFAULT_ATTRIBUTE = /\bdefault\s*=\s*["']([^"']+)["']/i;

function parseInstant(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Resolves the newest instant in a WMS time dimension value.
 *
 * Three shapes occur in the wild and all three appear in NOAA services:
 *   "2026-10-01T13:06:59Z"                              single instant
 *   "t1,t2,t3"                                          explicit list
 *   "start/end/PT1S"                                    interval
 *
 * For an interval the END is the newest frame, so the period is ignored
 * rather than walked. Signalwatch never extrapolates past the advertised end.
 */
export function latestInstantFromDimension(value: string): Date | null {
  const candidates = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split("/");
      // interval: take the end, not the period
      return parts.length >= 2 ? parts[1] : parts[0];
    })
    .map(parseInstant)
    .filter((date): date is Date => date !== null);

  if (candidates.length === 0) return null;
  return candidates.reduce((newest, current) =>
    current.getTime() > newest.getTime() ? current : newest,
  );
}

/**
 * Reads the time dimension from a capabilities document.
 *
 * Prefers the `default` attribute, which is the service's own statement of
 * which frame it serves when no time parameter is supplied — exactly the
 * request Signalwatch makes. Falls back to the newest instant in the element
 * body.
 */
export function readTimeDimension(xml: string): WmsTimeDimension {
  const match = TIME_DIMENSION.exec(xml);
  if (!match) return { latest: null, raw: null };

  const attributes = match[2] ?? "";
  const body = (match[3] ?? "").trim();

  const defaultValue = DEFAULT_ATTRIBUTE.exec(attributes)?.[1];
  const fromDefault = defaultValue ? parseInstant(defaultValue) : null;
  const latest = fromDefault ?? (body ? latestInstantFromDimension(body) : null);

  return { latest, raw: body || defaultValue || null };
}

/**
 * True when the document advertises a `<Name>` element equal to `layer`.
 *
 * Checked because a renamed or withdrawn layer must surface as unavailable.
 * Rendering tiles for a layer the service no longer lists would produce
 * silent blank imagery, which is indistinguishable from "no precipitation".
 */
export function capabilitiesPublishLayer(xml: string, layer: string): boolean {
  const pattern = new RegExp(
    `<(?:\\w+:)?Name>\\s*${layer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*</(?:\\w+:)?Name>`,
    "i",
  );
  return pattern.test(xml);
}
