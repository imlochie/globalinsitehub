import { Router, type IRouter } from "express";
import { GetMonitoringWeatherResponse } from "@workspace/api-zod";
import {
  deriveWeatherCoverage,
  getWeatherProducts,
} from "../weather-sources/registry";
import type { SpatialProduct } from "../weather-sources/types";

type WeatherProductLoader = () => Promise<SpatialProduct[]>;

/**
 * Weather spatial products.
 *
 * Unlike every other monitoring route, this one returns surfaces rather than
 * records: there is no `limit` and no `q`, because a radar mosaic is not an
 * enumerable list of things to paginate or text-search.
 *
 * Signalwatch serves the metadata — which frame the provider is currently
 * publishing, and whether the service is healthy — while the browser requests
 * the imagery tiles from the provider directly. That split keeps provider
 * health and freshness owned by Signalwatch without turning this server into
 * a relay for NOAA's pixels.
 */
export function createMonitoringWeatherRouter(
  loadProducts: WeatherProductLoader = getWeatherProducts,
): IRouter {
  const router: IRouter = Router();

  router.get("/monitoring/weather", async (req, res): Promise<void> => {
    const products = await loadProducts();

    const response = GetMonitoringWeatherResponse.parse({
      generatedAt: new Date(),
      coverage: deriveWeatherCoverage(products),
      products,
    });

    const unavailable = products
      .filter((product) => product.availability === "unavailable")
      .map((product) => product.id);
    if (unavailable.length > 0) {
      req.log.warn(
        { unavailable },
        "Some weather products are unavailable; no surface is drawn for them, which is not a statement about the weather",
      );
    }

    res.json(response);
  });

  return router;
}

const router = createMonitoringWeatherRouter();
export default router;
