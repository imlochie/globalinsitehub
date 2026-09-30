# Free-path addendum to the aircraft provider gate

**Status: research only.** No account, no receiver, no feeder claim, no key, no message sent, no code changed.
Aircraft remains a `planned` layer with no source.

**Date:** 2026-09-30. Companion to `research/aircraft-provider-decision.md`, which set the gate at
**CONDITIONAL**. This addendum exists because that record over-weighted the paid fallback and under-weighted
the reciprocity model that the open networks actually run on. Nothing here changes the gate. It changes the
shape of the remaining question: not *"can we afford aircraft?"* but *"which free network's terms permit
Signalwatch's public normalized display?"*

**Environment caveat, unchanged:** this sandbox has no outbound egress. Nothing below was probed live; every
statement is first-party documentation, quoted.

---

## 1. The three free models

"Free" is not one thing. The open networks differ in *what they ask for instead of money*, and that
difference — not price — is what decides whether Signalwatch can use them.

| | Money | Reciprocity | Public-display / redistribution position | Technical fit |
|---|---|---|---|---|
| **ADSB.lol** | Free | Optional now; feeder-linked key announced for later | ODbL 1.0, but the app's classification is unstated — **needs operator confirmation** | Strong (250 NM circle) |
| **ADSB IQ** | Free | **Feed to get any API access** | Terms grant personal/research/**commercial** use, minus republishing the feed in its entirety — **best free grant found, with caveats (§3)** | Very strong (native bbox + WebSocket) |
| **ADSBHub** | Free | **Must feed ≥ 1 station** | **"There are no restrictions… Everybody is allowed to publish the data for free or to use it for commercial purposes."** | Workable, but raw TCP/SBS |
| adsb.fi | Free | Encouraged | Personal, non-commercial only — **excludes a public map** | Strong (250 NM circle) |
| Airplanes.live | Free | Encouraged | Terms pages 404 — **unknown** | Unknown |
| OpenSky | Free | None | Written licence required for operational use — **excludes this** | Strong (bbox) |
| FlightAware | **Paid** | None | Commercial licence path | Strong, economically wrong here |

The pattern: **the genuinely free providers ask for reciprocity or discretion instead of money.** Feed us, or
ask us first. That is a toll Signalwatch can pay.

---

## 2. ADSBHub — the clearest public-display grant found anywhere

Verbatim from `https://data.adsbhub.org/howtogetdata.php` (read 2026-09-30):

```
TERMS OF USE
1) Every ADSBHub user has to share data feed at least one ADS-B station.
   However, sharing of more ADS-B sources will be highly appreciated.
2) Every ADSBHub user will receive the aggregated feed of all data sources received from all other ADSBHub users.
3) There are no restrictions on how the users will use the data.
   Everybody is allowed to publish the data for free or to use it for commercial purposes.
4) ADSBHub is NOT RESPONSIBLE for any loss caused by technical failures or data feeds with bad quality.
```

Clause 3 is the single most permissive statement encountered in this entire research effort. It grants,
unconditionally and in writing, exactly the right that ADS-B Exchange and OpenSky withhold.

**Access model:** after your station feeds, ADSBHub automatically allowlists your IP and opens inbound TCP.

```
Host: data.adsbhub.org
TCP port: 5002
Format: SBS (BaseStation / port-30003 CSV)
```

"The TCP port is opened only for hosts (IP addresses) configured at your profile page."

**Consequences for Signalwatch, honestly stated:**

- **Hard prerequisite: a receiver.** Clause 1 is not optional. No feed, no access.
- **It is not a REST API.** There is no viewport query, no bounding box, no radius, no polling. It is a
  persistent TCP socket delivering a worldwide CSV message stream that you must connect to, parse, and hold
  in memory as state. Viewport filtering happens entirely on our side.
- **This inverts the architecture** described in §4 of the decision record. There is no "query strategy" —
  there is an ingestion service maintaining an in-memory aircraft table, which the viewport then reads from.
  That is arguably *better* (zero per-viewport upstream cost, instant pans, no rate budget at all) but it is
  a different piece of software: a long-lived stateful stream consumer, not a cached fetcher, and one that
  does not fit the `createMemoryCachedCameraProvider` shape at all.
- **SBS/30003 is a thin format.** It carries hex, callsign, position, altitude, speed, track, vertical rate,
  squawk and a few flags across several message types that must be merged per-aircraft. No registration, no
  aircraft type, no `seen`/`seen_pos` — **freshness must be derived from our own receipt timestamps**, which
  is actually cleaner than ADSB.lol's undocumented `seen_pos`.
- **`UNRESOLVED`:** the exact SBS field set ADSBHub emits, coverage density, whether a cloud-hosted IP may be
  allowlisted alongside a home feeder IP, and whether there is a client limit per account.

**Verdict:** the best *rights* answer of any free provider, at the cost of hardware plus a stream-ingestion
service. Attribution is not even required by clause 3 — we should credit them anyway.

---

## 3. ADSB IQ — best technical fit, genuinely good grant, two documentation conflicts

**Access tiers** (`https://adsbiq.com/api/docs`):

| Tier | Who | REST | Live WebSocket |
|---|---|---|---|
| Trial | New user, first 3 days | 1 / 20 s | 10 s push |
| Free | After trial, not feeding | 1 / 5 min | 150 s push |
| Contributor | Active ADS-B feeder | 1 / 20 s | 10 s push |

Plus a fair-use daily budget; exceeding it returns `429` with `Retry-After` and a pointer to the WebSocket
"far lighter than polling" or the free bulk download.

**Query model — the best fit encountered.** `GET /v2/bbox` takes `min_lat`, `min_lon`, `max_lat`, `max_lon`:
a **native viewport rectangle**, which eliminates the circumscribing-circle over-fetch that every 250 NM
circle API forces on us. Also `/v2/lat/{lat}/lon/{lon}/dist/{nm}`, `/v2/aircraft/nearest`, and identity
lookups by hex/reg/type/callsign. A WebSocket push model exists alongside REST, which suits a live layer far
better than repeated snapshot polling. A validated **OpenAPI 3.1 contract** is published at
`https://adsbiq.com/api/other/openapi.yaml` — the only free provider offering a machine-readable contract we
could generate a client from, which matters given this repo's OpenAPI-first pipeline.

**Terms of Use** (`https://adsbiq.com/terms`, last updated 2026-03-24):

- §6, verbatim: *"Raw ADS-B transmissions are uncopyrightable publicly broadcast signals… **You may use API
  data for personal, research, or commercial projects subject to these terms, but you may not republish the
  aggregated feed in its entirety.**"* — an affirmative use grant that covers a public map. Signalwatch shows
  a viewport slice with its own presentation; that is not republishing the feed in its entirety. Reasonable
  reading, but it is our reading, not theirs — see the question list below.
- §4: *"You may not use the API for bulk scraping or systematic mirroring of the data feed for
  redistribution."* Consistent with the above. Our single bounded viewport query is neither.
- §5: not for ATC, flight safety, navigation, or any safety-critical application. Signalwatch already frames
  layers as situational awareness, not operational decision-making; this must stay true for aircraft.
- §7: no tracking of individuals, no harassment/surveillance use, no synthetic/spoofed flight data. The last
  clause aligns exactly with this project's standing "no fabricated data" rule.
- §3: feeders grant ADSB IQ a worldwide licence to redistribute contributed data; feeder location is used for
  MLAT and is not public unless opted in; a heartbeat with feeder UUID and IP is sent every ~5 minutes.
- §3b: the install script's auto-update is **opt-in** (disabled by default), downloads over HTTPS with SHA-256
  verification, and the script is auditable via `curl -sL adsbiq.com/feed.sh | less`. Worth noting since it
  would be running on someone's home network.

**Two conflicts between the docs page and the Terms — must be resolved before selecting ADSB IQ:**

1. **Does a non-feeder have any access?** The docs advertise a "Free — after trial, not feeding — 1 / 5 min"
   tier. Terms §4 says flatly: *"**Non-feeder API users have no API access. Only active feeders may use the
   API.**"* These cannot both be true. Assume the Terms win.
2. **Is access key-based or IP-bound?** The docs say *"Every feeder gets a unique API key. Use it from **any
   IP** — your laptop, VPS, phone, scripts"*, which is precisely what a Replit-hosted backend needs. Terms §4
   says *"API access is tied to your feeder's IP address and is **non-transferable**."* If the Terms govern,
   a home feeder cannot authorize a cloud-hosted Signalwatch backend, and the whole path collapses. **This is
   the single most important question to ask them.**

Also relevant: **"active feeder" means data received within the last 24 hours.** A Signalwatch aircraft layer
depending on contributor access would go dark whenever the receiver is unplugged, the home internet drops, or
the antenna is moved — an operational dependency on someone's living room. The layer would need to degrade to
"unavailable" honestly, which the existing provider status model already supports.

**Free bulk open data, no account, no feeding** (`https://adsbiq.com/data`): daily zstd-Parquet of aircraft
state diffs on GitHub Releases, **ODbL-1.0, attribution "ADSB IQ feeder network"**, no token, no rate limit.
Not usable for a live layer — it is yesterday's data — but it is a genuinely free, clearly licensed source for
any future historical/analysis feature, and worth remembering.

---

## 4. ADSB.lol — unchanged, still the cheapest first move

Nothing new since the decision record: free, ODbL 1.0, no key today, 250 NM circle, and documentation that
explicitly asks production users to make contact. Feeders additionally get the direct `re-api` and raw
aggregated data.

It remains the right first door **because it costs nothing and requires no hardware to find out.** The
drafted inquiry in `research/adsblol-operator-inquiry.md` already includes the reciprocity offer (question 8:
willingness to stand up a receiver and feed).

---

## 5. Revised gate — one more research step, then implement

The decision record's gate stands, but the remaining work is now specific and finite:

```
                    FREE AIRCRAFT PATH
                           |
            +--------------+--------------+
            |              |              |
         ADSB.lol       ADSB IQ        ADSBHub
            |              |              |
       ask permission   verify terms   verify terms
            |              |              |
            +--------------+--------------+
                           |
                    choose viable path
                           |
                    THEN implement
```

**Questions that close each branch:**

| Provider | What must be answered | Cost to find out |
|---|---|---|
| ADSB.lol | The nine questions already drafted — chiefly public display, server-side caching, ODbL classification, cadence | One email |
| ADSB IQ | (a) Can a cloud-hosted backend authenticate with a feeder's key, or is access strictly IP-bound to the receiver? (b) Is the non-feeder Free tier real, or does Terms §4 govern? (c) Does §6 permit a public map of a viewport slice, with what attribution? | One email; a receiver if (a) is IP-bound-but-flexible |
| ADSBHub | (a) May a second, cloud-hosted IP be allowlisted alongside the home feeder? (b) What exactly does their SBS stream carry? (c) Any client/connection limit? | One email + a receiver |

**One receiver may unlock several of these at once.** Standard feeder tooling supports feeding multiple
aggregators simultaneously from a single Pi + RTL-SDR (roughly $30–50 one-off, no subscription). That turns
the hardware into Signalwatch's own upstream contribution node rather than a per-provider cost, and it
improves the answer to the ADSB.lol email at the same time. It also means the reciprocity is real:
Signalwatch would be giving data back to the networks it draws from, which is a considerably better posture
than extracting from a volunteer network for free.

**Deliberately not decided here:** which path wins. Two of the three depend on answers nobody has yet, and the
technical architectures diverge sharply — ADSB IQ and ADSB.lol are request/response or push over HTTP and fit
the existing layer-source shape; ADSBHub is a stateful TCP stream consumer that does not. Choosing the feed
model before the rights answer would be exactly the mistake the standing rule forbids: letting the provider
dictate the architecture.

---

## 6. What this addendum changes

- The paid path is **not** the answer, and the decision record should not be read as implying it is.
  FlightAware stays documented as a licensed fallback of last resort and nothing more.
- **ADSBHub** supplies a written, unconditional publish grant — the thing the whole gate was blocked on —
  at the price of a receiver and a stream-ingestion service.
- **ADSB IQ** supplies the best technical contract of any candidate (native bbox, WebSocket, published
  OpenAPI) and a good commercial-inclusive grant, with two documentation conflicts that must be resolved
  before it can be trusted.
- The remaining blocker is now **three emails and possibly one $30–50 receiver**, not a subscription.
- Aircraft stays `planned` for exactly one more gate.
