import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/**
 * Bind address.
 *
 * Server deployments need every interface, so that stays the default. The
 * packaged desktop app sets HOST=127.0.0.1 because its bundled API must be
 * reachable only by the app itself — without this, installing Signalwatch
 * would publish its API to the whole local network.
 */
const host = process.env["HOST"]?.trim() || "0.0.0.0";

app.listen(port, host, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, host }, "Server listening");
});
