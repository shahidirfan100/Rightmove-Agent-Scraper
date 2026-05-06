import { Actor, log } from "apify";
import { Dataset, HttpCrawler } from "crawlee";

log.setLevel(log.LEVELS.WARNING);

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

const REQUEST_DELAY_MS = 0;
const REQUEST_JITTER = 50;
const MAX_RETRIES = 3;
const DEFAULT_AGENTS_PER_PAGE = 20;
const DATASET_BATCH_SIZE = 15;
const TIMEOUT_SECONDS = 60;

const toUtf8String = (body) => {
    if (!body) return "";
    if (typeof body === "string") return body;
    if (Buffer.isBuffer(body)) return body.toString("utf-8");
    return String(body);
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const getRandomDelay = () => REQUEST_DELAY_MS + Math.random() * REQUEST_JITTER;

const sleep = (ms) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const cleanText = (text) => {
    if (!text) return null;
    const cleaned = text.replace(/\s+/g, " ").trim();
    return cleaned.length > 0 ? cleaned : null;
};

const pruneNullishDeep = (value) => {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value)) {
        const cleaned = value
            .map((v) => pruneNullishDeep(v))
            .filter((v) => v !== undefined);

        // Dedupe arrays to avoid noisy duplicate values in output.
        // - Primitive arrays are deduped by value
        // - Object arrays are deduped by common identity fields (id/url) when present
        const seen = new Set();
        const out = [];
        for (const item of cleaned) {
            const t = typeof item;
            let key = null;
            if (item === null || item === undefined) continue;

            if (t === "string" || t === "number" || t === "boolean") {
                key = `${t}:${String(item)}`;
            } else if (t === "object" && !Array.isArray(item)) {
                if (item.id != null) key = `id:${String(item.id)}`;
                else if (item.branchId != null) key = `branchId:${String(item.branchId)}`;
                else if (item.companyId != null) key = `companyId:${String(item.companyId)}`;
                else if (item.url) key = `url:${String(item.url)}`;
                else if (item.href) key = `href:${String(item.href)}`;
            }

            if (key) {
                if (seen.has(key)) continue;
                seen.add(key);
            }
            out.push(item);
        }
        return out;
    }
    if (typeof value === "object") {
        const out = {};
        for (const [key, v] of Object.entries(value)) {
            const cleaned = pruneNullishDeep(v);
            if (cleaned === undefined) continue;

            // Drop empty objects produced by pruning
            if (typeof cleaned === "object" && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0) {
                continue;
            }
            out[key] = cleaned;
        }
        return out;
    }
    return value;
};

const compactAgentProfile = (apr) => {
    if (!apr || typeof apr !== "object") return null;

    // These objects can be very large because they may include full property cards.
    // Keep the profile useful, but remove heavy lists to keep dataset size reasonable.
    const clone = typeof structuredClone === "function" ? structuredClone(apr) : JSON.parse(JSON.stringify(apr));

    // Remove bulky property lists (user asked specifically to remove sale properties).
    delete clone.salesProperties;
    delete clone.lettingsProperties;

    // Defensive: remove nested `properties` arrays if they appear under other keys.
    if (clone.salesProperties?.properties) delete clone.salesProperties.properties;
    if (clone.lettingsProperties?.properties) delete clone.lettingsProperties.properties;

    return pruneNullishDeep(clone);
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

const extractNextDataFromHtml = (html) => {
    if (!html) return null;

    // Rightmove uses a Next.js app; we treat the embedded __NEXT_DATA__ JSON as a structured source.
    // Keep regex flexible (attribute order can change).
    const match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;

    try {
        return JSON.parse(match[1]);
    } catch (e) {
        log.debug(`__NEXT_DATA__ parse error: ${e.message}`);
        return null;
    }
};

const findDeepObject = (root, predicate, { maxNodes = 5000 } = {}) => {
    if (!root || typeof root !== "object") return null;
    const queue = [root];
    const visited = new Set();
    let seen = 0;

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || typeof current !== "object") continue;
        if (visited.has(current)) continue;
        visited.add(current);

        seen += 1;
        if (seen > maxNodes) return null;

        if (!Array.isArray(current) && predicate(current)) return current;

        if (Array.isArray(current)) {
            for (const item of current) queue.push(item);
        } else {
            for (const value of Object.values(current)) queue.push(value);
        }
    }

    return null;
};

const buildRightmoveLogoUrl = (logoPath) => {
    if (!logoPath) return null;
    if (logoPath.startsWith("http")) return logoPath;

    // Rightmove agent JSON often uses media paths like "/34k/33248/branch_logo_...png"
    // These are served from media.rightmove.co.uk (not www.rightmove.co.uk)
    const cleanPath = logoPath.startsWith("/") ? logoPath : `/${logoPath}`;
    return `https://media.rightmove.co.uk${cleanPath}`;
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

const normalizeBranchType = ({ sales, lettings }) => {
    if (sales && lettings) return "ALL";
    if (sales) return "SALES";
    if (lettings) return "LETTINGS";
    return "ALL";
};

const pickTelephoneByType = (telephoneNumbers, targetType) => {
    if (!Array.isArray(telephoneNumbers)) return null;
    const found = telephoneNumbers.find((t) => (t?.type || "").toUpperCase() === targetType);
    return cleanText(found?.directNumber || found?.number);
};

const extractAgentsFromSearchHtml = (html) => {
    const nextData = extractNextDataFromHtml(html);
    if (!nextData) return { agents: [], pagination: null };

    const agents =
        nextData?.props?.pageProps?.data?.results?.agentsData?.agents ||
        nextData?.props?.pageProps?.data?.results?.agents ||
        [];
    const pagination =
        nextData?.props?.pageProps?.data?.results?.paginationData ||
        nextData?.props?.pageProps?.data?.results?.agentsData?.pagination ||
        null;

    // The search page sometimes returns duplicates per branch (e.g. separate records for sales vs lettings).
    // Merge by id so we produce one output row per branch.
    const byId = new Map();
    for (const item of agents) {
        const id = item?.id != null ? String(item.id) : extractAgentId(item?.branchLink?.href);
        if (!id) continue;

        const prev = byId.get(id);
        if (!prev) {
            byId.set(id, {
                ...item,
                id,
                telephoneNumbers: Array.isArray(item.telephoneNumbers) ? [...item.telephoneNumbers] : [],
                sales: !!item.sales,
                lettings: !!item.lettings,
            });
            continue;
        }

        prev.sales = prev.sales || !!item.sales;
        prev.lettings = prev.lettings || !!item.lettings;

        const nums = Array.isArray(item.telephoneNumbers) ? item.telephoneNumbers : [];
        const existing = new Set(prev.telephoneNumbers.map((t) => `${t?.type}|${t?.directNumber || t?.number}`));
        for (const t of nums) {
            const key = `${t?.type}|${t?.directNumber || t?.number}`;
            if (!existing.has(key)) {
                prev.telephoneNumbers.push(t);
                existing.add(key);
            }
        }
    }

    return { agents: [...byId.values()], pagination };
};

const extractAgentProfileResponseFromProfileHtml = (html) => {
    const nextData = extractNextDataFromHtml(html);
    const data = nextData?.props?.pageProps?.data;
    if (!data) return null;

    const direct =
        data?.branchProfileResponse?.agentProfileResponse ||
        data?.agentProfileResponse ||
        data?.agentProfile ||
        null;
    if (direct) return direct;

    // Fallback: scan for an object that looks like Rightmove's agent profile response.
    return findDeepObject(
        data,
        (obj) =>
            (obj.branchId != null || obj.companyId != null) &&
            (typeof obj.branchDisplayName === "string" || typeof obj.branchName === "string") &&
            (typeof obj.branchAddress === "string" || typeof obj.branchPostcode === "string" || typeof obj.companyName === "string")
    );
};

const normalizeProfileData = (apr) => {
    if (!apr || typeof apr !== "object") return null;

    const lettingsSummary = apr.lettingsProperties
        ? pruneNullishDeep({
              totalNumberOfProperties: apr.lettingsProperties.totalNumberOfProperties,
              propertySearchPath: apr.lettingsProperties.propertySearchPath,
          })
        : null;

    const salesSummary = apr.salesProperties
        ? pruneNullishDeep({
              totalNumberOfProperties: apr.salesProperties.totalNumberOfProperties,
              propertySearchPath: apr.salesProperties.propertySearchPath,
          })
        : null;

    return {
        branchId: apr.branchId != null ? String(apr.branchId) : null,
        companyId: apr.companyId != null ? String(apr.companyId) : null,

        branchAddress: cleanText(apr.branchAddress),
        branchPostcode: cleanText(apr.branchPostcode),

        branchDisplayName: cleanText(apr.branchDisplayName),
        branchName: cleanText(apr.branchName),
        brandTradingName: cleanText(apr.brandTradingName),

        branchMainTelephone: cleanText(apr.branchMainTelephone),
        branchLettingsTelephone: cleanText(apr.branchLettingsTelephone),

        branchLogoUrl: ensureAbsoluteUrl(apr.branchLogoUrl),
        fullBranchLogoUrl: ensureAbsoluteUrl(apr.fullBranchLogoUrl),
        brandLogoUrl: buildRightmoveLogoUrl(apr.brandLogoPath),
        branchStaticMapImageUrl: ensureAbsoluteUrl(apr.branchStaticMapImageUrl),

        companyName: cleanText(apr.companyName),
        companyTradingName: cleanText(apr.companyTradingName),
        companyTypeAlias: cleanText(apr.companyTypeAlias),

        branchSummaryProfile: cleanText(apr.branchSummary),
        branchDescription: cleanText(apr.branchDescription),
        primaryDescription: cleanText(apr.primaryDescription),
        lettingsPrimaryDescription: cleanText(apr.lettingsPrimaryDescription),

        branchProfileUrl: ensureAbsoluteUrl(apr.branchProfilePath),
        lettingsSearchUrl: ensureAbsoluteUrl(apr.lettingsSearchPath),

        hasLettings: !!apr.lettings,
        hasSales: !!apr.sales,
        hasCommercial: !!apr.commercial,
        hasOverseas: !!apr.overseas,
        hasDevelopment: !!apr.development,
        hasBuildToRent: !!apr.buildToRent,

        industryAffiliations: apr.industryAffiliations || null,
        productsInfo: apr.productsInfo || null,
        testimonials: apr.testimonials || null,

        lettingsPropertiesSummary: lettingsSummary,
        salesPropertiesSummary: salesSummary,
    };
};

const normalizeSearchAgent = (item, inputBranchType = "ALL") => {
    const agentId = item?.id != null ? String(item.id) : extractAgentId(item?.branchLink?.href);

    const profileHref = item?.aboutLink?.href || item?.branchLink?.href;
    const url = ensureAbsoluteUrl(profileHref);
    const branchType = normalizeBranchType({ sales: !!item?.sales, lettings: !!item?.lettings });

    const phoneSales = pickTelephoneByType(item?.telephoneNumbers, "RESALE");
    const phoneLettings = pickTelephoneByType(item?.telephoneNumbers, "LETTING");
    const fallbackPhone = cleanText(item?.telephoneNumbers?.[0]?.directNumber || item?.telephoneNumbers?.[0]?.number);

    let phone = null;
    if (inputBranchType === "SALES") phone = phoneSales || fallbackPhone || phoneLettings;
    else if (inputBranchType === "LETTINGS") phone = phoneLettings || fallbackPhone || phoneSales;
    else phone = fallbackPhone || phoneSales || phoneLettings;

    return {
        agentId,
        name: cleanText(item?.branchDisplayName || item?.name || item?.brandName),
        url,
        phone,
        phoneSales,
        phoneLettings,
        logo: buildRightmoveLogoUrl(item?.logoPath),
        branchType,

        brandName: cleanText(item?.brandName),
        branchSummary: cleanText(item?.branchSummary),
        description: cleanText(item?.description),
        primaryDescriptionHtml: cleanText(item?.primaryDescription),

        micrositeDescriptionSummary: cleanText(item?.microsite?.descriptionSummary),
        micrositeHomeLink: ensureAbsoluteUrl(item?.microsite?.homeLink?.href),
        micrositeTabLinks: Array.isArray(item?.microsite?.tabLinks)
            ? item.microsite.tabLinks.map((t) => ({
                  text: cleanText(t?.text),
                  href: ensureAbsoluteUrl(t?.href),
              }))
            : null,

        extractionMethod: "next-data",
    };
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
        maxResults = 20,
        maxPages = 1,
        startUrl = null,
        enrichProfiles = false,
    } = input;

    const searchUrl = buildSearchUrl({ startUrl, searchLocation, locationIdentifier, radius, brandName, branchType });

    log.warning("Starting Rightmove Agent Scraper");
    log.warning(`Search URL: ${searchUrl}`);
    log.warning(
        `Config: maxResults=${maxResults}, maxPages=${maxPages}, branchType=${branchType || "ALL"}, enrichProfiles=${enrichProfiles}`
    );

    let agentsScraped = 0;
    const agentIds = new Set();
    const pushedAgentIds = new Set();
    const agentDataBatch = [];

    let searchPagesProcessed = 0;

    const proxyConfig = input.proxyConfiguration
        ? await Actor.createProxyConfiguration(input.proxyConfiguration)
        : await Actor.createProxyConfiguration();

    const crawler = new HttpCrawler({
        proxyConfiguration: proxyConfig,
        requestHandlerTimeoutSecs: TIMEOUT_SECONDS,
        maxRequestRetries: MAX_RETRIES,
        maxConcurrency: 15,
        useSessionPool: true,

        async requestHandler({ request, body }) {
            const { url, userData } = request;
            const requestType = userData?.type || "SEARCH";
            try {
                if (requestType === "SEARCH") {
                    searchPagesProcessed += 1;

                    const html = toUtf8String(body);

                    // Extract structured agent list from embedded Next.js __NEXT_DATA__
                    const { agents: rawAgents, pagination } = extractAgentsFromSearchHtml(html);
                    if (!rawAgents.length) {
                        log.warning("  ⚠ No agents found in structured page data (blocked or markup changed)");
                    }

                    for (const raw of rawAgents) {
                        if (agentsScraped >= maxResults) break;

                        const listingAgent = normalizeSearchAgent(raw, branchType);
                        if (!listingAgent?.agentId || !listingAgent?.url) continue;

                        if (agentIds.has(listingAgent.agentId)) continue;
                        agentIds.add(listingAgent.agentId);
                        agentsScraped += 1;

                        if (!enrichProfiles) {
                            const finalAgent = pruneNullishDeep({
                                ...listingAgent,
                                scrapedAt: new Date().toISOString(),
                            });
                            pushedAgentIds.add(String(listingAgent.agentId));
                            if (finalAgent && Object.keys(finalAgent).length > 0) agentDataBatch.push(finalAgent);
                            continue;
                        }

                        await crawler.addRequests([
                            {
                                url: listingAgent.url,
                                userData: {
                                    type: "PROFILE",
                                    agentId: listingAgent.agentId,
                                    listingAgent,
                                },
                                headers: { ...STEALTHY_HEADERS, "User-Agent": getRandomUserAgent() },
                            },
                        ]);
                    }

                    if (!enrichProfiles && agentDataBatch.length >= DATASET_BATCH_SIZE) {
                        const toPush = agentDataBatch.splice(0, agentDataBatch.length);
                        await Dataset.pushData(toPush);
                        log.warning(`Pushed ${toPush.length} agents (total ${pushedAgentIds.size})`);
                    }

                    // Handle pagination (search pages only)
                    const pageNumber = userData?.pageNumber || 1;
                    if (agentsScraped < maxResults && pageNumber < maxPages) {
                        const urlObj = new URL(url);
                        const currentIndex = parseInt(urlObj.searchParams.get("index") || "0", 10) || 0;

                        const indexFirstAgent = pagination?.indexFirstAgent ?? null;
                        const indexLastAgent = pagination?.indexLastAgent ?? null;
                        const inferredPageSize =
                            typeof indexFirstAgent === "number" && typeof indexLastAgent === "number"
                                ? Math.max(1, indexLastAgent - indexFirstAgent + 1)
                                : null;
                        const pageSize = inferredPageSize || (rawAgents?.length || DEFAULT_AGENTS_PER_PAGE);

                        const nextIndex = currentIndex + pageSize;
                        urlObj.searchParams.set("index", String(nextIndex));
                        const nextUrl = urlObj.toString();

                        await crawler.addRequests([
                            {
                                url: nextUrl,
                                userData: { type: "SEARCH", pageNumber: pageNumber + 1 },
                                headers: { ...STEALTHY_HEADERS, "User-Agent": getRandomUserAgent() },
                            },
                        ]);
                    }

                    if (getRandomDelay() > 0) await sleep(getRandomDelay());
                    return;
                }

                if (requestType === "PROFILE") {
                    const html = toUtf8String(body);
                    const listingAgent = userData?.listingAgent || null;
                    const agentId = userData?.agentId || listingAgent?.agentId || extractAgentId(url);

                    const apr = extractAgentProfileResponseFromProfileHtml(html);
                    const profile = normalizeProfileData(apr);
                    const agentProfile = compactAgentProfile(apr);

                    const finalAgent = pruneNullishDeep({
                        ...listingAgent,
                        ...profile,
                        agentProfile,
                        scrapedAt: new Date().toISOString(),
                        extractionMethod: "next-data",
                    });

                    if (agentId) pushedAgentIds.add(String(agentId));
                    if (finalAgent && Object.keys(finalAgent).length > 0) {
                        agentDataBatch.push(finalAgent);
                    }

                    if (agentDataBatch.length >= DATASET_BATCH_SIZE) {
                        const toPush = agentDataBatch.splice(0, agentDataBatch.length);
                        await Dataset.pushData(toPush);
                        log.warning(`Pushed ${toPush.length} agents (total ${pushedAgentIds.size})`);
                    }

                    if (getRandomDelay() > 0) await sleep(getRandomDelay());
                }
            } catch (error) {
                log.error(`Handler error: ${error.message}`);
                throw error;
            }
        },

        errorHandler: async ({ request }) => {
            log.warning(`Failed: ${request.url} (retries: ${request.retryCount}/${MAX_RETRIES})`);
        },

        // Last-resort fallback: if a profile page fails after retries, push the listing-only data
        // so the dataset is not missing rows.
        failedRequestHandler: async ({ request }) => {
            const { userData } = request;
            if (userData?.type !== "PROFILE") return;

            const listingAgent = userData?.listingAgent;
            const agentId = userData?.agentId || listingAgent?.agentId;
            if (!listingAgent || !agentId) return;
            if (pushedAgentIds.has(String(agentId))) return;

            const finalAgent = pruneNullishDeep({
                ...listingAgent,
                scrapedAt: new Date().toISOString(),
                extractionMethod: "next-data",
            });

            pushedAgentIds.add(String(agentId));
            await Dataset.pushData(finalAgent);
            log.warning(`Pushed 1 agent (profile failed; total ${pushedAgentIds.size})`);
        },
    });

    await crawler.addRequests([
        {
            url: searchUrl,
            userData: { type: "SEARCH", pageNumber: 1 },
            headers: { ...STEALTHY_HEADERS, "User-Agent": getRandomUserAgent() },
        },
    ]);

    await crawler.run();

    if (agentDataBatch.length > 0) {
        const toPush = agentDataBatch.splice(0, agentDataBatch.length);
        await Dataset.pushData(toPush);
        log.warning(`Pushed ${toPush.length} agents (total ${pushedAgentIds.size})`);
    }

    log.warning("Completed");
    log.warning(`Agents targeted: ${agentsScraped}, Unique: ${agentIds.size}, Search pages: ${searchPagesProcessed}, Pushed: ${pushedAgentIds.size}`);

    await Actor.setValue("OUTPUT", {
        status: "success",
        agentsTargeted: agentsScraped,
        uniqueAgents: agentIds.size,
        searchPagesProcessed,
        pushed: pushedAgentIds.size,
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
