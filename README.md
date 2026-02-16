# Rightmove Agent Scraper

Extract estate agent and letting agent data from Rightmove at scale. Collect branch contact details, addresses, brand/company information, and listing descriptions in structured format for analysis, research, and lead generation.

## Features

- **Agent and branch discovery** — Find agents by location, radius, brand name, and branch type
- **Profile enrichment** — Collect richer branch and company information from each agent page
- **Contact details** — Capture phone numbers and branch contact info when available
- **Business-ready output** — Export to JSON, CSV, Excel, XML, and more
- **Proxy support** — Improve reliability with built-in proxy configuration

## Use Cases

### Lead generation
Build targeted agent databases for outreach, partnerships, and marketing campaigns.

### Market research
Compare coverage, positioning, and branch information across locations and brands.

### Competitive intelligence
Track which agents operate in specific regions and how they present their services.

### Data analysis
Create structured datasets for BI dashboards, reporting, and internal tools.

## Input Parameters

| Parameter | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `startUrl` | String | No | — | Direct Rightmove “Find an agent” URL. If set, overrides the search parameters below. |
| `searchLocation` | String | No | `"London"` | Location name used to build the search URL when `startUrl` is not provided. |
| `locationIdentifier` | String | No | — | Location identifier (for example, a region identifier). Useful for stable searches. |
| `radius` | String | No | `"0.0"` | Search radius in miles (e.g., `"0.0"`, `"5.0"`, `"10.0"`). |
| `brandName` | String | No | `""` | Optional brand filter (leave empty for all agents). |
| `branchType` | String | No | `"ALL"` | Branch type filter: `"ALL"`, `"SALES"`, or `"LETTINGS"`. |
| `maxResults` | Integer | No | `20` | Maximum number of agents to collect. |
| `maxPages` | Integer | No | `1` | Maximum number of result pages to process. |
| `enrichProfiles` | Boolean | No | `false` | Collect additional details from each agent page (slower but richer). |
| `proxyConfiguration` | Object | No | `{ "useApifyProxy": true }` | Proxy settings for improved reliability. |

## Output Data

Each dataset item contains fields like:

| Field | Type | Description |
|------|------|-------------|
| `agentId` | String | Unique agent/branch identifier. |
| `name` | String | Agent/branch display name. |
| `url` | String | Agent page URL. |
| `branchType` | String | `SALES`, `LETTINGS`, or `ALL` (when both apply). |
| `phone` | String | Best available phone number based on your `branchType` filter. |
| `phoneSales` | String | Sales phone (when available). |
| `phoneLettings` | String | Lettings phone (when available). |
| `branchAddress` | String | Branch address (when available). |
| `branchPostcode` | String | Branch postcode (when available). |
| `companyName` | String | Company name (when available). |
| `logo` | String | Logo URL (when available). |
| `description` | String | Description text shown for the branch (when available). |
| `agentProfile` | Object | Full profile payload captured from the agent page (structure can vary). |
| `salesPropertiesSummary` | Object | Summary of sales listings (count + search path), when available. |
| `lettingsPropertiesSummary` | Object | Summary of lettings listings (count + search path), when available. |
| `scrapedAt` | String | ISO timestamp of when the item was collected. |

To keep datasets fast and lightweight, the Actor does not include full property card lists in the output.

## Usage Examples

### Basic run

```json
{
  "searchLocation": "London",
  "radius": "0.0",
  "branchType": "ALL",
  "maxResults": 20,
  "maxPages": 1,
  "proxyConfiguration": { "useApifyProxy": true }
}
```

### Filter by brand

```json
{
  "locationIdentifier": "REGION^87490",
  "brandName": "Foxtons",
  "radius": "10.0",
  "branchType": "ALL",
  "maxResults": 50,
  "maxPages": 3
}
```

### Lettings only

```json
{
  "searchLocation": "London",
  "radius": "5.0",
  "branchType": "LETTINGS",
  "maxResults": 100,
  "maxPages": 5
}
```

## Sample Output

```json
{
  "agentId": "26267",
  "name": "Abacus Estates, West Hampstead, London",
  "url": "https://www.rightmove.co.uk/estate-agents/agent/Abacus-Estates/West-Hampstead-London-26267.html",
  "branchType": "ALL",
  "phone": "020 3815 5777",
  "branchAddress": "303 West End Lane, West Hampstead, London, NW6 1RD",
  "branchPostcode": "NW6 1RD",
  "companyName": "Abacus Estates",
  "logo": "https://media.rightmove.co.uk/dir/company/clogo_10577_0006.jpeg",
  "scrapedAt": "2026-02-16T13:34:54.766Z"
}
```

## Tips for Best Results

### Start small
- Begin with `maxResults: 20` and `maxPages: 1` to validate your filters.

### Use stable identifiers
- Prefer `locationIdentifier` when you want repeatable, stable searches.

### Use proxies
- Residential proxies generally provide the best reliability for consistent extraction.

## Proxy Configuration

```json
{
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

## Integrations

- **Google Sheets** — Export and analyze agent lists
- **Airtable** — Build searchable directories
- **Webhooks** — Trigger downstream workflows on run completion
- **Make** — Automate enrichment, alerts, and reporting
- **Zapier** — Connect to CRM and marketing tools

## Frequently Asked Questions

### Why do some items have more fields than others?
Rightmove pages can expose different information depending on the agent and branch. This Actor captures the available data for each agent, and the `agentProfile` object may differ between branches.

### How many agents can I collect?
You can collect up to 500 agents per run using `maxResults`.

### What should I do if results are empty?
Try reducing filters, using a different radius, and enabling proxy configuration for better reliability.
