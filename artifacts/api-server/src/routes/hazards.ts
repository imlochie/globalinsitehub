import { Router, type IRouter } from "express";
import {
  GetMonitoringHazardsQueryParams,
  GetMonitoringHazardsResponse,
} from "@workspace/api-zod";
import {
  deriveHazardCoverage,
  getHazardSnapshots,
} from "../hazard-sources/registry";
import type { HazardSourceSnapshot } from "../hazard-sources/types";

type HazardSnapshotLoader = () => Promise<HazardSourceSnapshot[]>;

/**
 * Server-side aggregation of the free natural-hazard sources.
 *
 * The browser never calls USGS or NASA directly. The upstream payloads come
 * from the shared hazard feed cache, which the briefing route also reads, so
 * adding this endpoint does not add a second poll of either provider.
 */
export function createMonitoringHazardsRouter(
  loadSnapshots: HazardSnapshotLoader = getHazardSnapshots,
): IRouter {
  const router: IRouter = Router();

  router.get("/monitoring/hazards", async (req, res): Promise<void> => {
    const parsed = GetMonitoringHazardsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const snapshots = await loadSnapshots();
    const query = parsed.data.q?.trim().toLowerCase();
    const source = parsed.data.source?.trim().toLowerCase();

    const matching = snapshots
      .flatMap((snapshot) => snapshot.hazards)
      .filter((hazard) => {
        if (source && hazard.source.toLowerCase() !== source) return false;
        if (!query) return true;
        return [
          hazard.title,
          hazard.hazardType,
          hazard.place ?? "",
          hazard.source,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      // Most recently observed first, using the source's observation time.
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const limit = parsed.data.limit;
    const hazards = matching.slice(0, limit);

    const scopedSnapshots = source
      ? snapshots.filter((snapshot) => snapshot.source.id.toLowerCase() === source)
      : snapshots;

    const response = GetMonitoringHazardsResponse.parse({
      generatedAt: new Date(),
      matchedCount: matching.length,
      returnedCount: hazards.length,
      limit,
      coverage: deriveHazardCoverage(scopedSnapshots),
      sources: scopedSnapshots.map((snapshot) => snapshot.source),
      hazards,
    });

    const unavailableSources = snapshots
      .filter((snapshot) => snapshot.source.status !== "available")
      .map((snapshot) => snapshot.source.id);
    if (unavailableSources.length > 0) {
      req.log.warn(
        { unavailableSources },
        "Some hazard sources are unavailable; their hazards are missing, not absent",
      );
    }

    res.json(response);
  });

  return router;
}

const router = createMonitoringHazardsRouter();
export default router;
