import { getHazardFeeds, type HazardFeedOutcome } from "./feed-cache";
import { eonetSource, parseEonetEvents } from "./eonet";
import { firmsSource, getFirmsDetections, FIRMS_MAX_DETECTIONS } from "./firms";
import { nwsSource, parseNwsAlerts } from "./nws";
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

  // FIRMS is a bulk artefact on a slower cadence, so it is fetched outside the
  // shared 60-second feed cache and settled independently like the others.
  let firmsSnapshot: HazardSourceSnapshot;
  try {
    const hazards = await getFirmsDetections(feeds.fetchedAt);
    firmsSnapshot = {
      hazards,
      source: {
        ...firmsSource,
        status: "available",
        hazardCount: hazards.length,
        checkedAt: feeds.fetchedAt,
        message:
          hazards.length >= FIRMS_MAX_DETECTIONS
            ? `Showing the first ${FIRMS_MAX_DETECTIONS} satellite fire detections from the past 24 hours; more exist.`
            : `${hazards.length} satellite fire detections received from the past 24 hours.`,
      },
    };
  } catch (error) {
    firmsSnapshot = {
      hazards: [],
      source: {
        ...firmsSource,
        status: "unavailable",
        hazardCount: 0,
        checkedAt: feeds.fetchedAt,
        message: `${firmsSource.name} could not be reached: ${
          error instanceof Error ? error.message : "unknown error"
        }. Fire detections are missing, not absent.`,
      },
    };
  }

  return [
    buildSnapshot(usgsSource, feeds.usgs, parseUsgsEarthquakes, feeds.fetchedAt),
    buildSnapshot(eonetSource, feeds.eonet, parseEonetEvents, feeds.fetchedAt),
    buildSnapshot(nwsSource, feeds.nws, parseNwsAlerts, feeds.fetchedAt),
    firmsSnapshot,
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
