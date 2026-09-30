import { getHazardFeeds, type HazardFeedOutcome } from "./feed-cache";
import { eonetSource, parseEonetEvents } from "./eonet";
import { parseUsgsEarthquakes, usgsSource } from "./usgs";
import type {
  HazardRecord,
  HazardSourceCoverage,
  HazardSourceSnapshot,
} from "./types";

type SourceDefinition = {
  id: string;
  name: string;
  attribution: string;
  licence: string;
  licenceUrl: string;
  catalogueUrl: string;
  coverage: HazardSourceCoverage;
};

function buildSnapshot(
  definition: SourceDefinition,
  outcome: HazardFeedOutcome,
  parse: (payload: unknown, receivedAt: Date) => HazardRecord[],
  receivedAt: Date,
): HazardSourceSnapshot {
  if (!outcome.ok) {
    // One source failing degrades that source only. The layer stays up and
    // reports this source as unavailable rather than rendering an empty map
    // that would imply "no hazards anywhere".
    return {
      hazards: [],
      source: {
        ...definition,
        status: "unavailable",
        hazardCount: 0,
        checkedAt: receivedAt,
        message: `${definition.name} could not be reached: ${outcome.reason}.`,
      },
    };
  }

  const hazards = parse(outcome.payload, receivedAt);
  return {
    hazards,
    source: {
      ...definition,
      status: "available",
      hazardCount: hazards.length,
      checkedAt: receivedAt,
      message:
        hazards.length > 0
          ? `${hazards.length} hazard observations received.`
          : `${definition.name} responded with no qualifying hazards in the current window.`,
    },
  };
}

/**
 * Fetches every hazard source independently and returns one snapshot each.
 * Sources never share a failure: they are settled separately upstream and
 * parsed separately here.
 */
export async function getHazardSnapshots(): Promise<HazardSourceSnapshot[]> {
  const feeds = await getHazardFeeds();
  return [
    buildSnapshot(usgsSource, feeds.usgs, parseUsgsEarthquakes, feeds.fetchedAt),
    buildSnapshot(eonetSource, feeds.eonet, parseEonetEvents, feeds.fetchedAt),
  ];
}

/**
 * Coverage is derived from the sources that actually answered, never declared
 * statically. If every available source is global the layer is global; if only
 * regional sources answered it is regional; if none answered the layer reports
 * that it currently has no coverage rather than implying worldwide silence.
 */
export function deriveHazardCoverage(
  snapshots: HazardSourceSnapshot[],
): HazardSourceCoverage {
  const available = snapshots.filter(
    (snapshot) => snapshot.source.status === "available",
  );
  if (available.length === 0) {
    return {
      scope: "local",
      regions: [],
      note: "No hazard source is currently reachable, so no coverage can be claimed.",
    };
  }

  const scope = available.some((snapshot) => snapshot.source.coverage.scope === "global")
    ? "global"
    : available.some((snapshot) => snapshot.source.coverage.scope === "regional")
      ? "regional"
      : "local";

  const regions = [
    ...new Set(available.flatMap((snapshot) => snapshot.source.coverage.regions)),
  ];

  return {
    scope,
    regions,
    note: available
      .map((snapshot) => `${snapshot.source.name}: ${snapshot.source.coverage.note}`)
      .join(" "),
  };
}

/**
 * Stable-identifier prefixes owned by the natural-hazards layer.
 *
 * The briefing's public-event list is filtered with these so a hazard is not
 * rendered twice under two different layers. Matching is on provider identity
 * only — never on the words in a title.
 */
export const HAZARD_RECORD_ID_PREFIXES = ["usgs-", "eonet-"] as const;

export function isHazardSourcedEventId(id: string): boolean {
  return HAZARD_RECORD_ID_PREFIXES.some((prefix) => id.startsWith(prefix));
}
