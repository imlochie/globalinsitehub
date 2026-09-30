# FlightAware AeroAPI — cost and query envelope

**Status: analysis only.** No FlightAware account exists, no key was requested, no request was made, no
budget was committed, and no application code changed. All figures are taken from FlightAware's published
pricing page (`https://www.flightaware.com/commercial/aeroapi/`, read 2026-09-30) and are arithmetic applied
to *hypothetical* Signalwatch usage patterns. Prices are stated by FlightAware as subject to change.

## 1. The billing unit

> "A single query can return multiple results, depending on the call type and input. Pricing is based on
> result sets, **with one set equaling 15 records**."

This is the single most important fact for Signalwatch, and it is why AeroAPI's cost behaves very differently
from a flat-rate ADS-B API: **cost scales with how many aircraft are in the viewport**, not just with how
often we poll.

Relevant published per-query fees:

| Endpoint | Fee |
|---|---|
| `GET /flights/search` | $0.050 / result set |
| `GET /flights/search/positions` | $0.050 / result set |
| `GET /flights/search/advanced` | $0.050 / result set |
| `GET /flights/search/count` | $0.020 / result set |
| `GET /flights/{id}/position` | $0.010 / result set |
| `GET /flights/{ident}` | $0.005 / result set |

Tiers:

| | Personal | Standard | Premium |
|---|---|---|---|
| Monthly minimum | none ($5/mo free credit; $10 for ADS-B feeders) | **$100/month** | $1,000/month |
| Rate limit | 10 result sets/minute | 5 result sets/second | 100 result sets/second |
| Derivative-work rights | personal or academic only | **business / business-to-consumer** | + B2B |
| Uptime guarantee | none | none | 99.5 % |
| Volume discounting | no | yes (30 % above $1,000/mo, rising) | yes |

**Standard is the minimum tier whose rights language covers a public Signalwatch map.** Personal is explicitly
"personal or academic purposes only", so its $5/month free credit is not usable for a public deployment —
that free credit is a trap for exactly this kind of project.

## 2. Query shape

`GET /flights/search` supports a query DSL including `-latlong "minLat minLon maxLat maxLon"` and altitude
predicates, e.g.

```
/flights/search?query=-latlong "41.5 -72.5 43.5 -69.5" -belowAltitude 100
```

This is a **native bounding box** — a better fit for Signalwatch's map viewport than the 250 NM circle offered
by the community ADS-B APIs, and it removes the circumscribing-circle over-fetch described in
§4 of `research/aircraft-provider-decision.md`. `/flights/search/positions` returns positions rather than
flight records and is the more likely endpoint for a map layer. Unlike the ADS-B APIs, results are
FlightAware *flights* (identified, schedule-joined) rather than raw transponder contacts, so the observation
contract would differ — that mapping is not worked out here because no account exists.

## 3. Cost envelope

Cost per poll = `ceil(aircraft_in_viewport / 15) × $0.050`.

**Cost per poll:**

| Aircraft in viewport | Result sets | Cost per poll |
|---|---|---|
| ≤ 15 | 1 | $0.05 |
| 30 | 2 | $0.10 |
| 60 | 4 | $0.20 |
| 150 | 10 | $0.50 |
| 300 | 20 | $1.00 |

**Monthly cost of one continuously-polled shared viewport** (one server-side poller, 30 days, browsers read
the cache — so visitor count does not multiply this):

| Cadence | Polls/month | @15 ac ($0.05) | @60 ac ($0.20) | @150 ac ($0.50) |
|---|---|---|---|---|
| every 10 s | 259,200 | $12,960 | $51,840 | $129,600 |
| every 30 s | 86,400 | $4,320 | $17,280 | $43,200 |
| every 60 s | 43,200 | $2,160 | $8,640 | $21,600 |
| every 5 min | 8,640 | $432 | $1,728 | $4,320 |
| every 15 min | 2,880 | $144 | $576 | $1,440 |
| every 60 min | 720 | $36 | $144 | $360 |

**What $100/month actually buys:** 2,000 result sets. At one result set per poll (a near-empty viewport,
≤ 15 aircraft) that is **2,000 polls per month — one poll every ~21 minutes, continuously, for a single
viewport**. A 60-aircraft viewport at the same budget allows one poll every ~86 minutes.

Volume discounting does not rescue this: the first discount band starts above $1,000/month.

## 4. Conclusions

1. **AeroAPI is economically incompatible with a continuously-polled live aircraft map**, at any cadence that
   would make the layer feel live. A 30-second refresh over a moderately busy viewport is a five-figure
   monthly bill. This is not a quirk of a bad plan choice — per-record billing and live map polling are
   structurally opposed.
2. **The rights story is nevertheless the cleanest of any candidate.** Standard tier explicitly permits
   storage and distribution of derivative works for business-to-consumer purposes, which is the grant every
   other candidate withholds. If Signalwatch ever needs *guaranteed, licensed* aircraft data, this is the
   door — and the cost then becomes a product decision rather than a legal one.
3. **Where AeroAPI would actually fit Signalwatch: on-demand enrichment, not the base layer.** A user selects
   one aircraft and we fetch `GET /flights/{ident}` at $0.005 or `/flights/{id}/position` at $0.010 — a
   bounded, user-initiated cost of a few dollars a month rather than an unbounded polling cost. That is a
   different feature from the Aircraft layer and would need its own gate; it also cannot stand alone, since
   it needs a base layer to select *from*.
4. **Multi-viewport is out of the question.** Every additional independently-polled region multiplies the
   table in §3. Any AeroAPI design must have exactly one shared server-side query, never a per-visitor one.
5. **Untested and therefore UNRESOLVED:** the real average result-set count for a typical Signalwatch
   viewport (no account, and this sandbox has no egress), whether `/flights/search/positions` bills
   per-position or per-flight, and the binding AeroAPI Terms of Service text presented at account signup.
   The rights language above is from the marketing comparison table, which is evidence of intent but is not
   the contract.

## 5. Recommendation

Treat FlightAware as the **licensed fallback of last resort for the base layer**, and as a **plausible
candidate for selected-aircraft enrichment later**. Do not sign up in order to evaluate it: the pricing
arithmetic above already shows the base-layer answer, and signing up incurs a $100/month minimum from the
moment the tier is selected.

Pursue the ADSB.lol operator conversation first
(`research/adsblol-operator-inquiry.md`). If that conversation returns a clear no, the honest outcome is that
Signalwatch has **no viable aircraft base layer at a hobby budget**, and aircraft remains a planned layer —
which is a legitimate result, not a failure to try hard enough.
