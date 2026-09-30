import { Router, type IRouter } from "express";
import {
  GetMonitoringPublicEventsQueryParams,
  GetMonitoringPublicEventsResponse,
} from "@workspace/api-zod";
import {
  derivePublicEventCoverage,
  getPublicEventProviderSnapshots,
} from "../public-event-providers/registry";
import type { PublicEventProviderSnapshot } from "../public-event-providers/types";

type SnapshotLoader = () => Promise<PublicEventProviderSnapshot[]>;

/**
 * Server-side aggregation of the free state road authority incident feeds.
 *
 * Credentials stay on the server, the response is bounded, and the coverage
 * statement travels with the data so the client cannot present two Australian
 * states as national coverage.
 */
export function createMonitoringPublicEventsRouter(
  loadSnapshots: SnapshotLoader = getPublicEventProviderSnapshots,
): IRouter {
  const router: IRouter = Router();

  router.get("/monitoring/public-events", async (req, res): Promise<void> => {
    const parsed = GetMonitoringPublicEventsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const snapshots = await loadSnapshots();
    const query = parsed.data.q?.trim().toLowerCase();
    const provider = parsed.data.provider?.trim().toLowerCase();

    const matching = snapshots
      .flatMap((snapshot) => snapshot.events)
      .filter((event) => {
        if (provider && event.provider.toLowerCase() !== provider) return false;
        if (!query) return true;
        return [
          event.title,
          event.eventType,
          event.eventSubtype ?? "",
          event.roadSummary?.roadName ?? "",
          event.roadSummary?.locality ?? "",
          event.provider,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        const left = a.lastUpdatedAt ?? a.publishedAt ?? a.receivedAt;
        const right = b.lastUpdatedAt ?? b.publishedAt ?? b.receivedAt;
        return right.getTime() - left.getTime();
      });

    const limit = parsed.data.limit;
    const events = matching.slice(0, limit);
    const scoped = provider
      ? snapshots.filter(
          (snapshot) => snapshot.provider.id.toLowerCase() === provider,
        )
      : snapshots;

    const response = GetMonitoringPublicEventsResponse.parse({
      generatedAt: new Date(),
      matchedCount: matching.length,
      returnedCount: events.length,
      limit,
      coverage: derivePublicEventCoverage(scoped),
      providers: scoped.map((snapshot) => snapshot.provider),
      events,
    });

    const degraded = snapshots
      .filter((snapshot) => snapshot.provider.status !== "available")
      .map((snapshot) => ({
        id: snapshot.provider.id,
        status: snapshot.provider.status,
      }));
    if (degraded.length > 0) {
      req.log.warn(
        { degradedProviders: degraded },
        "Some civic incident providers are unavailable or unconfigured; their regions are not covered right now",
      );
    }

    res.json(response);
  });

  return router;
}

const router = createMonitoringPublicEventsRouter();
export default router;
