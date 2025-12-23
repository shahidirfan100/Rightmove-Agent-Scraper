import { Actor, log } from "apify";
import { CheerioCrawler, Dataset } from "crawlee";
import { load as cheerioLoad } from "cheerio";

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const BASE_URL = "https://www.rightmove.co.uk";
const DEFAULT_SEARCH_URL = `${BASE_URL}/estate-agents/find.html`;

const UK_REGIONS = {
    london: "REGION^87490",
    manchester: "REGION^904",
    birmingham: "REGION^60",
    leeds: "REGION^787",
    liverpool: "REGION^1520",
    bristol: "REGION^239",
    edinburgh: "REGION^339",
    glasgow: "REGION^394",
    cardiff: "REGION^306",
    belfast: "REGION^5882",
};

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

const STEALTHY_HEADERS = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    DNT: "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
    Pragma: "no-cache",
    "Sec-Ch-Ua": '"Chromium";v="124", "Not;A=Brand";v="8"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
};

const REQUEST_DELAY_MS = 500;
const REQUEST_JITTER = 300;
const MAX_RETRIES = 5;
const DEFAULT_AGENTS_PER_PAGE = 10;
const DATASET_BATCH_SIZE = 15;
const TIMEOUT_SECONDS = 60;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const getRandomDelay = () => REQUEST_DELAY_MS + Math.random() * REQUEST_JITTER;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cleanText = (text) => {
    if (!text) return null;
    const cleaned = text.replace(/\s+/g, " ").trim();
    return cleaned.length > 0 ? cleaned : null;
};

const cleanDescription = (text) => {
    if (!text) return null;

    // Remove excessive whitespace but preserve paragraph structure
    let cleaned = text
        .replace(/\r\n/g, '\n')           // Normalize line breaks
        .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines (paragraph break)
        .replace(/[ \t]+/g, ' ')          // Replace multiple spaces/tabs with single space
        .replace(/\n /g, '\n')            // Remove spaces at start of lines
        .replace(/ \n/g, '\n')            // Remove spaces at end of lines
        .trim();

    return cleaned.length > 0 ? cleaned : null;
};

const ensureAbsoluteUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    if (url.startsWith("//")) return `https:${url}`;
    return `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const extractAgentId = (url) => {
    if (!url) return null;
    // Extract agent ID from URLs like /estate-agents/agent/YYYY/branch-name.html or /branch-view/YYYY
    const match = url.match(/\/agent\/(\d+)|\/branch-view\/(\d+)|branchId[=:](\d+)/i);
    return match ? match[1] || match[2] || match[3] : null;
};

const extractJsonLd = (html) => {
    if (!html) return [];
    const $ = cheerioLoad(html);
    const scripts = $('script[type="application/ld+json"]');
    const data = [];
    scripts.each((_, el) => {
        try {
            const content = $(el).html();
            if (!content) return;
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) data.push(...parsed);
            else data.push(parsed);
        } catch (e) {
            log.debug(`JSON-LD parse error: ${e.message}`);
        }
    });
    return data;
};

const buildSearchUrl = (input) => {
    if (input.startUrl) return input.startUrl;
    const params = new URLSearchParams();

    if (input.locationIdentifier) {
        params.append("locationIdentifier", input.locationIdentifier);
    } else if (input.searchLocation) {
        // Try to map searchLocation to UK_REGIONS
        const locationKey = input.searchLocation.toLowerCase().trim();
        const regionId = UK_REGIONS[locationKey];

        if (regionId) {
            // Found matching region, use locationIdentifier
            params.append("locationIdentifier", regionId);
        } else {
            // For unrecognized locations, try as-is (might be postcode/custom identifier)
            params.append("locationIdentifier", input.searchLocation);
        }
    } else {
        // Default to London
        params.append("locationIdentifier", UK_REGIONS.london);
    }

    params.append("radius", input.radius || "0.0");

    // Agent-specific parameters
    if (input.brandName) params.append("brandName", input.brandName);
    params.append("branchType", input.branchType || "ALL");

    return `${DEFAULT_SEARCH_URL}?${params.toString()}`;
};

// ============================================================================
// DATA EXTRACTION
// ============================================================================

const extractAgentCard = ($, cardElement) => {
    try {
        const card = $(cardElement);

        // Extract agent name and profile URL
        const nameLink = card.find('a.ksc_link, a[class*="agentCard_ctaLink"]').first();
        if (!nameLink.length) return null;

        const agentUrl = ensureAbsoluteUrl(nameLink.attr("href"));
        const agentId = extractAgentId(agentUrl);
        const agentName = cleanText(nameLink.text()) || cleanText(card.find('h2, h3').first().text());

        if (!agentName || !agentUrl) return null;

        // Extract phone number
        let phone = null;
        const cardText = card.text();
        const telMatch = cardText.match(/Tel[:\s]*([\d\s]+)/i);
        if (telMatch) {
            phone = cleanText(telMatch[1].replace(/\s+/g, ' '));
        }

        // Extract logo
        let logo = null;
        const logoImg = card.find('img').first();
        if (logoImg.length) {
            logo = ensureAbsoluteUrl(logoImg.attr("src") || logoImg.attr("data-src"));
        }

        // Extract branch type (SALES/LETTINGS)
        let branchType = "ALL";
        const branchTypeText = cardText.match(/(SALES|LETTINGS)/i);
        if (branchTypeText) {
            branchType = branchTypeText[1].toUpperCase();
        }

        // Extract description/snippet
        let description = null;
        const descriptionEl = card.find('p').filter((_, el) => {
            const text = $(el).text();
            return text.length > 20 && !text.includes('Tel');
        }).first();
        if (descriptionEl.length) {
            description = cleanText(descriptionEl.text());
            if (description && description.length > 200) {
                description = description.substring(0, 200) + '...';
            }
        }

        // Try to extract address
        let address = null;
        const addressPatterns = card.find('[class*="address"], span, div').filter((_, el) => {
            const text = $(el).text();
            return text.includes(',') && text.length > 10 && text.length < 150;
        });
        if (addressPatterns.length) {
            address = cleanText(addressPatterns.first().text());
        }

        return {
            agentId,
            name: agentName,
            url: agentUrl,
            phone,
            logo,
            branchType,
            description,
            address,
        };
    } catch (error) {
        log.warning(`Agent card extraction error: ${error.message}`);
        return null;
    }
};

const extractAgentDetails = ($, html, basicInfo = {}) => {
    try {
        const jsonLdData = extractJsonLd(html);
        let agentData = { ...basicInfo };

        // Try to find organization JSON-LD
        const orgJsonLd = jsonLdData.find((d) => {
            const type = d["@type"];
            return type === "RealEstateAgent" || type === "Organization" || type === "LocalBusiness";
        });

        if (orgJsonLd) {
            if (orgJsonLd.name) agentData.name = orgJsonLd.name;
            if (orgJsonLd.telephone) agentData.phone = orgJsonLd.telephone;
            if (orgJsonLd.email) agentData.email = orgJsonLd.email;
            if (orgJsonLd.url || orgJsonLd.website) agentData.website = orgJsonLd.url || orgJsonLd.website;
            if (orgJsonLd.address) {
                const addr = orgJsonLd.address;
                if (typeof addr === 'string') {
                    agentData.address = addr;
                } else if (addr.streetAddress || addr.addressLocality) {
                    agentData.address = [
                        addr.streetAddress,
                        addr.addressLocality,
                        addr.postalCode
                    ].filter(Boolean).join(', ');
                }
            }
            if (orgJsonLd.description) agentData.description = orgJsonLd.description;
        }

        // Extract full description
        if (!agentData.description) {
            const descSelectors = [
                '[class*="description"]',
                '[class*="about"]',
                '[class*="profile"]',
                'div[class*="text"] p',
                'section p'
            ];
            for (const selector of descSelectors) {
                const descEl = $(selector).first();
                if (descEl.length) {
                    const desc = cleanDescription(descEl.text());
                    if (desc && desc.length > 50) {
                        agentData.description = desc;
                        break;
                    }
                }
            }
        }

        // Extract contact details if not found in JSON-LD
        if (!agentData.phone) {
            const phoneSelectors = ['[class*="phone"]', '[class*="tel"]', 'a[href^="tel:"]'];
            for (const selector of phoneSelectors) {
                const phoneEl = $(selector).first();
                if (phoneEl.length) {
                    agentData.phone = cleanText(phoneEl.text()) || phoneEl.attr('href')?.replace('tel:', '');
                    if (agentData.phone) break;
                }
            }
        }

        if (!agentData.email) {
            const emailSelectors = ['[class*="email"]', 'a[href^="mailto:"]'];
            for (const selector of emailSelectors) {
                const emailEl = $(selector).first();
                if (emailEl.length) {
                    agentData.email = cleanText(emailEl.text()) || emailEl.attr('href')?.replace('mailto:', '');
                    if (agentData.email) break;
                }
            }
        }

        if (!agentData.website) {
            const websiteSelectors = ['[class*="website"]', 'a[class*="web"]'];
            for (const selector of websiteSelectors) {
                const webEl = $(selector).first();
                if (webEl.length) {
                    agentData.website = webEl.attr('href');
                    if (agentData.website && agentData.website.startsWith('http')) break;
                }
            }
        }

        // Extract address if not found
        if (!agentData.address) {
            const addressSelectors = ['[class*="address"]', '[itemprop="address"]'];
            for (const selector of addressSelectors) {
                const addrEl = $(selector).first();
                if (addrEl.length) {
                    agentData.address = cleanText(addrEl.text());
                    if (agentData.address) break;
                }
            }
        }

        // Extract property statistics
        const pageText = $.text();

        // Properties for sale
        const forSaleMatch = pageText.match(/(\d+)\s*properties?\s*for\s*sale/i);
        if (forSaleMatch) {
            agentData.propertiesForSale = parseInt(forSaleMatch[1], 10);
        }

        // Properties to let
        const toLetMatch = pageText.match(/(\d+)\s*properties?\s*to\s*let/i);
        if (toLetMatch) {
            agentData.propertiesToLet = parseInt(toLetMatch[1], 10);
        }

        // Extract team members count
        const teamMatch = pageText.match(/(\d+)\s*(?:team members?|staff|agents?)/i);
        if (teamMatch) {
            agentData.teamMembers = parseInt(teamMatch[1], 10);
        }

        // Extract services offered
        const services = [];
        const serviceKeywords = ['sales', 'lettings', 'mortgages', 'conveyancing', 'valuation', 'property management'];
        const lowerPageText = pageText.toLowerCase();
        serviceKeywords.forEach(service => {
            if (lowerPageText.includes(service)) {
                services.push(service.charAt(0).toUpperCase() + service.slice(1));
            }
        });
        if (services.length > 0) {
            agentData.servicesOffered = services;
        }

        return {
            ...agentData,
            extractionMethod: orgJsonLd ? "json-ld" : "html-parse",
        };
    } catch (error) {
        log.warning(`Agent detail extraction error: ${error.message}`);
        return { ...basicInfo, extractionMethod: "failed" };
    }
};

// ============================================================================
// MAIN ACTOR
// ============================================================================

await Actor.init();

try {
    const input = (await Actor.getInput()) || {};
    const {
        searchLocation = null,
        locationIdentifier = null,
        radius = "0.0",
        brandName = "",
        branchType = "ALL",
        collectAgentDetails = true,
        maxResults = 100,
        maxPages = 5,
        startUrl = null,
    } = input;

    const searchUrl = buildSearchUrl({ startUrl, searchLocation, locationIdentifier, radius, brandName, branchType });

    log.info("✓ Starting Rightmove Agent Scraper");
    if (startUrl) {
        log.info(`  Search Method: Direct URL`);
    } else if (locationIdentifier) {
        log.info(`  Search Method: Location Identifier (${locationIdentifier})`);
    } else if (searchLocation) {
        log.info(`  Search Method: Location "${searchLocation}"`);
    } else {
        log.info(`  Search Method: Default (London)`);
    }
    log.info(`  Search URL: ${searchUrl}`);
    log.info(`  Config: ${maxResults} agents, ${maxPages} pages, Details: ${collectAgentDetails}`);
    if (brandName) log.info(`  Brand Filter: ${brandName}`);
    if (branchType !== "ALL") log.info(`  Branch Type: ${branchType}`);

    let agentsScraped = 0;
    let agentsQueued = 0;
    const agentUrls = new Set();
    const agentDataBatch = [];
    let currentPage = 1;

    const proxyConfig = input.proxyConfiguration
        ? await Actor.createProxyConfiguration(input.proxyConfiguration)
        : await Actor.createProxyConfiguration();

    const crawler = new CheerioCrawler({
        proxyConfiguration: proxyConfig,
        requestHandlerTimeoutSecs: TIMEOUT_SECONDS,
        maxRequestRetries: MAX_RETRIES,
        maxConcurrency: 5,
        useSessionPool: true,

        async requestHandler({ request, $, body, response }) {
            const { url, userData } = request;
            try {
                request.headers = { ...request.headers, ...STEALTHY_HEADERS, "User-Agent": getRandomUserAgent() };

                if (userData?.isAgentDetail) {
                    const agentDetails = extractAgentDetails($, body, userData.basicInfo);
                    const agent = { ...userData.basicInfo, ...agentDetails, scrapedAt: new Date().toISOString() };
                    agentDataBatch.push(agent);
                    agentsScraped += 1;
                    log.info(`  Agent ${agentsScraped}/${maxResults}: ${agent.name}`);
                    if (agentDataBatch.length >= DATASET_BATCH_SIZE) {
                        await Dataset.pushData([...agentDataBatch]);
                        agentDataBatch.length = 0;
                    }
                    return;
                }

                // Extract agent cards from listing page
                let agentCards = [];

                // Try multiple selectors to find agent containers
                const possibleSelectors = [
                    '[class*="agentCard_agentCard"]',  // Primary agent card selector
                    'div[class*="agentCard"]',
                    'article[class*="agent"]',
                    'div[class*="branch"]'
                ];

                for (const selector of possibleSelectors) {
                    agentCards = $(selector).toArray();
                    if (agentCards.length >= 5) break;  // Found substantial results
                }

                if (agentCards.length === 0) {
                    log.warning(`  ⚠ No agent cards found on page - check selectors or region may have no agents`);
                }

                const agents = [];
                for (const card of agentCards) {
                    if (agentsQueued >= maxResults) break;
                    const agent = extractAgentCard($, card);
                    if (agent && !agentUrls.has(agent.url)) {
                        agentUrls.add(agent.url);
                        agents.push(agent);
                        agentsQueued += 1;
                    }
                }
                log.info(`  Extracted ${agents.length} new agents (${agentsQueued}/${maxResults} total queued)`);

                if (collectAgentDetails) {
                    for (const agent of agents) {
                        if (agentsQueued > maxResults) break;
                        await crawler.addRequests([
                            {
                                url: agent.url,
                                userData: { isAgentDetail: true, basicInfo: agent },
                                headers: { ...STEALTHY_HEADERS, "User-Agent": getRandomUserAgent() },
                            },
                        ]);
                    }
                } else {
                    for (const agent of agents) {
                        if (agentsScraped >= maxResults) break;
                        agentDataBatch.push({
                            ...agent,
                            scrapedAt: new Date().toISOString(),
                            extractionMethod: "basic-card",
                        });
                        agentsScraped += 1;
                    }
                    if (agentDataBatch.length >= DATASET_BATCH_SIZE) {
                        await Dataset.pushData([...agentDataBatch]);
                        agentDataBatch.length = 0;
                    }
                }

                // Handle pagination
                if (agentsQueued < maxResults && currentPage < maxPages) {
                    let nextUrl = null;

                    // Try to find next button
                    const nextButton = $('button[class*="pagination_next"], a[class*="pagination_next"], button:contains("Next")').first();
                    if (nextButton.length && !nextButton.prop('disabled')) {
                        const nextHref = nextButton.attr("href");
                        if (nextHref) nextUrl = ensureAbsoluteUrl(nextHref);
                    }

                    // Fallback: construct URL with index parameter
                    if (!nextUrl) {
                        const urlObj = new URL(url);
                        const index = parseInt(urlObj.searchParams.get("index"), 10) || 0;
                        urlObj.searchParams.set("index", index + DEFAULT_AGENTS_PER_PAGE);
                        nextUrl = urlObj.toString();
                    }

                    if (nextUrl) {
                        currentPage += 1;
                        log.info(`  Moving to page ${currentPage}`);
                        await crawler.addRequests([
                            {
                                url: nextUrl,
                                userData: { isAgentDetail: false, pageNumber: currentPage },
                                headers: { ...STEALTHY_HEADERS, "User-Agent": getRandomUserAgent() },
                            },
                        ]);
                    }
                }

                await sleep(getRandomDelay());
            } catch (error) {
                log.error(`Handler error: ${error.message}`);
                throw error;
            }
        },

        errorHandler: async ({ request }) => {
            log.warning(`Failed: ${request.url} (retries: ${request.retryCount}/${MAX_RETRIES})`);
        },
    });

    await crawler.addRequests([
        {
            url: searchUrl,
            userData: { isAgentDetail: false, pageNumber: 1 },
            headers: { ...STEALTHY_HEADERS, "User-Agent": getRandomUserAgent() },
        },
    ]);

    log.info("Starting crawler...");
    await crawler.run();

    if (agentDataBatch.length > 0) await Dataset.pushData(agentDataBatch);

    log.info("✓ Completed!");
    log.info(`  Agents Scraped: ${agentsScraped}, Queued: ${agentsQueued}, Unique: ${agentUrls.size}, Pages: ${currentPage}`);

    await Actor.setValue("OUTPUT", {
        status: "success",
        agentsScraped,
        uniqueAgents: agentUrls.size,
        pagesProcessed: currentPage,
        completedAt: new Date().toISOString(),
    });
} catch (error) {
    log.error(`Error: ${error.message}`, error);
    await Actor.setValue("OUTPUT", {
        status: "error",
        error: error.message,
        failedAt: new Date().toISOString(),
    });
    throw error;
} finally {
    await Actor.exit();
}
