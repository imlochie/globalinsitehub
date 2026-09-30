import { Router, type IRouter } from "express";
import {
  GetMonitoringMaritimeQueryParams,
  GetMonitoringMaritimeResponse,
} from "@workspace/api-zod";
import {
  deriveCoverage,
  getMaritimeProviderSnapshots,
  maritimeProviders,
} from "../maritime-providers/registry";
import type { VesselProviderSnapshot } from "../maritime-providers/types";

type MaritimeSnapshotLoader = () => Promise<VesselProviderSnapshot[]>;

/**
 * Server-side aggregation of the free regional AIS providers.
 *
 * The browser never talks to a provider directly: credentials stay here, the
 * response is bounded, and the coverage statement travels with the data so the
 * client cannot accidentally present a regional feed as worldwide.
 */
export function createMonitoringMaritimeRouter(
  loadSnapshots: MaritimeSnapshotLoader = getMaritimeProviderSnapshots,
): IRouter {
  const router: IRouter = Router();
  router.get("/monitoring/maritime", async (req, res): Promise<void> => {
    const parsed = GetMonitoringMaritimeQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const snapshots = await loadSnapshots();
    const query = parsed.data.q?.trim().toLowerCase();
    const provider = parsed.data.provider?.trim().toLowerCase();

    const matchingVessels = snapshots
      .flatMap((snapshot) => snapshot.vessels)
      .filter((vessel) => {
        if (provider && vessel.provider.toLowerCase() !== provider) return false;
        if (!query) return true;
        return [
          vessel.mmsi,
          vessel.imo ?? "",
          vessel.callSign ?? "",
          vessel.name ?? "",
          vessel.destination ?? "",
          vessel.shipTypeLabel ?? "",
          vessel.provider,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });

    const limit = parsed.data.limit;
    const vessels = matchingVessels.slice(0, limit);
    const coverage = deriveCoverage(
      provider
        ? maritimeProviders.filter((entry) => entry.id.toLowerCase() === provider)
        : maritimeProviders,
    );

    const response = GetMonitoringMaritimeResponse.parse({
      generatedAt: new Date(),
      matchedCount: matchingVessels.length,
      returnedCount: vessels.length,
      limit,
      coverage,
      providers: snapshots.map((snapshot) => snapshot.provider),
      vessels,
    });

    const unhealthyProviders = snapshots
      .filter((snapshot) => snapshot.provider.status !== "available")
      .map((snapshot) => ({
        id: snapshot.provider.id,
        status: snapshot.provider.status,
      }));
    if (unhealthyProviders.length > 0) {
      req.log.warn(
        { unhealthyProviders },
        "Some maritime feeds are stale or unavailable; their regions are not covered right now",
      );
    }

    res.json(response);
  });
  return router;
}

const router = createMonitoringMaritimeRouter();
export default router;
