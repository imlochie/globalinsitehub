#!/usr/bin/env node
/**
 * Live NOAA radar verification.
 *
 * Weather Batch 1 shipped without a single GetMap request ever having been
 * issued: the development sandbox has no egress to provider hosts, so the
 * whole integration was built against the captured GetCapabilities document
 * recorded in docs/research/providers/nws-radar-wms-admission.md.
 *
 * This script is the step that promotes NOAA radar from "admitted and
 * implemented" to "operationally verified". Run it where there is real
 * outbound egress — the Windows build host is the intended place, because
 * that is also where WebView2 enters the picture:
 *
 *   node artifacts/api-server/scripts/verify-radar-live.mjs
 *   API_BASE_URL=http://127.0.0.1:5000/api node .../verify-radar-live.mjs
 *
 * It walks the chain the sandbox could not:
 *
 *   NOAA GetCapabilities -> NOAA GetMap -> Signalwatch product -> cache cadence
 *
 * Exit codes:
 *   0  the contract held
 *   1  a contract violation
 *
 * NOAA being briefly unreachable is reported, not failed: a provider outage
 * is a fact about today, not a broken build. A WRONG answer from NOAA — bad
 * CRS, missing layer, fabricated timestamp — is a failure.
 *
 * Three things this script deliberately does NOT claim:
 *
 *   1. That the imagery is geographically in the right place. Confirming
 *      that needs a reference raster or a human eye; it is listed as a
 *      manual check at the end.
 *   2. That the browser issues no request outside coverage. That is enforced
 *      by Leaflet's per-area bounds and unit-tested; confirming it live means
 *      watching the network panel, also listed as manual.
 *   3. Anything about WebView2 specifically. Run it on the Windows host and
 *      then open the packaged app; the CSP check below is static.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..", "..");

const BASE_URL = (
  process.env.API_BASE_URL ?? "http://127.0.0.1:5000/api"
).replace(/\/$/, "");
const TIMEOUT_MS = Number(process.env.VERIFY_TIMEOUT_MS ?? 45_000);

const WMS_ENDPOINT =
  "https://mapservices.weather.noaa.gov/eventdriven/services/radar/radar_base_reflectivity_time/ImageServer/WMSServer";
const WMS_LAYER = "radar_base_reflectivity_time";

/** Must match SIGNALWATCH_USER_AGENT in src/lib/provider-fetch.ts. */
const USER_AGENT = "Signalwatch/0.1 (+https://github.com/imlochie/globalinsitehub)";

const problems = [];
const notes = [];
const passes = [];

const fail = (message) => problems.push(message);
const note = (message) => notes.push(message);
const pass = (message) => passes.push(message);

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function toWebMercator(longitude, latitude) {
  const R = 6_378_137;
  const lat = Math.max(-85.051129, Math.min(85.051129, latitude));
  return [
    (R * longitude * Math.PI) / 180,
    R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
  ];
}

function mercatorBbox({ west, south, east, north }) {
  const [x0, y0] = toWebMercator(west, south);
  const [x1, y1] = toWebMercator(east, north);
  return [x0, y0, x1, y1].map((value) => value.toFixed(3)).join(",");
}

function getMapUrl({ bbox, width, height, time }) {
  const url = new URL(WMS_ENDPOINT);
  const p = url.searchParams;
  p.set("SERVICE", "WMS");
  p.set("VERSION", "1.3.0");
  p.set("REQUEST", "GetMap");
  p.set("LAYERS", WMS_LAYER);
  p.set("STYLES", "");
  p.set("CRS", "EPSG:3857");
  p.set("BBOX", bbox);
  p.set("WIDTH", String(width));
  p.set("HEIGHT", String(height));
  p.set("FORMAT", "image/png");
  p.set("TRANSPARENT", "TRUE");
  if (time) p.set("TIME", time);
  return url.toString();
}

async function providerGet(url, accept) {
  return fetch(url, {
    headers: { accept, "user-agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Reads width/height out of a PNG IHDR chunk. Null when not a PNG. */
function pngDimensions(buffer) {
  if (buffer.length < 24) return null;
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function parseInstant(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutesAgo(date) {
  return Math.round((Date.now() - date.getTime()) / 60_000);
}

/* ------------------------------------------------------------------ */
/* 0. the honest identity must not have drifted                        */
/* ------------------------------------------------------------------ */

async function checkUserAgent() {
  const source = await readFile(
    path.join(repoRoot, "artifacts/api-server/src/lib/provider-fetch.ts"),
    "utf8",
  );
  const declared = /SIGNALWATCH_USER_AGENT\s*=\s*\n?\s*"([^"]+)"/.exec(source)?.[1];
  if (declared !== USER_AGENT) {
    fail(
      `this script identifies as "${USER_AGENT}" but provider-fetch.ts declares "${declared}". ` +
        "The live check must send exactly what the server sends, or it proves nothing.",
    );
    return;
  }
  pass(`identifies honestly as ${USER_AGENT}`);
}

/* ------------------------------------------------------------------ */
/* 1. GetCapabilities                                                  */
/* ------------------------------------------------------------------ */

async function checkCapabilities() {
  let response;
  try {
    response = await providerGet(
      `${WMS_ENDPOINT}?request=GetCapabilities&service=WMS`,
      "text/xml",
    );
  } catch (error) {
    note(`NOAA GetCapabilities unreachable right now: ${error.message}`);
    return null;
  }
  if (!response.ok) {
    if ([401, 403, 429].includes(response.status)) {
      fail(
        `NOAA returned HTTP ${response.status} to an honestly identified client. ` +
          "Per the admission standard this is a rejection signal: stop and report, do not retry behind another identity.",
      );
    } else {
      note(`NOAA GetCapabilities returned HTTP ${response.status}`);
    }
    return null;
  }

  const xml = await response.text();
  if (!/WMS_Capabilities[\s\S]*version="1\.3\.0"/.test(xml)) {
    fail("capabilities document is not WMS 1.3.0 — the implementation assumes 1.3.0 semantics");
  } else {
    pass("GetCapabilities reachable, WMS 1.3.0");
  }

  if (!new RegExp(`<(?:\\w+:)?Name>\\s*${WMS_LAYER}\\s*</`, "i").test(xml)) {
    fail(`capabilities no longer publish the admitted layer "${WMS_LAYER}"`);
  } else {
    pass(`layer ${WMS_LAYER} still published`);
  }

  if (!/<(?:\w+:)?CRS>\s*EPSG:3857\s*</i.test(xml)) {
    fail(
      "EPSG:3857 is no longer advertised. The implementation requests it specifically to avoid the WMS 1.3.0 EPSG:4326 axis-order reversal.",
    );
  } else {
    pass("EPSG:3857 advertised");
  }

  const dimension = /<(?:\w+:)?(?:Dimension|Extent)\b([^>]*\bname\s*=\s*["']time["'][^>]*)>([\s\S]*?)<\//i.exec(
    xml,
  );
  const defaultTime = dimension
    ? /\bdefault\s*=\s*["']([^"']+)["']/i.exec(dimension[1])?.[1]
    : undefined;
  const body = dimension?.[2]?.trim() ?? "";
  const latestRaw =
    defaultTime ?? body.split(",").pop()?.split("/")[1] ?? body.split("/")[1];
  const latest = latestRaw ? parseInstant(latestRaw) : null;

  if (!latest) {
    note("no readable time dimension; Signalwatch will report the frame time as unknown");
  } else {
    pass(`advertised frame time ${latest.toISOString()} (${minutesAgo(latest)} min old)`);
    if (minutesAgo(latest) > 30) {
      note(
        `NOAA's own newest frame is ${minutesAgo(latest)} min old, so Signalwatch should be reporting this product as stale`,
      );
    }
  }
  return latest;
}

/* ------------------------------------------------------------------ */
/* 2-4. GetMap                                                         */
/* ------------------------------------------------------------------ */

async function fetchTile(label, options) {
  let response;
  try {
    response = await providerGet(getMapUrl(options), "image/png");
  } catch (error) {
    note(`GetMap (${label}) unreachable: ${error.message}`);
    return null;
  }
  if (!response.ok) {
    if ([401, 403, 429].includes(response.status)) {
      fail(`NOAA returned HTTP ${response.status} to GetMap (${label}) — rejection signal, stop here`);
    } else {
      note(`GetMap (${label}) returned HTTP ${response.status}`);
    }
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = Buffer.from(await response.arrayBuffer());

  // ArcGIS reports parameter errors as a 200 XML ServiceException.
  if (/xml/i.test(contentType) || body.subarray(0, 5).toString() === "<?xml") {
    fail(
      `GetMap (${label}) returned a ServiceException instead of an image: ${body
        .subarray(0, 400)
        .toString()
        .replace(/\s+/g, " ")}`,
    );
    return null;
  }
  if (!contentType.includes("image/png")) {
    fail(`GetMap (${label}) returned content-type "${contentType}", expected image/png`);
    return null;
  }

  const dimensions = pngDimensions(body);
  if (!dimensions) {
    fail(`GetMap (${label}) body is not a PNG`);
    return null;
  }
  if (dimensions.width !== options.width || dimensions.height !== options.height) {
    fail(
      `GetMap (${label}) returned ${dimensions.width}x${dimensions.height}, requested ${options.width}x${options.height}`,
    );
    return null;
  }

  pass(`GetMap (${label}) -> ${body.length} byte PNG, ${dimensions.width}x${dimensions.height}`);
  return body;
}

async function checkGetMap(latest) {
  // Inside coverage: the continental United States.
  const conus = await fetchTile("CONUS, EPSG:3857, no TIME", {
    bbox: mercatorBbox({ west: -125, south: 25, east: -66, north: 49 }),
    width: 1024,
    height: 512,
  });

  if (latest) {
    await fetchTile("CONUS, explicit TIME", {
      bbox: mercatorBbox({ west: -125, south: 25, east: -66, north: 49 }),
      width: 512,
      height: 256,
      time: latest.toISOString(),
    });
  }

  // Outside every declared coverage area: central Asia. This is the request
  // Signalwatch never makes. It is issued here once, deliberately, to
  // demonstrate WHY the per-area clip exists — the service answers happily,
  // with an empty image that on a map is indistinguishable from "no
  // precipitation here".
  const outside = await fetchTile("central Asia (outside all coverage areas)", {
    bbox: mercatorBbox({ west: 60, south: 35, east: 90, north: 55 }),
    width: 1024,
    height: 512,
  });

  if (conus && outside) {
    note(
      `outside-coverage tile is ${outside.length} bytes vs ${conus.length} bytes inside coverage — ` +
        "NOAA serves the out-of-coverage request rather than refusing it, which is exactly why " +
        "Signalwatch clips to the five named regions instead of the published envelope.",
    );
    if (outside.length >= conus.length) {
      note(
        "the out-of-coverage tile is not obviously emptier than the covered one; inspect both by eye before drawing conclusions",
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* 5-6. Signalwatch product contract and cache cadence                 */
/* ------------------------------------------------------------------ */

const PUBLISHED_ENVELOPE = { west: -176, south: 8.9956, east: 150.00479, north: 72 };
const CENTRAL_EUROPE = { west: 10, south: 45, east: 20, north: 55 };

async function getWeather() {
  const response = await fetch(`${BASE_URL}/monitoring/weather`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GET /monitoring/weather -> ${response.status}`);
  return response.json();
}

async function checkSignalwatch() {
  let first;
  try {
    first = await getWeather();
  } catch (error) {
    note(`Signalwatch API not reachable at ${BASE_URL}: ${error.message}`);
    return;
  }

  const product = first.products?.find((entry) => entry.id === "nws-radar-base-reflectivity");
  if (!product) {
    fail("Signalwatch did not return the nws-radar-base-reflectivity product");
    return;
  }

  if (product.availability === "unavailable") {
    note(`Signalwatch reports the radar product unavailable: ${product.message}`);
  } else if (product.availability === "stale") {
    note(`Signalwatch reports the radar product stale: ${product.message}`);
  } else {
    pass(`Signalwatch reports availability "${product.availability}"`);
  }

  const areas = product.coverage?.areas ?? [];
  if (areas.length !== 5) {
    fail(`expected 5 coverage areas, got ${areas.length}`);
  } else {
    pass("five named coverage areas published");
  }
  for (const area of areas) {
    if (
      area.west < PUBLISHED_ENVELOPE.west ||
      area.east > PUBLISHED_ENVELOPE.east ||
      area.south < PUBLISHED_ENVELOPE.south ||
      area.north > PUBLISHED_ENVELOPE.north
    ) {
      fail(`coverage area "${area.name}" falls outside NOAA's published envelope — the clip must only ever narrow the provider's claim`);
    }
    if (
      area.west <= CENTRAL_EUROPE.east &&
      area.east >= CENTRAL_EUROPE.west &&
      area.south <= CENTRAL_EUROPE.north &&
      area.north >= CENTRAL_EUROPE.south
    ) {
      fail(`coverage area "${area.name}" claims central Europe, which NOAA does not observe`);
    }
  }

  const imagery = product.imagery;
  if (product.availability !== "unavailable") {
    if (!imagery) {
      fail("product is available but carries no imagery descriptor");
    } else {
      const expected = {
        protocol: "wms",
        version: "1.3.0",
        crs: "EPSG:3857",
        format: "image/png",
        transparent: true,
        layer: WMS_LAYER,
      };
      for (const [key, value] of Object.entries(expected)) {
        if (imagery[key] !== value) {
          fail(`imagery.${key} is ${JSON.stringify(imagery[key])}, expected ${JSON.stringify(value)}`);
        }
      }
      if (!imagery.endpoint?.startsWith("https://mapservices.weather.noaa.gov/")) {
        fail(`imagery.endpoint is ${imagery.endpoint}; imagery must load browser -> NOAA directly`);
      }
      if (/\/api\//.test(imagery.endpoint ?? "")) {
        fail("imagery.endpoint points through Signalwatch; provider pixels must not be relayed");
      }
      pass("imagery descriptor: WMS 1.3.0, EPSG:3857, image/png, transparent, direct to NOAA");
    }
  }

  if (product.refreshIntervalMs !== 600_000) {
    fail(
      `refreshIntervalMs is ${product.refreshIntervalMs}, expected 600000. NOAA's appropriate-use policy makes the 10-minute floor a terms constraint, not a preference.`,
    );
  } else {
    pass("refresh cadence is 10 minutes");
  }

  if (product.validTime !== null || product.runTime !== null) {
    fail("radar is an observation; validTime and runTime must stay null");
  } else {
    pass("validTime and runTime are null — radar is not presented as a forecast");
  }

  const source = product.sourceTimestamp ? parseInstant(product.sourceTimestamp) : null;
  const ingestion = parseInstant(product.ingestionTimestamp);
  if (source && ingestion) {
    if (product.sourceTimestamp === product.ingestionTimestamp) {
      fail("sourceTimestamp equals ingestionTimestamp — frame time must be read from the provider, not stamped on receipt");
    } else {
      pass(
        `frame time ${source.toISOString()} (${minutesAgo(source)} min old) distinct from receipt ${ingestion.toISOString()}`,
      );
    }
  } else if (!source) {
    note("Signalwatch reports no frame time; it should be saying the valid time is unknown rather than implying freshness");
  }

  // The server cache must absorb client polling: a second immediate request
  // must not have re-queried NOAA.
  try {
    const second = await getWeather();
    const again = second.products?.find((e) => e.id === "nws-radar-base-reflectivity");
    if (again && again.ingestionTimestamp !== product.ingestionTimestamp) {
      fail(
        "two consecutive requests produced different ingestion timestamps — the metadata cache is not holding, so N clients would mean N upstream requests",
      );
    } else if (again) {
      pass("server cache held across consecutive requests (one upstream read per cycle)");
    }
  } catch {
    note("could not re-request /monitoring/weather to check the cache");
  }
}

/* ------------------------------------------------------------------ */
/* 7. CSP (static)                                                     */
/* ------------------------------------------------------------------ */

async function checkCsp() {
  let config;
  try {
    config = JSON.parse(
      await readFile(
        path.join(repoRoot, "artifacts/signalwatch-desktop/src-tauri/tauri.conf.json"),
        "utf8",
      ),
    );
  } catch (error) {
    note(`could not read the desktop CSP: ${error.message}`);
    return;
  }
  const csp = config.app?.security?.csp ?? "";
  const imgSrc = /img-src([^;]*)/.exec(csp)?.[1] ?? "";
  if (!/\bhttps:/.test(imgSrc) && !/mapservices\.weather\.noaa\.gov/.test(imgSrc)) {
    fail(
      "desktop CSP img-src does not permit remote HTTPS images; WebView2 will block NOAA radar tiles in the packaged app",
    );
  } else {
    pass("desktop CSP img-src permits direct provider imagery");
  }
}

/* ------------------------------------------------------------------ */

await checkUserAgent();
const latest = await checkCapabilities();
await checkGetMap(latest);
await checkSignalwatch();
await checkCsp();

console.log("\nNOAA radar live verification\n");
for (const line of passes) console.log(`  ok    ${line}`);
for (const line of notes) console.log(`  note  ${line}`);
for (const line of problems) console.log(`  FAIL  ${line}`);

console.log("\nStill to confirm by eye — this script cannot:");
console.log("  - the radar is drawn in the geographically correct place");
console.log("  - panning to Europe draws nothing and the panel says 'no radar source'");
console.log("  - devtools shows GetMap going direct to mapservices.weather.noaa.gov,");
console.log("    never through /api, and no request for a tile outside the five areas");
console.log("  - the packaged Windows build renders tiles inside WebView2");

if (problems.length > 0) {
  console.error(`\n${problems.length} contract violation(s).`);
  process.exit(1);
}
console.log("\nContract held.");
