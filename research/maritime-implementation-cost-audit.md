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
