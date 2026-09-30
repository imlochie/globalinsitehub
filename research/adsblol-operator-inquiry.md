# ADSB.lol operator inquiry — prepared draft

**Status: NOT SENT.** This is a prepared draft only. No message has been sent to ADSB.lol or any other
provider, no account was created, no key was requested, and no application code changed. Sending requires an
explicit decision by the repository owner, from a real Signalwatch contact address.

**Why ADSB.lol first:** its own API documentation is the only one among the candidates that *invites* the
contact — "If you want to use the API for production purposes, please contact me so I do not break your
application by accident" (`https://api.adsb.lol/api/openapi.json`, info block). Knocking on that door is the
documented path, not an imposition.

**Contact:** `info [at] adsb.lol` (published on `https://www.adsb.lol/privacy-license/`).
An issue on `github.com/adsblol/api` is the plausible alternative channel if email goes unanswered; note that
`adsblol/website` issue #272 and `wiedehopf/tar1090` issue #469 show the operator does engage with production
users in public issues.

**Before sending, fill in:** the Signalwatch public URL, the deployment's egress provider and IP range (or a
statement that it is not known), and a real reply-to address. Placeholders are marked `<< >>`.

---

## Draft message

> **Subject:** Production use inquiry — Signalwatch (public situational-awareness map), ADSB.lol point API
>
> Hello,
>
> Your API documentation asks production users to get in touch before relying on the API, so I am doing that
> before writing any integration code. Nothing is built yet and we have made no requests beyond a couple of
> one-off documentation checks — we would rather agree the terms first than ask forgiveness later.
>
> **What Signalwatch is.** A public, non-commercial situational-awareness web map (<< URL >>). It shows
> layers of openly published live data — currently public traffic cameras and public event feeds — each
> labelled with its source and its data age. Aircraft is currently registered as a *planned* layer with no
> data source attached, and it is displayed as planned rather than live. It stays that way until we have
> your answer.
>
> **What we would like to do, concretely:**
>
> - One server-side poll of `GET /v2/point/{lat}/{lon}/{radius}` on a fixed schedule, from a single backend
>   host. Radius clamped well below your 250 NM maximum (we expect 50–100 NM for a typical map viewport).
> - Browsers never call your API. They read a snapshot cached by our server, so the request count does not
>   scale with the number of visitors — a hundred simultaneous viewers produce the same load on you as one.
> - Above a zoom level where a single bounded circle cannot honestly cover the view, we intend to show
>   nothing and tell the user to zoom in, rather than tiling many queries across a continent.
> - Normalization to our internal observation shape (ICAO hex, position, altitude, ground speed, track,
>   vertical rate, squawk, position age), then display on a map with the position age visible.
> - Visible attribution to ADSB.lol and ODbL 1.0 on the map and on our sources page.
> - Aircraft flagged PIA or LADD excluded from display.
> - A contact-bearing `User-Agent`, no retry storms, exponential backoff on any error.
>
> **What we would like confirmed in writing.** Short answers are completely fine — we will record whatever
> you say verbatim and design to it.
>
> 1. **Public display.** Is displaying ADSB.lol-derived aircraft positions on a public, non-commercial web
>    map acceptable to you?
> 2. **Server-side polling and caching.** Is a single backend poller holding a short-lived cache (seconds to
>    a couple of minutes) and fanning it out to browsers acceptable, and is that preferable to you over
>    browsers querying you directly?
> 3. **Cadence and request budget.** What polling interval and request budget would you consider reasonable
>    for a use like this? Your README says limits are dynamic with load and publishes no number; we would
>    rather be told a conservative figure than guess one. If there is a cadence at which you would rather we
>    did not bother you at all, please say so.
> 4. **Identification.** What `User-Agent` format do you want? We have seen reports of
>    `403 User-Agent too generic; include valid contact info.` We plan something like
>    `Signalwatch/1.0 (+<< URL >>; << contact >>)` unless you prefer another form. Is there any other header
>    or registration you want from identified applications?
> 5. **`seen` and `seen_pos`.** Your schema has both, with no documented unit. May we confirm that they are
>    seconds since the last message and since the last *positional* message respectively, as in the readsb /
>    ADSBExchange v2 convention your README says you are compatible with? And is there a `seen_pos` value
>    past which you would consider a position too stale to show? We would rather drop an aircraft than
>    display a position that is no longer true.
> 6. **`dbFlags`.** Are the bit meanings documented anywhere? We will not label an aircraft military,
>    LADD or PIA on our map unless the field semantics are stated by you — mislabelling an aircraft is worse
>    than omitting the label.
> 7. **ODbL and our data handling.** This is the question we are least able to answer ourselves. Our map is
>    plainly a Produced Work. What is less clear is whether normalizing your fields into our own schema and
>    holding them briefly in a server cache creates a Derivative Database in your view, and therefore whether
>    share-alike obligations attach. How do you interpret that for applications like ours, and is there a
>    particular attribution string you want used?
> 8. **Future API key.** Your documentation says a key will eventually be required and will be obtainable by
>    feeding. Is there a timeline, will there be a transition period for existing identified users, and would
>    you prefer that we set up a receiver and feed ADSB.lol now? We are willing to do that; please say if it
>    is the preferred route to access rather than an optional courtesy.
> 9. **Hosting egress.** Signalwatch is deployed on << hosting provider >>. We are aware that requests from
>    some shared cloud egress ranges receive HTTP 429 regardless of cadence. Is our provider's egress in a
>    throttled range, and if so is allowlisting an identified application possible, or is feeding the
>    intended way to get around it?
>
> If any of this is not something you want to support, that is a perfectly good answer and we will leave
> aircraft off the map — we are not looking to talk you into anything. Thank you for running the service and
> for publishing it under an open licence.
>
> << name >>
> << reply-to address >>
> << project URL >>

---

## How the reply gets used

Each answer maps to a specific blocker in `research/aircraft-provider-decision.md`:

| Answer | Unblocks |
|---|---|
| 1, 2 | The gate itself — the rights question that makes the gate CONDITIONAL |
| 3, 9 | §4 cadence and rate budget; whether the deployment can reach the API at all |
| 4 | The adapter's request headers |
| 5 | The `observedAt` and `staleSeconds` contract fields in §3 — currently unbuildable |
| 6 | Whether any military/special-status field may exist in the contract at all |
| 7 | Whether normalization + cache is permissible as designed, and the attribution string |
| 8 | Whether the integration has a shelf life, and whether to stand up a feeder first |

A reply that is silent on 1, 2 or 7 does **not** clear the gate. A reply that declines any of them closes
ADSB.lol as a path, and the decision moves to the FlightAware envelope
(`research/flightaware-cost-envelope.md`) or to leaving aircraft planned indefinitely.

Whatever comes back should be pasted verbatim into `research/sources/` and summarized in the decision record
with the date received. Do not paraphrase permissions.
