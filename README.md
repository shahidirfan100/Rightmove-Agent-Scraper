# Rightmove Agent Scraper

Extract comprehensive estate agent and letting agent data from Rightmove with ease. Collect branch contact details, addresses, brand information, and professional descriptions at scale. Perfect for real estate lead generation, market research, and competitive analysis.

---

## Features

- **Agent and branch discovery** — Find professional agents across any UK location or postcode
- **Profile enrichment** — Collect deep branch and company information from individual agent pages
- **Contact details** — Capture verified phone numbers and branch addresses for direct outreach
- **Structured branding** — Extract agent logos, brand names, and company descriptions automatically
- **High-speed extraction** — Optimized data collection using structural page state for maximum reliability

---

## Use Cases

### Lead Generation
Build high-quality agent databases for outreach, strategic partnerships, and marketing campaigns.

### Market Intelligence
Compare coverage, brand positioning, and branch density across different UK regions.

### Competitive Analysis
Track competitor activity in specific locations and understand how they present their services to the market.

### Data Enrichment
Enhance existing business directories with up-to-date branch details, logos, and contact information.

---

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startUrl` | String | No | — | Direct Rightmove search URL to start scraping from. |
| `searchLocation` | String | No | `"London"` | Location name to search for estate agents. |
| `maxResults` | Integer | No | `20` | Maximum number of agents to collect (up to 500). |
| `maxPages` | Integer | No | `1` | Maximum number of result pages to process. |
| `enrichProfiles` | Boolean | No | `false` | Enable to collect deeper details from individual profile pages. |
| `proxyConfiguration` | Object | No | `{ "useApifyProxy": false }` | Proxy settings for improved reliability. |

---

## Output Data

Each item in the dataset contains structured information:

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | String | Unique identifier for the agent branch. |
| `name` | String | Display name of the agent or branch. |
| `url` | String | Direct URL to the agent's profile. |
| `phone` | String | Primary contact telephone number. |
| `logo` | String | Verified URL to the agent or brand logo. |
| `branchAddress` | String | Physical address of the branch location. |
| `branchType` | String | Operation type (SALES, LETTINGS, or ALL). |
| `description` | String | Professional summary or branch description. |
| `scrapedAt` | String | ISO timestamp of the data collection. |

---

## Usage Examples

### Basic Location Search

Extract agents in a specific city with default settings:

```json
{
  "searchLocation": "Manchester",
  "maxResults": 50
}
```

### Direct URL Extraction

Use a specific Rightmove search URL to target precise results:

```json
{
  "startUrl": "https://www.rightmove.co.uk/estate-agents/find.html?locationIdentifier=REGION%5E87490&branchType=ALL",
  "maxResults": 100,
  "maxPages": 5
}
```

### Deep Profile Enrichment

Collect detailed descriptions and additional metadata from every agent page:

```json
{
  "searchLocation": "London",
  "enrichProfiles": true,
  "maxResults": 20,
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
  "logo": "https://media.rightmove.co.uk/partner-logo/19103090-LOGO-1765975389.png",
  "branchType": "LETTINGS",
  "brandName": "1 Ability Estate Agents",
  "branchSummary": "1 Ability estate agents are an independent estate agency based in the heart of London Bridge SE1...",
  "scrapedAt": "2026-05-06T13:32:13.999Z"
}
```

---

## Tips for Best Results

### Start with Small Runs
- Use `maxResults: 20` to verify your search location produces the expected results.
- Test with `enrichProfiles: false` first to check the speed and data density.

### Optimize Reliability
- Use residential proxies for larger crawls to ensure consistent data extraction.
- Provide a specific `startUrl` from Rightmove to apply advanced filters like radius or price range.

### Performance Tuning
- Disable `enrichProfiles` if you only need names and phone numbers to significantly increase speed.

---

## Integrations

Connect your estate agent data with:

- **Google Sheets** — Export directly for analysis and reporting
- **Airtable** — Build searchable agent directories and CRMs
- **Slack** — Get real-time notifications for new data runs
- **Webhooks** — Send data to your custom endpoints and APIs
- **Make / Zapier** — Automate outreach and lead nurturing workflows

### Export Formats

- **JSON** — For developers and system integrations
- **CSV / Excel** — For spreadsheet analysis and manual review
- **XML / RSS** — For legacy system compatibility

---

## Frequently Asked Questions

### Can I filter by radius or brand?
Yes, simply perform the search on Rightmove with your desired filters and paste the resulting URL into the `startUrl` field.

### How many agents can I collect?
The Actor supports collecting up to 500 agents per run, but results are limited by what is available on Rightmove for the given location.

### Does it work with residential postcodes?
Yes, you can enter postcodes into the `searchLocation` field just like city names.

### Is the data collected in real-time?
Yes, the scraper fetches the most current data available on Rightmove at the moment of the run.

---

## Support

For issues or feature requests, contact support through the Apify Console.

### Resources

- [Apify Documentation](https://docs.apify.com/)
- [API Reference](https://docs.apify.com/api/v2)
- [Scheduling Runs](https://docs.apify.com/schedules)

---

## Legal Notice

This Actor is designed for legitimate data collection purposes. Users are responsible for ensuring compliance with website terms of service and applicable laws. Use data responsibly and respect rate limits.
