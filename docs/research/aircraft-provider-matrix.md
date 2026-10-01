# Aircraft provider admission matrix

Companion to `docs/research/aircraft-provider-admission.md`. Factual cells
only. Researched 2026-09-30. "Unresolved" means the provider has not answered
the question in its own documentation — it does not mean "probably fine".

| Provider | API surface | Authentication | Account required | Cost | Licence | Public display | Caching | Redistribution | Rate limits | Feeder required | Coverage | Signalwatch status | Conditions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **ADSB.lol** | Public `/v2/*`; radius query `/v2/lat/{lat}/lon/{lon}/dist/{radius}` capped at 250 nm. No public global snapshot. | None documented today | No | Free ("You can use the API for free") | ODbL v1.0 | Permitted; ODbL §4.3 notice required | Permitted; a normalised store may be a Derivative Database (§4.4 b) | Permitted, incl. commercial (§3.1); share-alike applies to Derivative Databases (§4.4), and §4.6 requires offering the derivative database or the alteration method free of charge | **Unresolved — none published** | Not today. Docs state a *future* API key "which you can get by feeding" | Community receiver network; uneven; ADS-B line-of-sight | **ADOPT WITH CONDITIONS** | 1) Contact operator re production use, as ToS requests 2) ODbL §4.3 notice in UI 3) No historical retention initially 4) Record future-key gate as continuity risk |
| **ADSB.lol feeder re-api / beast-MLAT** | Whole-network unfiltered | Feeder IP | Yes, by feeding | Hardware cost | ODbL | — | — | — | — | **Yes** | Whole network | **EXCLUDE** | Requires becoming a feeder (hardware/reciprocity) |
| **ADSB.lol `/data/traces`** | Path used by OSIRIS | — | — | — | — | — | — | — | — | — | — | **EXCLUDE** | Not present in official API documentation; undocumented surface |
| **ADSB.fi** | Public `/v2/*`, `/v3/lat/{lat}/lon/{lon}/dist/{dist}` capped at 250 NM. ADSBexchange-v2 compatible. No public global snapshot. | None for public endpoints | No | Free for the permitted use | **"Personal, non-commercial use only"** | Not granted for a distributed application | — | "You may not license, sell, rent, or lease any part of the data or the service" | **1 request/second** public; 1 per 30 s feeder; 4xx/429 count toward the limit; abuse → temporary IP restriction | Not required ("we kindly ask you to support adsb.fi by setting up a receiver") | 6500+ feeders claimed; community network | **EXCLUDE** | None — the restriction is dispositive |

## Notes

- **Neither provider exposes a public global snapshot.** Both cap the widest
  public query at 250 nm. A worldwide aircraft view would require tiled
  queries, which interacts directly with rate limits.
- **ADSB.fi's homepage and its terms disagree in effect.** The homepage says
  "open and unfiltered access to worldwide air traffic data"; the official
  `adsbfi/opendata` README says "personal, non-commercial use only". The
  written terms govern. This is the audit's clearest example of why marketing
  language is not a licence.
- **OSIRIS consumes `opendata.adsb.fi/api/v2`** despite that restriction,
  which is why OSIRIS's implementations are treated as leads, never as
  evidence of permission.
- Attribution differs in mechanism: ADSB.lol via ODbL §4.3 notice; ADSB.fi
  requires citing adsb.fi with a link to its home page.
