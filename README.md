# Rightmove Agent Scraper

Collect estate-agent and letting-agent data from Rightmove with structured output that is usable for lead generation, market research, and branch discovery.

## What It Extracts

- agent and branch names
- profile URLs
- main, sales, and lettings phone numbers when available
- brand and logo information
- branch summaries and descriptions
- profile-level branch address and postcode when `enrichProfiles` is enabled
- company and branch metadata from profile pages

## How It Works

The actor resolves locations with Rightmove's own typeahead service when needed, fetches search pages with browser-like same-origin headers, and extracts structured data from the embedded page state instead of relying on fragile visual selectors.

When profile enrichment is enabled, it visits each branch profile and merges the richer profile payload into the output record.

## Input

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `startUrl` | String | No | `null` | Direct Rightmove estate-agent URL to scrape. |
| `searchLocation` | String | No | `null` | Human-readable location such as `London` or `Manchester`. |
| `locationIdentifier` | String | No | `null` | Explicit Rightmove location identifier such as `REGION^87490`. |
| `radius` | String | No | `0.0` | Search radius passed to Rightmove's `find.html` route. |
| `brandName` | String | No | `""` | Optional brand filter for `find.html` searches. |
| `branchType` | String | No | `ALL` | `ALL`, `SALES`, or `LETTINGS`. |
| `maxResults` | Integer | No | `null` | User-priority target for the number of unique agents to collect. |
| `maxPages` | Integer | No | `null` | User-priority cap for processed result pages. |
| `enrichProfiles` | Boolean | No | `false` | Fetch profile pages to add address and deeper branch/company data. |
| `proxyConfiguration` | Object | No | `null` | Optional Apify proxy configuration. |

## Output

Core fields:

- `agentId`
- `name`
- `url`
- `phone`
- `phoneSales`
- `phoneLettings`
- `logo`
- `branchType`
- `brandName`
- `branchSummary`
- `description`
- `scrapedAt`

Additional fields when profile enrichment is enabled:

- `branchAddress`
- `branchPostcode`
- `branchDisplayName`
- `branchName`
- `brandTradingName`
- `branchMainTelephone`
- `branchLettingsTelephone`
- `branchLogoUrl`
- `fullBranchLogoUrl`
- `brandLogoUrl`
- `branchStaticMapImageUrl`
- `companyId`
- `companyName`
- `companyTradingName`
- `companyTypeAlias`
- `branchSummaryProfile`
- `branchDescription`
- `primaryDescription`
- `lettingsPrimaryDescription`
- `branchProfileUrl`
- `lettingsSearchUrl`
- `industryAffiliations`
- `productsInfo`
- `testimonials`
- `agentProfile`

## Example Input

Basic location search:

```json
{
  "searchLocation": "Manchester",
  "maxResults": 100
}
```

Direct aggregate page:

```json
{
  "startUrl": "https://www.rightmove.co.uk/estate-agents/London.html",
  "maxResults": 5000,
  "maxPages": 500
}
```

Profile enrichment:

```json
{
  "searchLocation": "London",
  "maxResults": 50,
  "enrichProfiles": true,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

## Notes

- User input takes priority over internal defaults for `maxResults` and `maxPages`.
- Records are deduped by `agentId` before they are written to the dataset.
- Search-only runs are faster, but Rightmove often omits branch address data on listing pages, so address completeness is best when `enrichProfiles` is enabled.
- Some aggregate routes on Rightmove report totals that exceed the unique pages the site actually exposes. When Rightmove starts repeating the last accessible page, the actor stops and reports that condition in `OUTPUT`.

## Validation Snapshot

Local validation after the API/state update:

- enriched validation run: `20` records, `0` duplicates, `0` missing core fields
- large `find.html` London run: `2222` unique records, `0` duplicates
- aggregate `London.html` run: site reported `4563`, but only `1000` unique accessible records were exposed before pagination repeated
