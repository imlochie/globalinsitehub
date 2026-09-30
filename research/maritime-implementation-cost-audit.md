# Maritime implementation — zero-cost audit

Date: 2026-09-30. Scope: the Maritime layer as implemented (Phase H), not the
research alternatives. Verdict: **$0 recurring cost, no path to paid.**

## Providers shipped

| Question | Fintraffic / Digitraffic | Kystverket / BarentsWatch |
| --- | --- | --- |
| Subscription fee | None | None |
| API plan / tier | None — no key, no account | Free API client on a free account; no tiers published |
| Usage-based billing | None | None |
| Per-request charge | None | None |
| Payment details on account | No account exists | Account creation requires no payment method |
| Contribution / reciprocity required | No | No |
| Hardware required | No | No |
| Licence | CC BY 4.0 — distribution and commercial use with attribution | NLOD 2.0 — open government data |
| Documented limits | Terms ask clients to identify themselves (`Digitraffic-User` header, set) | Free-of-charge open component; closed component not used |

Neither provider publishes a metered tier that Signalwatch's workload could
cross into. Both are government open-data programmes, not commercial APIs.

## Deployment cost

- No new runtime dependency was added to any package. The adapters use the
  platform `fetch` and the existing Express/Zod/orval stack.
- No hosted service, queue, database table, cache service or third-party SaaS
  was introduced. Caching is in-process memory in the existing API server.
- No streaming runtime, broker or always-on connection was introduced; both
  feeds are polled over plain HTTPS from the existing server process.
- No credential is bundled. BarentsWatch is credential-gated via
  `BARENTSWATCH_CLIENT_ID` / `BARENTSWATCH_CLIENT_SECRET`; absent them the
  provider reports `unavailable` and shows nothing. It never fabricates vessels.

## Not adopted, and why

- **AISHub** — requires contributing a raw NMEA feed (hardware/reciprocity) and
  its redistribution grant is unresolved.
- **AISStream** — publishes no terms of service; not adoptable.
- **Commercial AIS providers** — excluded by the $0 recurring invariant. They are
  not part of the architecture and no fallback is designed around them.

## Actions deliberately not taken

- No account was created with any provider, no email was sent, no hardware was
  bought, no key was requested.
- Because the sandbox has no outbound network egress, live provider calls from
  the API server fail here and are reported honestly as `unavailable`. Payload
  shapes used by the parsers were taken from live responses retrieved through
  the documentation/fetch path plus the providers' published examples, not
  guessed. Sandbox egress failure is not provider failure.

## Branch deviation

Requested branch `arena/signalwatch-maritime` was not used: this session is
pinned to `arena/01a0f054-globalinsitehub`, and history was not rewritten.

---

# Deployment verification log

## Attempt 1 — 2026-09-30, Arena sandbox (NOT the Replit deployment)

Command: `pnpm --filter @workspace/api-server run verify:maritime`
Head: `7fc7cf5`. Exit code: **0**. Vessels returned: **0**.

Result classification: **DEPLOYMENT-HEALTHY / NO LIVE DATA.**
Maritime is **not** live-verified. The contract held; no provider supplied data.

| Provider | Status | Cause |
| --- | --- | --- |
| digitraffic | unavailable | Sandbox egress blocks the host (see below). Provider itself is healthy. |
| barentswatch | unavailable | `BARENTSWATCH_CLIENT_ID`/`_SECRET` not set in this environment. |

Cause isolated with evidence, not assumed:

- DNS resolves (`meri.digitraffic.fi` → 52.85.129.x), so it is not name resolution.
- TCP/443 **opens**, then the TLS handshake dies after Client Hello
  (`SSL_ERROR_SYSCALL`, curl exit 35). Port 80 fails too (curl exit 52).
- `https://github.com/` returns 200 from the same shell, so egress exists but is
  restricted to an allowlist that does not include the provider hosts.
- Digitraffic was independently confirmed **healthy at the same minute** as the
  failed fetch (`dataUpdatedTime 2026-09-30T05:58:12Z`).

Conclusion: environment egress allowlist, plus an unconfigured optional provider.
Not a provider outage, not a request bug, not an implementation failure.

### Offline replay of genuine captured provider bytes (not live verification)

To retire parser risk while the socket stays blocked, a real Digitraffic payload
slice (5 features + matching vessel metadata) was replayed through the real
parser and the real route. No data was invented; nothing was committed.

- `heading: 511` → `null`, `cog: 360.0` → `null`, `sog: 102.3` → `null`,
  `imo: 0` → `null`. Real names/types merged by MMSI (LOYA, VOLGO DON 5079,
  PRIMA LADY).
- The canonical verifier against the replayed route: **exit 0, "Contract held
  with real vessel data"**, including *"a down provider did not empty the
  healthy one: 5 vessels still served"* (Digitraffic healthy, BarentsWatch
  unavailable).
- Frontend path on that data: 5 records → **1** normalized observation; the
  other 4 were correctly **removed as stale** (positions 13.6–23.2 h old against
  the 30-minute moving-vessel threshold). Inspector rendered real MMSI,
  provenance and receipt time with no "Unknown"/"N/A"; control rendered
  Operational + `Regional:` + both provider states; toggling maritime off
  removed only maritime observations and re-enabling restored them.

This proves the parser and the chain against genuine bytes. It does **not**
substitute for a live run: the socket, the poll loop, the cache ageing and
BarentsWatch's OAuth2 path remain unexercised.

## Still required for LIVE VERIFIED

Run the same command in Replit (egress present):

```bash
pnpm --filter @workspace/api-server run verify:maritime
```

Expected on success: `digitraffic available` with a non-zero vessel count and
"Contract held with real vessel data". BarentsWatch stays `unavailable` until
its free credentials are configured — that is acceptable and must not flip the
layer to `planned`.

## Cost position at this checkpoint

Unchanged and re-confirmed: no paid API, no subscription, no usage billing, no
per-request charge, no commercial account, no required paid upgrade. No account
was created, no payment information entered, no trial enabled. The only
package.json change in this work is a script entry; zero dependencies added.
