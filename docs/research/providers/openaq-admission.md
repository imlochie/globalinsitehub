# OpenAQ — air quality provider admission record

**Status: EXCLUDE for the Signalwatch distribution model.** Researched
2026-09-30 against Signalwatch `0ac7850`, under `source-admission-standard.md`.

This is not a cost rejection. OpenAQ's free tier may well be generous enough.
It is a **credential-model rejection**, and the reasoning generalises beyond
this provider.

---

## 1. The blocking finding

OpenAQ requires a registered API key, and binds it to an individual:

> "For programmatic access to data on the OpenAQ Platform … users must
> register for an API key and account."
>
> "Users must provide a valid name and valid email address during the
> registration process."
>
> "An individual is permitted to register for only one API key."
>
> "Unauthorized use of your API key, **including transfer to another user, is
> prohibited**."

— <https://docs.openaq.org/about/terms>, "Using the OpenAQ Platform"

### Why that collides with Signalwatch specifically

Signalwatch is **not** a hosted service that calls providers from one server
under one operator's credential. The desktop build **bundles the API server
inside the installer** and runs it on the end user's machine
(`artifacts/signalwatch-desktop`, Node sidecar on loopback).

So any OpenAQ key placed in Signalwatch's configuration would be:

1. shipped inside the Windows installer,
2. executed on every user's machine,
3. used by people who are not the registered individual.

That is transfer of the key to other users, which the terms prohibit outright.
There is no way to satisfy both "one key per individual, non-transferable" and
"the API ships to end users" at the same time.

**This is a new failure class.** Every previous credential question —
Transport for NSW, BarentsWatch, NASA FIRMS — was about *cost* and whether a
free account was permissible. This one is about *distribution*: the credential
is personal and the product is distributed.

### Generalised rule this produces

> A provider credential that is non-transferable, or bound to an individual,
> is incompatible with any Signalwatch package that bundles the API server.
> Such a provider can only ever be used by a hosted deployment where the
> credential stays with one operator — and a source that works in one package
> but not another is a coverage inconsistency, not a feature.

This should be checked for every future keyed provider, not just this one.

## 2. Secondary findings

Each would need resolving even if the credential model were compatible.

**A paid tier sits directly above the free limit.**

> "Anyone wishing to access OpenAQ Platform at rates higher than the
> documented rate limit must comply with the **payment terms** and API License
> and Services Agreement required by OpenAQ."

The standing invariant prohibits free tiers that become paid at real
workload. Whether Signalwatch's polling would stay under the documented limit
is **unresolved** — the numeric limit was not read in this pass.

**Continuous polling is in tension with the considerate-use clause.**

> "you agree not to … use an unreasonable amount of bandwidth and not leave
> requests running in perpetuity if data is no longer needed."

A monitoring map polls in perpetuity by design. That is not automatically a
violation, but it is the exact behaviour the clause names, and it would need
the operator's view.

**A competing-use clause exists.**

> "utilizing our official, hosted API implementation to develop products or
> services that substantially duplicate or directly compete with OpenAQ's core
> offerings is prohibited."

OpenAQ operates OpenAQ Explorer, a map-based air quality browser. Whether a
global monitoring platform with an air quality layer "substantially
duplicates" that is a judgement call belonging to OpenAQ, not to us.
**Unresolved.**

**Aggregator licence is not source licence.**

> "OpenAQ aggregates air quality data from government agencies and other
> sources… we provide no assurance that the data provided may be used free of
> any third-party claims… OpenAQ users must therefore review and comply with
> any terms published by data providers."

This is the WSDOT partner-camera hazard at much larger scale: hundreds of
upstream agencies, each with its own terms, and the aggregator explicitly
disclaims that its own availability implies permission. Attribution to OpenAQ
is required *and* to the original source where that source requires it.

## 3. What is not in dispute

- The data is genuinely public and the organisation is a non-profit acting in
  good faith; this record is not a criticism of OpenAQ.
- Self-hosting is explicitly permitted: "Users are permitted to run, modify,
  and self-host the open-source software components of our tooling, including
  the API codebase." That is a different and much larger undertaking than
  consuming an API, and it is not a Batch-scale migration.

## 4. Decision

**EXCLUDE** for the current Signalwatch distribution model.

Revisit only if one of these changes:

1. Signalwatch grows a hosted-only deployment where the credential never
   leaves one operator — and the coverage inconsistency between packages is
   accepted deliberately.
2. OpenAQ offers a credential model suitable for distributed applications.
3. Signalwatch self-hosts the open-source OpenAQ ingestion stack, which is a
   project in its own right, not a provider migration.

Recorded against the OSIRIS audit entry for `api/air-quality/route.ts`, which
previously read "RESEARCH — verify current key policy". The key policy has now
been verified, and it is the obstacle.
