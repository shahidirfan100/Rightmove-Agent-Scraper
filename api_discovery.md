# API Discovery: Rightmove Agent Scraper

The actor resolves locations through Rightmove's typeahead service where needed and reads structured page state. Rightmove's current search pages use a React Router hydration stream; agent profile pages still expose `__NEXT_DATA__`.

## Sources Evaluated

### 1. Public page HTML

Search pages are server-rendered and serialize loader data through `window.__reactRouterContext.streamController.enqueue(...)`. The decoded `loaderData` contains search results, pagination metadata, and sidebar location links. Profile pages still include `__NEXT_DATA__` with branch profile details.

### 2. Rightmove typeahead API

Confirmed working endpoint:

```text
https://los.rightmove.co.uk/typeahead?query=LONDON&limit=10&exclude=STREET
```

This endpoint is used only to resolve user-supplied locations into Rightmove identifiers such as `REGION^87490`. It is not a full agent-results API.

### 3. Client-side bundles and network traffic

Rightmove bundles and browser traffic were checked for a richer public JSON endpoint for agent listings. No stable public endpoint was found that exposes the full estate-agent results beyond what is present in page state.

### 4. URLScan

URLScan discovery could not be relied on during this update because public submission required authentication at the time of testing.

## Selected Extraction Strategy

### Search pages

The actor reuses an Impit client and fetches the search page with same-origin `Origin` and `Referer` headers. It decodes the embedded React Router stream and reads:

```text
loaderData["routes/find/route"].results
```

Older search responses with `__NEXT_DATA__` remain supported.

From that object it extracts:

- `agentsData.agents`
- pagination fields such as `total`, `totalPages`, `indexLastAgent`
- sidebar region links for recursive expansion attempts on capped aggregate pages

### Profile pages

When `enrichProfiles` is enabled, the actor fetches each agent profile and reads:

```text
data.branchProfileResponse.agentProfileResponse
```

Important fields available there include:

- branch address and postcode
- sales and lettings telephones
- branch and company names
- branch summary and descriptions
- logo and map image URLs
- industry affiliations
- products info
- testimonials

## Header Strategy

The actor uses Impit's Chrome profile, lets Impit generate browser-consistent fingerprint headers, and supplies the current same-origin `Origin` and `Referer`. TLS verification stays enabled. The configured proxy URL, when present, is reused by the client.

## Live Request Checks (2026-09-25)

The same Manchester search URL was tested directly with Impit using no proxy. Each profile returned HTTP 200 and a decodable React Router stream with `agentsData.agents` and 453 total results:

| Impit profile | Response bytes | Result |
|---|---:|---|
| `chrome` | 258454 | 24 raw page entries; expected loader data |
| `firefox` | 258454 | 24 raw page entries; expected loader data |
| `ios18` | 258454 | 24 raw page entries; expected loader data |
| `okhttp4` | 257360 | 24 raw page entries; expected loader data |

No mobile or app-style profile returned more data or improved the response. The actor therefore remains on Impit's Chrome profile; `okhttp4` is only an Impit fingerprint, not a discovered Rightmove app API.

Rightmove's UI and direct requests confirmed pagination now uses `page=2`, `page=3`, etc. Page two reported positions 21-40 and page three 41-60. An `index=20` request repeated page one, so the old offset-based pagination was no longer valid.

A local actor smoke run with the failing Manchester search configuration pushed 100 unique agents over five pages. A one-agent enriched run also populated the branch address and company profile fields.

## Duplicate and Missing-Data Handling

- Search-page duplicates are merged before output when the same branch appears more than once in sales/lettings variants.
- Final dataset writes are deduped by `agentId`.
- Null and empty values are pruned from nested payloads.
- `branchAddress` is reliably populated only when `enrichProfiles` is enabled, because Rightmove does not consistently expose it on list pages.

Historical local test results from June 2026:

- enriched run: `20` records, `0` duplicates, `0` missing required fields
- large non-enriched London run: `2222` records, `0` duplicates, address omitted on list-only output as expected

These are historical results; the current verification above covers the Manchester route and current pagination format.

## Confirmed Limitation

The aggregate route:

```text
https://www.rightmove.co.uk/estate-agents/London.html
```

reports roughly `4563` total agents, but after about `1000` results the site repeats the last accessible page instead of exposing unique page 51+ data. Recursive expansion through `Within London` and `Within South London` links was implemented and tested, but those child pages did not reveal additional unique agents beyond the first accessible aggregate set.

As of testing on June 16, 2026, collecting the full `4563` from that aggregate route would require a different Rightmove data source than the currently exposed page-state route.
