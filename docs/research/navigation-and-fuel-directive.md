# Navigation and Fuel — directive record

**Status: DESIGN ONLY. Nothing here is implemented. No provider is admitted.**

Captured from the user's Checkpoint C1/C2 brief so the intent lives in the
repository rather than in a chat log. It constrains later checkpoints; it
authorises nothing now.

---

## 1. Two modes, not one

Navigation must eventually support **normal** and **emergency** modes.

Normal navigation optimises travel conditions. Emergency navigation asks a
different question entirely:

> Given what is happening right now, where can I plausibly get to with the
> lowest combined risk and congestion?

That makes routing a **dynamic cost-surface problem**, not a shortest path.

## 2. The prohibition that shapes everything

Emergency navigation must **never** claim certainty about safety. Forbidden
outputs:

- "safe route" / "unsafe route"
- a bare "safety score", e.g. `SAFE: 83%`

A single opaque number is unauditable, and during an actual emergency an
unauditable number is worse than none. Instead expose the contributing
source-backed factors so a human can see what the claim rests on:

```
ROUTE A
Traffic       High
Road access   Open
Fire risk     Low
Flood risk    None reported
Emergency     2 incidents
Fuel access   3 stations
Distance      74 km

Overall route state: HIGH FRICTION
```

"High friction" is a statement about observed conditions. "Safe" would be a
prediction. This is the same discipline as "no radar source here" never
becoming "clear".

## 3. Route cost is a composition

Independently observable factors, never pre-fused:

congestion · closure · incident · fire exposure · flood exposure · severe
weather · infrastructure constraints · destination accessibility · optional
fuel logistics

The engine weights them by the **active scenario** — travel time dominates
normal driving; road accessibility and hazard exposure dominate evacuation;
queueing dominates a congestion scenario. The weighting model must never
change silently: the active mode and the major factors are UI state.

## 4. Destination discovery

Emergency navigation may start without a destination — "find me somewhere
suitable" — searching a permitted set: evacuation centres, emergency
shelters, hospitals, relief centres, assembly points, designated public
facilities.

**A destination must be source-backed.** Signalwatch must never promote a
generic POI into an emergency shelter. Candidates are ranked by route
feasibility and documented risk factors, never by an absolute safety verdict,
and each carries distance, road access, congestion, active hazards, active
incidents, nearby fuel, last-updated and sources.

## 5. Scenario mode

A simulation mode separate from LIVE: metropolitan evacuation, bushfire,
flood, cyclone, infrastructure failure, highway closure, severe congestion,
fuel disruption.

Hypothetical congestion, closures and hazard expansion may be modelled **only
inside scenario mode**, and must be explicitly labelled simulated. Simulated
conditions must never be presented as live observations.

This shares a structural requirement with C2's `SolarTimeState`: the
application already distinguishes live from simulated temporal state, and
scenario mode should reuse that separation rather than invent a parallel one.

## 6. Fuel is its own domain

**Fuel is NOT a child of Navigation.**

```
NAVIGATION                     FUEL
├── Traffic                    ├── stations
├── Incidents                  ├── fuel types
├── Closures                   ├── prices
├── Emergency routing          ├── freshness
├── Evacuation                 ├── opening status
└── Street context             ├── availability
                               └── price trends
```

They intersect on the map and remain independently toggleable. A route may
say "3 known fuel stations along this corridor" without fuel price becoming a
routing heuristic. Fuel becomes a routing factor only when the user enables
it explicitly **and** the underlying data supports it.

## 7. Provider admission — nothing is approved

Do not scrape Petrol Spy or any commercial fuel service. Petrol Spy's app
listings prove the product exists; they prove nothing about ingestion rights.
A third-party claim that it has no public developer API would itself need
verifying against Petrol Spy directly before that path is touched.

To research independently, each under the existing admission standard
(access · licence · redistribution · caching · attribution · rate limits ·
credentials · freshness · coverage):

- NSW **FuelCheck**
- WA **FuelWatch**
- Vic **Servo Saver** — has an official public API, access requires
  authorisation
- other official Australian government fuel feeds
- Petrol Spy — only after the official options are assessed

**Prefer official government datasets** where coverage and access permit.

## 8. Relationship to admitted work

Nothing above changes what Signalwatch currently does. For reference, the
Australian road sources already researched in
`checkpoint-c-inspection.md` §11.2 — QLDTraffic (CC BY 4.0, published public
key, 100 req/min) and TfNSW Open Data Hub (CC BY 4.0, free non-transferable
registration) — remain **researched but not admitted**. They are the likely
first Navigation sources, and the §6 rule applies to them from the start: a
provider's "traffic slowdown" must never silently become "road blocked", and
anything Signalwatch derives must be labelled derived.

## 9. Why this is interesting

The 2D map becomes the operational surface, the 3D globe the planetary
context, Navigation the decision-support surface during an emergency, and
Fuel a practical logistics layer. That is a different product from pinning
weather, traffic and fuel onto a basemap — and it is only defensible if every
claim it makes stays traceable to a source.
