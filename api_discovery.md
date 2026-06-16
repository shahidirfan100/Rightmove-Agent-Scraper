# API Discovery: Rightmove Agent Scraper

This actor no longer depends on brittle HTML selectors for its primary extraction. It resolves search targets through Rightmove's own location service where possible, then reads structured Next.js state from the response payload.

## Sources Evaluated

### 1. Public page HTML

The search and profile pages are server-rendered and include a populated `__NEXT_DATA__` script. That state contains:

- search results
- pagination metadata
- sidebar location links
- profile details for agent pages

This is the actor's main extraction source.

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

The actor fetches the search page with `gotScraping` and browser-like same-origin headers, then reads:

```text
props.pageProps.data.results
```

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

Requests keep `got-scraping` header generation enabled and add browser-like same-origin values on top, including:

- `Origin: https://www.rightmove.co.uk`
- `Referer` set to the current Rightmove page
- document-style `Accept`
- `Sec-Fetch-*`
- `Upgrade-Insecure-Requests`
- cache-control headers

This keeps the request profile close to a normal in-site navigation without replacing `got-scraping`'s dynamic header generation.

## Duplicate and Missing-Data Handling

- Search-page duplicates are merged before output when the same branch appears more than once in sales/lettings variants.
- Final dataset writes are deduped by `agentId`.
- Null and empty values are pruned from nested payloads.
- `branchAddress` is reliably populated only when `enrichProfiles` is enabled, because Rightmove does not consistently expose it on list pages.

Validation from local test runs:

- enriched run: `20` records, `0` duplicates, `0` missing required fields
- large non-enriched London run: `2222` records, `0` duplicates, address omitted on list-only output as expected

## Confirmed Limitation

The aggregate route:

```text
https://www.rightmove.co.uk/estate-agents/London.html
```

reports roughly `4563` total agents, but after about `1000` results the site repeats the last accessible page instead of exposing unique page 51+ data. Recursive expansion through `Within London` and `Within South London` links was implemented and tested, but those child pages did not reveal additional unique agents beyond the first accessible aggregate set.

As of testing on June 16, 2026, collecting the full `4563` from that aggregate route would require a different Rightmove data source than the currently exposed page-state route.
