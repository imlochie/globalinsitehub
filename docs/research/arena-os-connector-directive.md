# Arena OS connector — recorded directive

Status: **recorded, not implemented.** Scheduled as **C11**, after the
Australian weather, navigation, traffic, street-context, emergency-navigation
and fuel work. Nothing in this document authorises code today.

---

## 1. The authority boundary

This is the load-bearing rule and everything else follows from it.

| | Authoritative over |
|---|---|
| **Arena OS** | canonical state, tasks, plans, schedules, decisions, memory, workflows |
| **Signalwatch** | its own observations, source metadata, spatial context, provider-derived states, environmental conditions |

**Neither may silently become authoritative over the other.**

Signalwatch supplies **contextual evidence**. Arena **decides action**.
Signalwatch must **never mutate canonical Arena state directly**.

The failure this prevents is a drift where Signalwatch starts "knowing" what
the user is doing, or Arena starts "knowing" what the weather is. Each would
make one system an unaccountable mirror of the other, and the moment they
disagree there would be no way to say which is wrong.

## 2. What crosses the boundary

The connector translates Signalwatch observations into **normalized Arena
context objects**. It does not hand over raw provider payloads, and it does
not hand over Signalwatch's internal rendering state.

**Initial direction — read only, Signalwatch → Arena:**
situational context, hazards, traffic, weather, navigation constraints, fuel,
spatial situations.

**Future bidirectional:**

- Arena → Signalwatch: task, destination, time window, priority, operating mode.
- Signalwatch → Arena: environmental change, route disruption, hazard, weather,
  source-backed situation.

## 3. Every transferred object preserves provenance

Non-negotiable. Each object carries:

- `source`
- `observedAt`
- freshness
- provenance
- geographic scope
- confidence

A context object that loses its source is indistinguishable from an assertion
Signalwatch invented. This is the same discipline the observation and spatial
models already enforce internally; the connector is not an exemption from it.

## 4. Transport

An **explicit connector contract**, never direct database coupling.
**No shared database.**

Eventually: a local API, an event stream, webhooks, and authenticated
read-only context queries.

A shared database would let either side mutate the other's state without
passing through the authority boundary in §1, which is precisely the thing
this design exists to prevent. The contract is the enforcement mechanism.

## 5. Interaction with the mobile-first constraint

The connector must be **network/API based, never desktop-process based**, so
Windows, browser, iOS and Android can all use it. See
`mobile-first-constraint.md`.

**Neither app may require the other to function.** Signalwatch without Arena
is a situational-awareness platform; Arena without Signalwatch is unchanged.
The connector is an integration, not a dependency.
