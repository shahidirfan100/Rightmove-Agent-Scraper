# Rightmove Agent Scraper

Extract comprehensive estate agent data from Rightmove, the UK's largest property portal. Scrape estate agents, letting agents, contact details, office addresses, property counts, and extensive agent information with this powerful automation tool.

## What does the Rightmove Agent Scraper do?

This advanced agent scraper extracts detailed estate agent information from Rightmove.co.uk, providing access to thousands of UK estate agents and letting agents. The scraper collects complete agent profiles, contact information, office locations, property statistics, team details, and services offered.

### Key capabilities

- **Comprehensive Data Collection** - Extract agent listings with names, phones, emails, addresses, and full profiles
- **Multiple Search Options** - Search by location, region, radius, branch type (sales/lettings), and brand name
- **Detailed Agent Information** - Collect full descriptions, contact details, property counts, team members, and services
- **Smart Data Extraction** - Combines JSON-LD parsing and HTML scraping for maximum data quality
- **Flexible Filtering** - Filter agents by location, brand name, and branch type
- **Pagination Support** - Automatically handles multiple pages of search results
- **Contact Information** - Extract phone numbers, emails, websites, and office addresses
- **Property Statistics** - Get counts of properties for sale and to let by each agent
- **Team Details** - Extract information about agent team members

## Why use this Rightmove Agent Scraper?

- ✅ **Production Ready** - Battle-tested and optimized for reliability
- ✅ **Fast & Efficient** - Concurrent processing with intelligent rate limiting
- ✅ **High-Quality Data** - Structured JSON output with comprehensive agent information
- ✅ **Easy to Use** - Simple configuration with sensible defaults
- ✅ **Cost Effective** - Optimized to minimize compute units and proxy usage
- ✅ **Regularly Maintained** - Updated to adapt to website changes

## Use cases

### Real Estate Research
- Market analysis and competitor research
- Agent coverage mapping
- Service comparison across regions
- Industry trend analysis

### Lead Generation
- Build targeted estate agent databases
- Identify potential partners or clients
- Create marketing contact lists
- Find agents for specific areas

### Business Intelligence
- Competitor monitoring
- Market entry research
- Service gap identification
- Regional market analysis

### Data & Research
- Academic research on real estate industry
- Agent market analysis
- Service offering trends
- Geographic coverage studies

## Input Configuration

Configure the scraper using these parameters to customize your agent extraction:

### Search Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| **searchLocation** | String | Location to search (e.g., "London", "Manchester", "Birmingham") | "London" |
| **locationIdentifier** | String | Rightmove location identifier (e.g., "REGION^87490" for London) | - |
| **startUrl** | String | Direct Rightmove agent search URL (overrides other search parameters) | - |
| **radius** | String | Search radius from location: "0.0" to "40.0" miles | "0.0" |
| **brandName** | String | Filter by specific agent brand name (leave empty for all) | "" |
| **branchType** | String | Type of branches: "ALL", "SALES", or "LETTINGS" | "ALL" |

### Scraper Control Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| **collectAgentDetails** | Boolean | Visit each agent profile for complete information (slower but comprehensive) | true |
| **maxResults** | Integer | Maximum number of agents to collect (1-1000) | 50 |
| **maxPages** | Integer | Maximum number of result pages to process | 5 |
| **proxyConfiguration** | Object | Proxy settings - residential proxies recommended | `{useApifyProxy: true}` |

## Example Input

```json
{
  "searchLocation": "London",
  "locationIdentifier": "REGION^87490",
  "radius": "5.0",
  "brandName": "",
  "branchType": "ALL",
  "collectAgentDetails": true,
  "maxResults": 100,
  "maxPages": 10,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

## Output Format

The scraper provides structured JSON data for each estate agent:

### Basic Agent Data

```json
{
  "agentId": "123456",
  "name": "ABC Estate Agents, London",
  "url": "https://www.rightmove.co.uk/estate-agents/agent/ABC-Estate-Agents.html",
  "phone": "020 1234 5678",
  "logo": "https://media.rightmove.co.uk/dir/crop/10:9-16:9/193k/192272/logo.png",
  "branchType": "SALES",
  "description": "Leading estate agents in central London...",
  "address": "123 High Street, London, SW1A 1AA",
  "scrapedAt": "2025-12-23T12:34:56.789Z"
}
```

### Detailed Agent Data (when collectAgentDetails=true)

```json
{
  "agentId": "123456",
  "name": "ABC Estate Agents, London",
  "url": "https://www.rightmove.co.uk/estate-agents/agent/ABC-Estate-Agents.html",
  "phone": "020 1234 5678",
  "email": "info@abcestateagents.co.uk",
  "website": "https://www.abcestateagents.co.uk",
  "address": "123 High Street, London, SW1A 1AA",
  "branchType": "SALES",
  "description": "ABC Estate Agents has been serving central London for over 20 years...",
  "logo": "https://media.rightmove.co.uk/dir/crop/10:9-16:9/193k/192272/logo.png",
  "propertiesForSale": 45,
  "propertiesToLet": 12,
  "teamMembers": 8,
  "servicesOffered": ["Sales", "Lettings", "Mortgages", "Valuation"],
  "extractionMethod": "json-ld",
  "scrapedAt": "2025-12-23T12:34:56.789Z"
}
```

## Dataset Fields

### Core Fields

| Field | Type | Description |
|-------|------|-------------|
| **agentId** | String | Unique Rightmove agent identifier |
| **name** | String | Agent/branch name |
| **url** | String | Direct link to agent profile |
| **phone** | String | Contact phone number |
| **logo** | String | Agent logo image URL |
| **branchType** | String | Branch type (SALES, LETTINGS, or ALL) |
| **address** | String | Office address |
| **description** | String | Agent description/about text |

### Detailed Fields (when collectAgentDetails=true)

| Field | Type | Description |
|-------|------|-------------|
| **email** | String | Contact email address |
| **website** | String | Agent website URL |
| **propertiesForSale** | Integer | Number of properties currently for sale |
| **propertiesToLet** | Integer | Number of properties currently to let |
| **teamMembers** | Integer | Number of team members |
| **servicesOffered** | Array | List of services offered |
| **extractionMethod** | String | Data extraction method used (json-ld, html-parse, or basic-card) |
| **scrapedAt** | String | ISO timestamp of data extraction |

## How to scrape Rightmove agents

### Step 1: Set up the Actor

1. Create a free Apify account
2. Find "Rightmove Agent Scraper" in the Apify Store
3. Click "Try for free"

### Step 2: Configure your search

Enter your search parameters:
- **Location**: Enter the area you want to search (e.g., "London", "Manchester")
- **Branch Type**: Select ALL, SALES only, or LETTINGS only
- **Brand Name**: Optionally filter by specific agent brand
- **Radius**: Choose search radius from location

### Step 3: Run the scraper

Click "Start" to begin extracting agent data. The scraper will:
- Search Rightmove with your criteria
- Extract agent cards from search results
- Optionally visit each agent profile for detailed information
- Handle pagination automatically
- Save all data to the dataset

### Step 4: Download your data

Export your agent data in multiple formats:
- **JSON** - For programmatic use and API integration
- **CSV** - For Excel and spreadsheet analysis
- **Excel** - For direct use in Microsoft Excel
- **HTML** - For viewing in web browsers
- **XML** - For data interchange

## Performance & Cost

### Speed
- **Basic mode** (collectAgentDetails=false): ~100-150 agents per minute
- **Detailed mode** (collectAgentDetails=true): ~30-50 agents per minute

### Cost Optimization
- Use specific filters to reduce unnecessary results
- Set appropriate maxResults limit
- Use basic mode when detailed information isn't needed
- Monitor and adjust concurrency settings

### Compute Units
- Approximately 0.01-0.02 compute units per agent (basic mode)
- Approximately 0.03-0.05 compute units per agent (detailed mode)

## Best Practices

### Search Strategy
- Start with specific locations and criteria
- Use radius filtering to focus on target areas
- Set realistic maxResults based on your needs
- Use branch type filter to narrow results

### Data Quality
- Enable collectAgentDetails for comprehensive information
- Use residential proxies to avoid blocking
- Run during off-peak hours for better performance
- Validate extracted data for completeness

### Rate Limiting
- The scraper includes built-in delays between requests
- Proxy rotation helps avoid rate limiting
- Adjust maxConcurrency based on proxy quality
- Monitor for blocking and adjust settings if needed

## Limitations

- Respects Rightmove's robots.txt and terms of service
- Rate limiting applied to prevent server overload
- Some agents may have restricted access
- Detailed data extraction increases runtime
- Requires residential proxies for reliable operation

## Troubleshooting

### No agents found
- Verify your search location is correct
- Check if filters are too restrictive
- Ensure the location has estate agents
- Try a different radius setting

### Missing data fields
- Enable collectAgentDetails for complete information
- Some agents may not have all fields
- Check if proxies are working correctly
- Verify the agent profile page is accessible

### Slow performance
- Reduce maxResults or maxPages
- Decrease concurrency settings
- Use faster proxies
- Disable collectAgentDetails for faster extraction

### Proxy issues
- Use residential proxies instead of datacenter
- Ensure Apify proxy is enabled
- Check proxy configuration
- Try rotating proxy regions

## Integration & API

### Apify API
Access your scraped data via Apify API:

```javascript
// Get dataset items
const client = new ApifyClient({
    token: 'YOUR_API_TOKEN'
});

const run = await client.actor('YOUR_ACTOR_ID').call(inputConfig);
const dataset = await client.dataset(run.defaultDatasetId).listItems();
```

### Webhooks
Set up webhooks to get notified when scraping completes:
- Run succeeded
- Run failed
- Run aborted

### Scheduling
Schedule regular scraping runs:
- Daily agent updates
- Weekly market analysis
- Monthly trend reports
- Custom schedules

## Legal & Compliance

### Terms of Use
- This scraper is for personal and research use
- Respect Rightmove's terms of service
- Do not use for unauthorized commercial purposes
- Comply with data protection regulations (GDPR, etc.)
- Use responsibly with appropriate rate limiting

### Data Usage
- Scraped data is for legitimate use only
- Do not republish copyrighted content
- Respect intellectual property rights
- Follow fair use guidelines
- Comply with applicable laws and regulations

## FAQ

### What data can I extract?
You can extract agent names, contact details (phone, email, website), office addresses, branch types, property counts, team information, and services offered.

### How many agents can I scrape?
You can scrape up to 1000 agents per run. For larger datasets, run multiple searches or increase maxPages.

### Why use proxies?
Rightmove implements rate limiting. Residential proxies help avoid blocking and ensure reliable data extraction.

### Is this legal?
Web scraping for personal research is generally legal. However, always review and comply with Rightmove's terms of service and applicable laws.

### How often should I scrape?
It depends on your needs. Weekly or monthly scraping is common for market monitoring and agent database updates.

### Can I export to my database?
Yes! Use Apify's API to integrate with your database or use webhooks to trigger data transfer automatically.

## Related Actors

- **Rightmove Property Scraper** - Extract property listings from Rightmove
- **Zoopla Agent Scraper** - Extract agents from Zoopla
- **OnTheMarket Scraper** - Scrape OnTheMarket listings
- **Real Estate CRM Integration** - Connect scraped data to your CRM

## Keywords

rightmove scraper, agent scraper uk, estate agents scraper, rightmove agent data, uk estate agents, letting agents scraper, agent listings scraper, agent contact scraper, rightmove api alternative, estate agent data, real estate automation, agent research tool, uk agent data, agent market data, rightmove crawler, estate agent extraction, agent database tool, real estate agents scraper

---

## Example Use Cases

### London Estate Agents Database
```json
{
  "searchLocation": "London",
  "radius": "0.0",
  "branchType": "SALES",
  "collectAgentDetails": true,
  "maxResults": 200
}
```

### Letting Agents in Manchester
```json
{
  "searchLocation": "Manchester",
  "radius": "5.0",
  "branchType": "LETTINGS",
  "collectAgentDetails": true,
  "maxResults": 100
}
```

### Specific Brand Analysis
```json
{
  "locationIdentifier": "REGION^87490",
  "brandName": "Foxtons",
  "radius": "10.0",
  "collectAgentDetails": true,
  "maxResults": 50
}
```

---

<p align="center">
  Made with ❤️ for real estate professionals, marketers, and researchers
</p>

<p align="center">
  <strong>Start scraping Rightmove agents today!</strong>
</p>
