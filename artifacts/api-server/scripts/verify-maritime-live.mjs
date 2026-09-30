#!/usr/bin/env node
/**
 * Live maritime verification.
 *
 * Run this where the API server has real outbound egress (e.g. Replit):
 *
 *   node artifacts/api-server/scripts/verify-maritime-live.mjs
 *   API_BASE_URL=https://your-deployment/api node .../verify-maritime-live.mjs
 *
 * It walks the chain the sandbox could not:
 *
 *   provider feed -> API normalization -> VesselRecord -> coverage/health
 *
 * and separately checks that each provider is independently usable.
 *
 * Exit codes:
 *   0  the contract held (whether or not every provider happened to be up)
 *   1  a contract violation — normalization, coverage or isolation is wrong
 *
 * A provider being `unavailable` is reported, not failed: an unconfigured
 * BarentsWatch or a provider outage is a deployment fact, not a broken build.
 */

const BASE_URL = (process.env.API_BASE_URL ?? "http://127.0.0.1:5000/api").replace(
  /\/$/,
  "",
);
const TIMEOUT_MS = Number(process.env.VERIFY_TIMEOUT_MS ?? 45_000);

const problems = [];
const notes = [];

function fail(message) {
  problems.push(message);
}

function note(message) {
  notes.push(message);
}

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GET ${path} responded ${response.status}`);
  }
  return response.json();
}

/** Documented AIS "not available" sentinels must never survive normalization. */
function checkSentinels(vessel) {
  if (vessel.courseOverGround === 360) fail(`${vessel.id}: course 360 leaked`);
  if (vessel.speedOverGround === 102.3 || vessel.speedOverGround === 102.4) {
    fail(`${vessel.id}: speed sentinel leaked`);
  }
  if (vessel.heading === 511) fail(`${vessel.id}: heading 511 leaked`);
  if (vessel.imo === "0" || vessel.imo === 0) fail(`${vessel.id}: IMO 0 leaked`);
}

function checkVessel(vessel) {
  const { latitude, longitude } = vessel;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    fail(`${vessel.id}: unusable coordinates ${latitude},${longitude}`);
  }
  if (!/^\d{6,9}$/.test(String(vessel.mmsi ?? ""))) {
    fail(`${vessel.id}: MMSI is not an identifier string`);
  }
  if (vessel.id !== `${vessel.provider}:${vessel.mmsi}`) {
    fail(`${vessel.id}: identity is not <provider>:<mmsi>`);
  }
  if (!vessel.attribution) fail(`${vessel.id}: attribution missing`);
  if (!vessel.licence) fail(`${vessel.id}: licence missing`);
  if (!vessel.receivedAt) fail(`${vessel.id}: receivedAt missing`);
  if (
    vessel.positionTimestamp &&
    vessel.positionTimestamp === vessel.receivedAt
  ) {
    fail(`${vessel.id}: provider position time equals the receipt time`);
  }
  checkSentinels(vessel);
}

function summarizeAges(vessels) {
  const ages = vessels
    .filter((vessel) => vessel.positionTimestamp)
    .map((vessel) => Date.now() - new Date(vessel.positionTimestamp).getTime())
    .sort((a, b) => a - b);
  if (ages.length === 0) return "no provider position times supplied";
  const minutes = (value) => (value / 60_000).toFixed(1);
  return `position age min ${minutes(ages[0])}m · median ${minutes(
    ages[Math.floor(ages.length / 2)],
  )}m · max ${minutes(ages[ages.length - 1])}m`;
}

async function main() {
  console.log(`Verifying maritime against ${BASE_URL}\n`);

  const all = await getJson("/monitoring/maritime");

  /* Coverage ------------------------------------------------------------- */
  console.log("COVERAGE");
  console.log(`  scope   : ${all.coverage?.scope}`);
  console.log(`  regions : ${(all.coverage?.regions ?? []).join(" | ")}`);
  if (all.coverage?.scope !== "regional") {
    fail(`coverage scope is "${all.coverage?.scope}", expected "regional"`);
  }
  if (!(all.coverage?.regions?.length > 0)) fail("coverage declares no regions");
  if (!/not evidence that no vessels are present/i.test(all.coverage?.note ?? "")) {
    fail("coverage note no longer states that absence is not evidence of absence");
  }

  /* Providers ------------------------------------------------------------ */
  console.log("\nPROVIDERS");
  const providers = all.providers ?? [];
  if (providers.length === 0) fail("no providers reported");
  for (const provider of providers) {
    const count = all.vessels.filter(
      (vessel) => vessel.provider === provider.id,
    ).length;
    console.log(
      `  ${provider.id.padEnd(14)} ${provider.status.padEnd(12)} ${String(
        count,
      ).padStart(5)} vessels  [${provider.licence}]`,
    );
    if (provider.status !== "available") {
      console.log(`      ${provider.message}`);
      note(`${provider.id} is ${provider.status} in this deployment`);
    }
    if (!provider.coverage?.regions?.length) {
      fail(`${provider.id}: declares no coverage regions`);
    }
    if (!provider.attribution || !provider.licence) {
      fail(`${provider.id}: attribution/licence missing`);
    }
  }

  /* Records -------------------------------------------------------------- */
  console.log("\nRECORDS");
  console.log(`  matched ${all.matchedCount} · returned ${all.returnedCount}`);
  if (all.returnedCount > all.limit) fail("response exceeded its own limit");
  for (const vessel of all.vessels) checkVessel(vessel);
  if (all.vessels.length > 0) {
    console.log(`  ${summarizeAges(all.vessels)}`);
    const sample = all.vessels[0];
    console.log(
      `  sample  : ${sample.name ?? `MMSI ${sample.mmsi}`} (${sample.provider}) ` +
        `${sample.latitude.toFixed(3)},${sample.longitude.toFixed(3)} ` +
        `${sample.shipTypeLabel ?? "type not supplied"}`,
    );
  } else {
    note("no vessels returned — check the provider statuses above");
  }

  /* Isolation ------------------------------------------------------------ */
  console.log("\nISOLATION");
  for (const provider of providers) {
    const scoped = await getJson(
      `/monitoring/maritime?provider=${encodeURIComponent(provider.id)}`,
    );
    const foreign = scoped.vessels.filter(
      (vessel) => vessel.provider !== provider.id,
    );
    if (foreign.length > 0) fail(`${provider.id}: filter leaked other providers`);
    if (!(scoped.coverage?.regions?.length > 0)) {
      fail(`${provider.id}: scoped response declares no coverage`);
    }
    console.log(
      `  ${provider.id.padEnd(14)} scoped request -> ${scoped.vessels.length} vessels, ` +
        `coverage "${scoped.coverage.regions.join(" | ")}"`,
    );
  }
  const healthy = providers.filter((provider) => provider.status === "available");
  const unhealthy = providers.filter((provider) => provider.status !== "available");
  if (healthy.length > 0 && unhealthy.length > 0) {
    const healthyVessels = all.vessels.filter((vessel) =>
      healthy.some((provider) => provider.id === vessel.provider),
    );
    if (healthyVessels.length === 0) {
      fail(
        `every healthy provider (${healthy
          .map((provider) => provider.id)
          .join(", ")}) returned nothing while another provider was down`,
      );
    } else {
      console.log(
        `  a down provider did not empty the healthy one: ${healthyVessels.length} vessels still served`,
      );
    }
  }

  /* Verdict -------------------------------------------------------------- */
  console.log("\nVERDICT");
  for (const item of notes) console.log(`  note: ${item}`);
  for (const item of problems) console.log(`  PROBLEM: ${item}`);
  if (problems.length > 0) {
    console.log(`\n${problems.length} contract violation(s).`);
    process.exitCode = 1;
    return;
  }
  console.log(
    all.vessels.length > 0
      ? "\nContract held with real vessel data."
      : "\nContract held, but no provider supplied data in this deployment.",
  );
}

main().catch((error) => {
  console.error(`\nVerification could not run: ${error.message}`);
  console.error(
    "If this is a network error, the deployment has no egress to the providers — " +
      "that is a deployment fact, not a provider or contract failure.",
  );
  process.exitCode = 1;
});
