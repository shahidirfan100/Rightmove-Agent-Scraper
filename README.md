# Rightmove Agent Scraper

Extract UK estate agent and letting agent data from Rightmove with ease. Collect branch names, profile URLs, phone numbers, brand details, and business descriptions at scale. Perfect for lead generation, market research, coverage analysis, and real estate data enrichment.

## Features

- **Location-based extraction** — Collect estate agent records from cities, areas, postcodes, or direct Rightmove result pages
- **Profile enrichment** — Gather deeper branch and company details for more complete agent records
- **Contact collection** — Capture main, sales, and lettings phone numbers when available
- **Branch intelligence** — Extract branch type, brand identity, summaries, and profile-level business information
- **Duplicate-safe output** — Write unique agent records only, even when listings overlap across result pages
- **Pagination handling** — Continue collecting until your target is reached or Rightmove stops exposing new results

## Use Cases

### Lead Generation
Build targeted estate agent and letting agent lists for outreach, partnerships, and business development. Collect direct contact details and branch information in a structured dataset ready for your workflow.

### Market Intelligence
Analyze agent density, local branch coverage, and brand presence across different UK locations. Use the data to understand which firms dominate specific regions or neighborhoods.

### Competitor Research
Track how agencies present themselves across Rightmove, including branch summaries, branding, and service focus. This is useful for benchmarking competitors and identifying positioning gaps.

### Data Enrichment
Enhance existing internal databases with profile URLs, phones, brand names, and descriptive business details. Enriched output is useful for CRM cleanup, directory building, and prospect validation.

### Area Coverage Analysis
Compare how many active branches appear in one town, city, or regional area versus another. This helps with territory planning, franchise research, and localized market expansion decisions.

---

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startUrl` | String | No | `https://www.rightmove.co.uk/estate-agents/find.html?radius=0.0&locationIdentifier=REGION%5E87490&brandName=&branchType=ALL` | Direct Rightmove estate agent search URL to scrape. |
| `searchLocation` | String | No | `"London"` | Location name to search when `startUrl` is not used. |
| `maxResults` | Integer | No | `20` | Maximum number of unique agents to collect. Leave empty to continue until results end. |
| `maxPages` | Integer | No | `1` | Maximum number of result pages to process. Leave empty to continue until pagination ends. |
| `enrichProfiles` | Boolean | No | `false` | Collect deeper branch and company details from individual agent pages. |
| `proxyConfiguration` | Object | No | `{ "useApifyProxy": false }` | Proxy settings for improved reliability on larger runs. |

---

## Output Data

Each item in the dataset contains:

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | String | Unique Rightmove agent or branch identifier. |
| `name` | String | Branch or display name shown in results. |
| `url` | String | Direct URL to the agent profile page. |
| `phone` | String | Best available primary contact number. |
| `phoneSales` | String | Sales phone number when available. |
| `phoneLettings` | String | Lettings phone number when available. |
| `logo` | String | Logo image URL for the branch or brand. |
| `branchType` | String | Branch focus such as `SALES`, `LETTINGS`, or `ALL`. |
| `brandName` | String | Brand name associated with the branch. |
| `branchSummary` | String | Short summary shown for the agent. |
| `description` | String | Agent description text when available. |
| `scrapedAt` | String | ISO timestamp for when the record was collected. |
| `branchAddress` | String | Branch address when profile enrichment is enabled and the source provides it. |
| `branchPostcode` | String | Branch postcode when available from the profile page. |
| `companyName` | String | Company name connected to the branch. |
| `companyTradingName` | String | Trading name used by the company. |
| `industryAffiliations` | Array | Memberships or affiliations listed on the profile. |
| `productsInfo` | Array | Additional service or product information when available. |
| `testimonials` | Array | Testimonials shown on the profile page when available. |

---

## Usage Examples

### Basic Location Search

Collect agents from a city using the built-in search location:

```json
{
  "searchLocation": "Manchester",
  "maxResults": 50
}
```

### Direct Search URL Extraction

Use a Rightmove search URL to keep the exact filters and location already applied on the site:

```json
{
  "startUrl": "https://www.rightmove.co.uk/estate-agents/find.html?radius=0.0&locationIdentifier=REGION%5E87490&brandName=&branchType=ALL",
  "maxResults": 200,
  "maxPages": 10
}
```

### Enriched Branch Profiles

Collect deeper business details for each agent profile:

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

---

## Sample Output

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
  "branchSummary": "1 Ability estate agents are an independent estate agency based in the heart of London Bridge SE1...",
  "description": "Independent letting and property services for landlords and tenants across London.",
  "branchAddress": "Unit 4, London Bridge, London",
  "branchPostcode": "SE1 2UP",
  "companyName": "1 Ability Estate Agents",
  "scrapedAt": "2026-06-16T10:06:30.161Z"
}
```

---

## Tips for Best Results

### Start With Small Test Runs

- Use `maxResults` between `20` and `50` first to confirm the location and output quality
- Check whether you need profile enrichment before starting larger production runs

### Use Direct Search URLs

- Paste a Rightmove result URL into `startUrl` when you want to preserve exact filters
- This is useful for radius-based searches or pre-filtered result pages

### Enable Enrichment When You Need Addresses

- Search-only runs are faster and lighter
- Turn on `enrichProfiles` when you need branch addresses, postcode details, and deeper company information

### Use Proxies for Larger Runs

- Larger runs are more reliable with proxy support enabled
- Residential proxies are recommended when you expect long result sets

### Proxy Configuration

Enable Apify Proxy in the input:

```json
{
  "searchLocation": "Birmingham",
  "maxResults": 500,
  "enrichProfiles": true,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

---

## Integrations

Connect your data with:

- **Google Sheets** — Export branch datasets for filtering, reporting, and sharing
- **Airtable** — Build searchable property-agent databases and outreach lists
- **Slack** — Send notifications when new runs complete
- **Webhooks** — Deliver fresh agent data to your own systems
- **Make** — Automate lead routing and enrichment workflows
- **Zapier** — Trigger downstream tasks after each dataset is ready

### Export Formats

- **JSON** — For structured data pipelines and custom apps
- **CSV** — For spreadsheets and quick analysis
- **Excel** — For reporting and business review
- **XML** — For legacy tools and data exchange

---

## Frequently Asked Questions

### How many agents can I collect?

There is no hard limit. You can collect as many unique agents as Rightmove exposes for the chosen search location. The final count depends on the location, filters, and how many distinct pages the site makes available.

### Can I use a direct Rightmove result page instead of a location name?

Yes. Paste the full Rightmove search URL into `startUrl` and the actor will scrape that result set directly without needing a location name.

### What is the difference between search-only and enriched runs?

Search-only runs are faster and collect the core listing data (name, phone, branch type, brand). Enriched runs also visit individual agent pages to gather deeper details like addresses, postcodes, descriptions, and company information.

### Why are some fields empty?

Empty fields mean the source page did not provide that data for a specific branch. Rightmove does not expose every detail for every agent, so some fields may be missing.

### Does the actor remove duplicates?

Yes. The actor writes unique records only, preventing repeated branches when result pages overlap or the search route shows the same agent more than once.

### Why can a location show a higher total than the final dataset?

Some Rightmove area pages show a large headline total but stop exposing new unique pages after a certain point. The actor continues until no new accessible records remain and reports that condition in the run output.

---

## Support

For issues or feature requests, contact support through the Apify Console.

### Resources

- [Apify Documentation](https://docs.apify.com/)
- [API Reference](https://docs.apify.com/api/v2)
- [Scheduling Runs](https://docs.apify.com/platform/schedules)

---

## Legal Notice

This actor is designed for legitimate data collection purposes. Users are responsible for ensuring compliance with website terms of service and applicable laws. Use data responsibly and respect rate limits.
