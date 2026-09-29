import { Router, type IRouter } from "express";
import {
  GetMonitoringCamerasQueryParams,
  GetMonitoringCamerasResponse,
} from "@workspace/api-zod";
import { getCameraProviderSnapshots } from "../camera-providers/registry";

const router: IRouter = Router();

router.get("/monitoring/cameras", async (req, res): Promise<void> => {
  const parsed = GetMonitoringCamerasQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const snapshots = await getCameraProviderSnapshots();
  const query = parsed.data.q?.trim().toLowerCase();
  const country = parsed.data.country?.trim().toLowerCase();
  const provider = parsed.data.provider?.trim().toLowerCase();
  const countryAliases: Record<string, { code: string; name: string }> = {
    au: { code: "AU", name: "australia" },
    aus: { code: "AU", name: "australia" },
    australia: { code: "AU", name: "australia" },
    us: { code: "US", name: "united states" },
    usa: { code: "US", name: "united states" },
    "united states": { code: "US", name: "united states" },
    "united states of america": { code: "US", name: "united states" },
  };
  const matchingCameras = snapshots
    .flatMap((snapshot) => snapshot.cameras)
    .filter((camera) => {
      if (provider && camera.provider.toLowerCase() !== provider) return false;
      if (country) {
        const countryAlias = countryAliases[country];
        if (
          countryAlias &&
          camera.countryCode?.toUpperCase() !== countryAlias.code &&
          camera.country.toLowerCase() !== countryAlias.name
        ) {
          return false;
        }
        if (
          !countryAlias &&
          camera.country.toLowerCase() !== country &&
          camera.countryCode?.toLowerCase() !== country
        ) {
          return false;
        }
      }
      if (!query) return true;
      return [
        camera.id,
        camera.provider,
        camera.displayName,
        camera.description ?? "",
        camera.country,
        camera.countryCode ?? "",
        camera.region ?? "",
        camera.subregion ?? "",
        camera.district ?? "",
        camera.locality ?? "",
        camera.postcode ?? "",
        camera.direction ?? "",
        camera.encoding ?? "",
        camera.format ?? "",
        camera.sourceUrl,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  const limit = parsed.data.limit;
  const cameras = matchingCameras.slice(0, limit);
  const response = GetMonitoringCamerasResponse.parse({
    generatedAt: new Date(),
    matchedCount: matchingCameras.length,
    returnedCount: cameras.length,
    limit,
    providers: snapshots.map((snapshot) => snapshot.provider),
    cameras,
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
      "Some camera catalogues are stale or unavailable",
    );
  }

  res.json(response);
});

export default router;