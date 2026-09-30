# Three provider clarification requests — prepared, unsent

**Status: NOT SENT.** Drafts only. No message has been sent, no account created, no receiver installed, no
feeder claimed, no key requested, no code changed. Sending requires an explicit decision by the repository
owner, from a real Signalwatch contact address.

Each request is built around **one near-binary question** whose answer collapses that branch of the gate.
Supporting questions are included but explicitly marked optional, so that a busy volunteer operator can
answer the decisive one in a sentence and stop there. None of the three asks for money, a discount, or an
exception — each asks which of two readings is correct, or whether a described use is acceptable.

Placeholders to fill before sending: `<< URL >>`, `<< contact >>`, `<< hosting provider >>`, `<< name >>`.

**Ordering advice:** send all three at once. They are independent, the answers take days to weeks, and
nothing in the repository is waiting on any particular one. Do not start work on whichever replies first —
the point is to compare the three answers, per §5 of the free-path addendum.

---

## 1. ADSB.lol

**Channel:** `info [at] adsb.lol`. Their OpenAPI info block invites production users to make contact, so this
is the documented path. A GitHub issue on `adsblol/api` is the fallback if email is unanswered.

**Decisive question:** *May Signalwatch publicly display normalized, server-cached ADSB.lol data in
production under ODbL, and at what cadence?*

> **Subject:** Production use — may Signalwatch publicly display normalized ADSB.lol data?
>
> Hello,
>
> Your API docs ask production users to get in touch before relying on the API, so I am asking before
> writing any integration code.
>
> Signalwatch (<< URL >>) is a public, non-commercial situational-awareness map. Each layer shows openly
> published live data, labelled with its source and its data age. Aircraft is currently marked *planned*
> with no data source, and stays that way until you answer.
>
> **The one question I actually need answered:**
>
> Is it acceptable for us to make **one server-side request to `/v2/point` on a fixed schedule**, normalize
> the fields into our own display shape, hold the result in a short-lived server cache, and show it on a
> public map with ODbL attribution — with browsers reading only our cache, never calling you directly? And
> if yes, **what polling interval would you consider reasonable?** Your README says limits are dynamic and
> publishes no number; I would rather be told a conservative figure than guess one.
>
> A one-line answer is completely sufficient. If the answer is no, that is equally useful and I will leave
> aircraft off the map.
>
> **Optional, if you have time** — these affect what we can honestly display, not whether we proceed:
>
> - What `User-Agent` form do you want? We plan `Signalwatch/1.0 (+<< URL >>; << contact >>)`, having seen
>   reports of `403 User-Agent too generic`.
> - Are `seen` and `seen_pos` in seconds since last message / last positional message, per the readsb
>   convention your README says you are compatible with? Is there a value past which you would rather we
>   dropped the aircraft than displayed it?
> - Are the `dbFlags` bit meanings documented anywhere? We will not label anything military, LADD or PIA
>   unless the semantics come from you.
> - In your view, does normalizing plus briefly caching create a Derivative Database under ODbL, or is our
>   map simply a Produced Work? Is there an attribution string you prefer?
> - Is the feeder-linked API key coming soon, and would you rather we set up a receiver and feed you now? We
>   are willing to.
> - We deploy on << hosting provider >>. Is that egress range one of the throttled ones?
>
> Thank you for running the service and publishing it openly.
>
> << name >> · << contact >> · << URL >>

**What each outcome means:** a yes with a cadence clears the branch and makes ADSB.lol the default path. A yes
that is silent on caching or ODbL is **not** a clearance — reply once to close that specific point. A no
closes the branch cleanly.

---

## 2. ADSB IQ

**Channel:** the contact address on `adsbiq.com` (`abuse@adsbiq.com` is published for abuse reports only —
use the general/support channel, not that one).

**Decisive question:** *Does a feeder's API key authorize requests from a cloud/VPS IP, or is access bound to
the feeder's home IP — and which of your two conflicting statements governs?*

> **Subject:** Which governs — API key from any IP (docs) or IP-bound access (Terms §4)?
>
> Hello,
>
> I am evaluating ADSB IQ for Signalwatch (<< URL >>), a public, non-commercial situational-awareness map.
> Before going further I need to resolve a contradiction between two of your own documents, because it
> decides whether the integration is possible at all.
>
> **Your API docs say:**
>
> > "Every feeder gets a unique API key. Use it from **any IP** — your laptop, VPS, phone, scripts."
>
> **Your Terms of Use §4 say:**
>
> > "API access is tied to your feeder's IP address and is **non-transferable**."
>
> **The question:** if I run a receiver at home and feed ADSB IQ, may Signalwatch's **cloud-hosted backend**
> (a different IP, << hosting provider >>) authenticate with that feeder's API key? Or is API access
> restricted to requests originating from the receiver's own IP?
>
> If it is the latter, the integration is not possible for us and I will stop here — I would much rather
> know now than build something that quietly violates your terms.
>
> **A second contradiction, if you are answering anyway:** your docs list a "Free — after trial, not
> feeding — 1 / 5 min" tier, while Terms §4 says "Non-feeder API users have no API access. Only active
> feeders may use the API." Which is current?
>
> **Optional, and only if the answer above is workable:**
>
> - Terms §6 permits use of API data for "personal, research, or commercial projects… but you may not
>   republish the aggregated feed in its entirety." Our use is a single bounded `/v2/bbox` query for the
>   user's current map viewport, normalized into our own display shape, with attribution — not a mirror of
>   your feed. Do you read that as permitted?
> - What attribution wording do you want?
> - "Active feeder" means data within 24 hours: if a home receiver goes offline, we would show the layer as
>   unavailable rather than showing stale aircraft. Is that the behaviour you would want from an integrator?
>
> Thank you — the published OpenAPI contract and the native bbox endpoint are genuinely the nicest technical
> fit I have found among the open networks, which is why I am asking rather than assuming.
>
> << name >> · << contact >> · << URL >>

**What each outcome means:** "key works from any IP" plus a workable §6 reading makes ADSB IQ the strongest
candidate overall — best query model, published contract, commercial-inclusive grant. "IP-bound" closes the
branch outright for a cloud-hosted deployment, regardless of how good the API is.

---

## 3. ADSBHub

**Channel:** the contact address on `adsbhub.org`.

**Decisive question:** *Can one contributor account feed from a home receiver while a separate cloud server
IP is allowlisted for the aggregated TCP feed?*

> **Subject:** Can a cloud server IP be allowlisted alongside a home feeder on one account?
>
> Hello,
>
> I run Signalwatch (<< URL >>), a public, non-commercial situational-awareness map, and I am planning to
> set up an ADS-B receiver and contribute it to ADSBHub.
>
> I have read your data-access terms and I understand clause 1: every user shares at least one station. I
> intend to do that regardless.
>
> **The question that decides the design:** your page says the TCP port is "opened only for hosts (IP
> addresses) configured at your profile page". My receiver would sit at a home address, but the application
> that consumes the aggregated feed runs on a **cloud server at a different IP** (<< hosting provider >>).
>
> Can both be configured on the same account — the home receiver feeding in, and the cloud server's IP
> allowlisted for the `data.adsbhub.org:5002` feed out? Or must the consuming host be the same IP as the
> feeding station?
>
> **Optional, if the answer is yes:**
>
> - Is there a limit on simultaneous TCP connections or configured IPs per account?
> - Which SBS/BaseStation message types and fields does the aggregated feed carry in practice? I want to
>   know what is genuinely available before designing around it, rather than assuming the full 30003 set.
> - Our server would hold a rolling in-memory picture and expire aircraft that stop updating, then show the
>   user's current map viewport from that — never a mirror of your whole feed. Your terms say there are no
>   restrictions on use, but I would still rather tell you what we are doing than surprise you.
> - How would you like to be credited? Clause 3 does not require attribution, but we intend to credit you
>   anyway.
>
> Thank you for running an exchange that states its data terms so plainly — it is the clearest position I
> found across the whole field.
>
> << name >> · << contact >> · << URL >>

**What each outcome means:** yes makes ADSBHub viable and brings with it the most permissive data rights of
any candidate, at the cost of building a stream consumer. No (consuming host must equal feeding host) closes
the branch for a cloud deployment unless we self-host next to the receiver — a different deployment question
entirely, and one worth noting rather than pursuing now.

---

## Handling the replies

- Paste each reply **verbatim** into `research/sources/`, with the date received. Never paraphrase a
  permission.
- Update the matrix in `research/aircraft-provider-decision.md` and re-declare the gate.
- Do not start implementation on the first yes. Compare all three against the revised criterion — permission,
  reciprocity, deployment topology, freshness semantics — because they imply genuinely different
  architectures, and the architecture should be chosen deliberately rather than by whoever answered first.
- A non-answer after a reasonable wait is itself a result: it means that branch stays `UNRESOLVED`, and it
  must not be reinterpreted as tacit permission.
