# Rijkswaterstaat road and waterway cameras — exclusion record

**Status: EXCLUDE for ingestion.** Re-verified 2026-10-01 against Signalwatch
`43105f2`, under `source-admission-standard.md`. Part of Camera Batch 2A.

---

## 1. Why this is not a licensing gap

Most rejected camera sources fail because their terms are *silent* — nobody
wrote down whether third-party display is allowed, so invariant 5 keeps them
unknown. Rijkswaterstaat is a different and stronger case: the operator states
the position directly.

From Rijkswaterstaat's own page *Wat doet Rijkswaterstaat met camerabeelden?*:

> "De doelen waarvoor we de beelden gebruiken, zijn uitsluitend voor
> Rijkswaterstaat zelf en niet voor gebruik door derden. We stellen de
> camerabeelden van rijks(vaar)wegen en terreinen (zoals onze gebouwen) daarom
> niet beschikbaar aan particulieren tenzij daar een wettelijke grondslag voor
> is."

> *"The purposes for which we use the images are exclusively for Rijkswaterstaat
> itself and not for use by third parties. We therefore do not make the camera
> images of national (water)ways and sites available to private parties unless
> there is a legal basis for it."*

And, on sharing:

> "De (persoons)gegevens die we verzamelen voor verkeerskundig onderzoek,
> worden niet gedeeld met derden."

The cameras exist for traffic management and incident management; the operator
describes roughly 3,000 of them. Release happens only on a legal basis, such as
a formal request by the Public Prosecution Service.

*Source (canonical, not the staging mirror):*
<https://www.rijkswaterstaat.nl/wegen/wegbeheer/onderzoek/verkeersonderzoek/wat-doet-rijkswaterstaat-met-camerabeelden>

## 2. Decision

**EXCLUDE for ingestion.** This is not blocked on further research. The
operator has stated that the imagery is not made available to third parties,
so there is nothing to clarify and no architecture that makes ingestion
compliant. Technical reachability of any image endpoint is irrelevant here —
invariant 1 exactly.

Recorded explicitly so a future pass does not reopen it as an unanswered
question.

## 3. Reference-provider candidacy: deferred, not refused

Rijkswaterstaat remains useful as a destination rather than a source. The one
place it publishes camera stills publicly is its own channel: the page notes
that screenshots of camera images are regularly shared via the
*Rijkswaterstaat Verkeersinformatie* account on X. That is the operator
publishing on its own surface, which is not a grant to anyone else, but it does
confirm the shape of the relationship Signalwatch should have with it —
**link out, do not ingest.**

Registering it is deferred for one concrete reason: **the reference-provider
architecture does not exist in the codebase yet.** There is no reference or
embedded-reference provider kind; the camera model's `external-viewer` is a
*per-camera* capability that needs a provider-owned viewing page per camera,
and Rijkswaterstaat publishes no licensed per-camera catalogue that Signalwatch
may use. Forcing it into `external-viewer` today would require inventing a
camera list, which is the failure mode this whole standard exists to prevent.

So the correct state is:

```
ingestion            EXCLUDE        settled, on operator's own statement
reference provider   CANDIDATE      blocked on the reference architecture,
                                    not on provider evidence
```

When the reference-provider kind is built, the clear provider URL to register
is the Rijkswaterstaat traffic information surface:
<https://www.rijkswaterstaat.nl/wegen/verkeersinformatie-en-werkzaamheden>

## 4. Verification honesty

No request was made to any Rijkswaterstaat camera endpoint, and none would be
appropriate. Outbound TLS from this workspace to arbitrary provider hosts is
blocked in any case. The finding above rests entirely on Rijkswaterstaat's own
published page.
