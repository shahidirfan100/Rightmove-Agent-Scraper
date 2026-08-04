## What does Rightmove Agent Scraper do?

Rightmove Agent Scraper collects structured UK estate agent and letting agent data from Rightmove. Enter a Rightmove agent search URL or provide a location such as London, Manchester, or Birmingham, then receive branch names, profile URLs, phone numbers, brand information, and business descriptions in an Apify dataset.

Use the Actor to build real estate lead lists, research local agency coverage, compare brands across UK areas, enrich an existing CRM, or create repeatable property-market data workflows. Enable profile enrichment when you also need branch addresses, postcodes, company details, service information, and testimonials published on agent profiles.

## Why use Rightmove Agent Scraper?

- **Estate agent lead generation** - Find agencies by location and collect available contact numbers, profile links, branch types, and brand names for prospecting or partnerships.
- **Local market research** - Compare the number and type of branches visible across cities, towns, postcodes, and other Rightmove search areas.
- **Agency coverage analysis** - Identify which brands operate in a target area and review their published descriptions, services, and branch information.
- **CRM and directory enrichment** - Add Rightmove profile links, telephone numbers, company names, addresses, and postcodes to an existing business dataset.
- **Repeatable monitoring** - Schedule runs in Apify to refresh agency records and compare changes over time.
- **Automation-ready exports** - Download data as JSON, CSV, Excel, or XML, or connect the dataset to an API, webhook, spreadsheet, or automation platform.

## What data can you extract from Rightmove?

The Actor returns one record per unique Rightmove agent or branch. Search results provide the core fields, while profile enrichment adds deeper branch and company information when it is published by Rightmove.

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | String | Unique Rightmove agent or branch identifier. |
| `name` | String | Branch or display name shown in the search results. |
| `url` | String | Direct Rightmove profile URL. |
| `phone` | String | Best available primary contact number. |
| `phoneSales` | String | Sales telephone number when available. |
| `phoneLettings` | String | Lettings telephone number when available. |
| `logo` | String | Branch or brand logo URL when available. |
| `branchType` | String | Branch focus such as `SALES`, `LETTINGS`, or `ALL`. |
| `brandName` | String | Brand associated with the branch. |
| `branchSummary` | String | Short branch summary from the profile or search result. |
| `description` | String | Published agency description when available. |
| `micrositeHomeLink` | String | Agency microsite home URL when available. |
| `micrositeTabLinks` | Array | Additional agency profile links when available. |
| `scrapedAt` | String | ISO timestamp for the collected record. |
| `branchAddress` | String | Branch address, available with profile enrichment when published. |
| `branchPostcode` | String | Branch postcode when available. |
| `companyName` | String | Company name connected with the branch. |
| `companyTradingName` | String | Company trading name when available. |
| `companyTypeAlias` | String | Company type label when published. |
| `branchMainTelephone` | String | Main telephone number from the branch profile. |
| `branchLettingsTelephone` | String | Lettings telephone number from the branch profile. |
| `branchProfileUrl` | String | Profile URL returned from the branch details. |
| `branchStaticMapImageUrl` | String | Static map image URL when available. |
| `industryAffiliations` | Array | Industry memberships or affiliations published on the profile. |
| `productsInfo` | Array | Services or products listed on the profile. |
| `testimonials` | Array | Testimonials published on the profile. |
| `hasSales` | Boolean | Whether the profile indicates sales services. |
| `hasLettings` | Boolean | Whether the profile indicates lettings services. |
| `hasCommercial` | Boolean | Whether the profile indicates commercial services. |
| `hasDevelopment` | Boolean | Whether the profile indicates development services. |

Fields that Rightmove does not publish for a particular branch are omitted from that dataset item.

## How to use Rightmove Agent Scraper

1. Open the Actor in Apify Console.
2. Enter a Rightmove estate agent search URL, or provide a location in `searchLocation`.
3. Set `maxResults` and `maxPages` for a test run or larger collection.
4. Turn on `enrichProfiles` if you need addresses, company details, services, or testimonials.
5. Run the Actor and review the dataset preview.
6. Export the results or connect the dataset to your workflow.

The Actor keeps unique branches when results overlap across pages. A direct Rightmove search URL is useful when you want to preserve filters already selected on the site.

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startUrl` | String | No | London Rightmove agent search URL | Full Rightmove estate agent search URL. Leave empty to use `searchLocation`. |
| `searchLocation` | String | No | `London` | Location name used to find estate agents, such as `Manchester` or `Birmingham`. |
| `maxResults` | Integer | No | `20` | Maximum number of unique agent records to collect. |
| `maxPages` | Integer | No | `1` | Maximum number of result pages to process. |
| `enrichProfiles` | Boolean | No | `false` | Collect additional branch and company details from individual profiles. |
| `proxyConfiguration` | Object | No | `{ "useApifyProxy": false }` | Optional Apify Proxy configuration for larger or longer runs. |

## Output Data

Each dataset item represents one unique branch. Search-only runs usually contain the core search fields. Enriched runs can include branch, company, service, and profile fields when those details are available.

| Output group | Fields |
|--------------|--------|
| Identity | `agentId`, `name`, `url`, `branchProfileUrl` |
| Contact | `phone`, `phoneSales`, `phoneLettings`, `branchMainTelephone`, `branchLettingsTelephone` |
| Agency details | `brandName`, `branchType`, `branchSummary`, `description`, `companyName`, `companyTradingName`, `companyTypeAlias` |
| Location | `branchAddress`, `branchPostcode`, `branchStaticMapImageUrl` |
| Services and profile content | `hasSales`, `hasLettings`, `hasCommercial`, `hasDevelopment`, `industryAffiliations`, `productsInfo`, `testimonials` |
| Links and media | `logo`, `micrositeHomeLink`, `micrositeTabLinks` |
| Record metadata | `scrapedAt` |

## Usage Examples

### Basic Location Search

Collect up to 50 unique estate agents from Manchester using the built-in location search:

```json
{
  "searchLocation": "Manchester",
  "maxResults": 50
}
```

### Direct Rightmove Search URL

Use a complete Rightmove search URL when you want to preserve the location and filters from an existing agent search:

```json
{
  "startUrl": "https://www.rightmove.co.uk/estate-agents/find.html?radius=0.0&locationIdentifier=REGION%5E87490&brandName=&branchType=ALL",
  "maxResults": 200,
  "maxPages": 10
}
```

### Enriched Agent Profiles

Collect a smaller set of London branches with additional profile and company information:

```json
{
  "searchLocation": "London",
  "maxResults": 25,
  "enrichProfiles": true,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

## Sample Output

The following example shows a typical enriched record. Some fields may be absent when the source profile does not publish them.

```json
{
  "agentId": "181787",
  "name": "1 Ability Estate Agents, London",
  "url": "https://www.rightmove.co.uk/estate-agents/agent/1-Ability-Estate-Agents/London-181787.html",
  "phone": "020 3903 2323",
  "phoneLettings": "020 3903 2323",
  "logo": "https://media.rightmove.co.uk/partner-logo/19103090-LOGO-1765975389.png",
  "branchType": "LETTINGS",
  "brandName": "1 Ability Estate Agents",
  "branchSummary": "Independent estate agency based in the heart of London Bridge.",
  "description": "Independent letting and property services for landlords and tenants across London.",
  "branchAddress": "Unit 4, London Bridge, London",
  "branchPostcode": "SE1 2UP",
  "companyName": "1 Ability Estate Agents",
  "hasLettings": true,
  "hasSales": false,
  "scrapedAt": "2026-06-16T10:06:30.161Z"
}
```

## Tips for Best Results

- Start with `maxResults` between `20` and `50` so you can check the location and fields before a larger run.
- Use `startUrl` when you need the exact Rightmove search area or filters already selected on the site.
- Keep `enrichProfiles` disabled for a faster branch directory, and enable it when addresses or company information matter.
- Use a realistic `maxPages` value for the target area. The number of accessible results depends on Rightmove pagination and the selected search.
- Enable Apify Proxy for larger runs when your collection requires additional request reliability.
- Review the dataset preview because some agents publish phone numbers, addresses, or descriptions while others do not.
- Schedule repeat runs when you need to monitor agency coverage or refresh contact data.

## Integrations and Export Formats

- **Google Sheets** - Export branch records for filtering, review, and team sharing.
- **Airtable** - Build searchable agency directories and outreach lists.
- **Webhooks** - Send a notification or dataset reference after a run finishes.
- **Make or Zapier** - Route new records into CRM, email, or enrichment workflows.
- **Apify API** - Read datasets and start runs from your own application.
- **JSON, CSV, Excel, and XML** - Download results for data pipelines, reporting, or analysis.

## Frequently Asked Questions

### How many agents can I collect in one run?

You can request any positive `maxResults` value, subject to the number of unique branches that Rightmove exposes for the selected search. Use `maxPages` to control how many result pages are processed.

### Can I use a direct Rightmove result page?

Yes. Put the full agent search URL in `startUrl` to preserve its location and filters. You can leave `searchLocation` empty when using a direct URL.

### What is the difference between a standard and enriched run?

A standard run collects search-level identity, contact, branch, brand, and description fields. An enriched run also checks individual agent profiles for addresses, postcodes, company details, services, affiliations, and testimonials.

### Why are some output fields missing?

Fields are missing when Rightmove does not publish the corresponding information for that branch or profile. This is normal for phone numbers, addresses, descriptions, and optional profile content.

### Does the Actor remove duplicate branches?

Yes. The dataset keeps one record per unique Rightmove agent or branch, including when pages overlap during pagination.

### Can I export Rightmove agent data to CSV or Excel?

Yes. Apify dataset results can be downloaded as CSV, Excel, JSON, XML, and other supported formats, or consumed through the Apify API.

### Can I schedule recurring runs?

Yes. Use Apify schedules to run the Actor hourly, daily, weekly, or on a custom interval, then compare refreshed datasets for changes.

### Is collecting Rightmove data legal?

Public data collection may be subject to laws, privacy requirements, and Rightmove's terms. You are responsible for using the Actor lawfully, respecting access limits, and handling contact information appropriately.

## Related Actors

- [Rightmove Property Scraper](https://apify.com/shahidirfan/rightmove-property-scraper) - Collect UK property listings, prices, property details, and agent information from Rightmove.
- [Propertyfinder Scraper](https://apify.com/shahidirfan/propertyfinder-scraper) - Collect UAE property listings, prices, locations, amenities, and agent details from PropertyFinder.ae.
- [iProperty Scraper](https://apify.com/shahidirfan/iproperty-scraper) - Collect Malaysian property listings, prices, locations, and agent details from iProperty.

## Support

For issues, feature requests, or missing fields, use the Issues tab on the Actor page or contact the developer through Apify. Include the input used, the affected search URL or location, and an example of the output that needs attention.

## Legal Notice

This Actor is intended for legitimate collection of publicly available Rightmove data. Users are responsible for complying with applicable laws, privacy obligations, Rightmove's terms, and any restrictions that apply to their use of collected agent information.
