import { Actor, log } from "apify";
import { Dataset } from "crawlee";
import { gotScraping } from "got-scraping";

log.setLevel(log.LEVELS.INFO);

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const BASE_URL = "https://www.rightmove.co.uk";
const DEFAULT_SEARCH_URL = `${BASE_URL}/estate-agents/find.html`;
const RIGHTMOVE_HOME_URL = `${BASE_URL}/`;
const TYPEAHEAD_BASE_URL = "https://los.rightmove.co.uk/typeahead";

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

const RIGHTMOVE_NAVIGATION_HEADERS = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Cache-Control": "max-age=0",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
};

const RIGHTMOVE_HEADER_GENERATOR_OPTIONS = {
    browsers: [
        { name: "chrome", minVersion: 122, maxVersion: 126 },
        { name: "firefox", minVersion: 123, maxVersion: 127 },
    ],
    devices: ["desktop"],
    locales: ["en-GB", "en-US"],
    operatingSystems: ["windows", "macos", "linux"],
};

const DEFAULT_AGENTS_PER_PAGE = 20;
const DATASET_BATCH_SIZE = DEFAULT_AGENTS_PER_PAGE;
const TIMEOUT_SECONDS = 60;
const PROFILE_CONCURRENCY = 8;
const MAX_EXPANSION_DEPTH = 4;
const MAX_SEARCH_PAGES_PER_SEED = 250;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const cleanText = (text) => {
    if (!text) return null;
    const cleaned = text.replace(/\s+/g, " ").trim();
    return cleaned.length > 0 ? cleaned : null;
};

const cleanRichText = (text) => {
    if (!text) return null;
    const withoutTags = String(text)
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/p\s*>/gi, " ")
        .replace(/<[^>]+>/g, " ");
    return cleanText(withoutTags);
};

const parseOptionalPositiveInteger = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const flushAgentDataBatch = async (agentDataBatch, { force = false, onFlush = async () => {} } = {}) => {
    while (agentDataBatch.length >= DATASET_BATCH_SIZE || (force && agentDataBatch.length > 0)) {
        const chunkSize = force ? agentDataBatch.length : DATASET_BATCH_SIZE;
        const toPush = agentDataBatch.splice(0, chunkSize);
        await Dataset.pushData(toPush);
        await onFlush(toPush);
    }
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

const ensureAbsoluteUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    if (url.startsWith("//")) return `https:${url}`;
    if (url.startsWith("/partner-logo/")) return `https://media.rightmove.co.uk${url}`;
    return `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const normalizeReferer = (url) => ensureAbsoluteUrl(url) || RIGHTMOVE_HOME_URL;

const buildRightmoveRequestHeaders = ({ referer }) => ({
    ...RIGHTMOVE_NAVIGATION_HEADERS,
    Origin: BASE_URL,
    Referer: normalizeReferer(referer),
});

const getProxyUrl = async (proxyConfig) => {
    if (!proxyConfig) return undefined;
    return proxyConfig.newUrl();
};

const fetchText = async ({ url, proxyConfig, referer = RIGHTMOVE_HOME_URL, accept = RIGHTMOVE_NAVIGATION_HEADERS.Accept }) => {
    const proxyUrl = await getProxyUrl(proxyConfig);
    const response = await gotScraping({
        url,
        proxyUrl,
        responseType: "text",
        timeout: { request: TIMEOUT_SECONDS * 1000 },
        retry: { limit: 0 },
        headerGeneratorOptions: RIGHTMOVE_HEADER_GENERATOR_OPTIONS,
        headers: {
            ...buildRightmoveRequestHeaders({ referer }),
            Accept: accept,
        },
    });

    return response.body;
};

const fetchJson = async ({ url, proxyConfig, referer = RIGHTMOVE_HOME_URL }) => {
    const proxyUrl = await getProxyUrl(proxyConfig);
    const response = await gotScraping({
        url,
        proxyUrl,
        responseType: "json",
        timeout: { request: TIMEOUT_SECONDS * 1000 },
        retry: { limit: 0 },
        headerGeneratorOptions: RIGHTMOVE_HEADER_GENERATOR_OPTIONS,
        headers: {
            ...buildRightmoveRequestHeaders({ referer }),
            Accept: "application/json, text/plain, */*",
        },
    });

    return response.body;
};

const chunkArray = (items, size) => {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};

const normalizeSearchSeedUrl = (url) => {
    try {
        const parsed = new URL(url, BASE_URL);
        parsed.hash = "";
        return parsed.toString();
    } catch {
        return url;
    }
};

const extractSidebarEstateAgentLinks = (results, currentUrl) => {
    const sidebarGroups = Array.isArray(results?.agentsData?.sidebar) ? results.agentsData.sidebar : [];
    const currentPath = new URL(currentUrl).pathname.toLowerCase();
    const withinGroups = sidebarGroups.filter((group) => /within/i.test(group?.heading || ""));
    const candidateGroups = withinGroups.length > 0 ? withinGroups : sidebarGroups;

    return [...new Set(
        candidateGroups
            .flatMap((group) => (Array.isArray(group?.links) ? group.links : []))
            .map((link) => ensureAbsoluteUrl(link?.href))
            .filter((href) => href && href.includes("/estate-agents/"))
            .filter((href) => {
                try {
                    return new URL(href).pathname.toLowerCase() !== currentPath;
                } catch {
                    return false;
                }
            })
    )];
};

const shouldExpandSearchSeed = ({ totalAgents, sidebarLinks, depth, maxResults }) => {
    if (!sidebarLinks.length || depth >= MAX_EXPANSION_DEPTH) return false;
    if (maxResults !== null && maxResults <= 1000) return false;
    return totalAgents !== null && totalAgents > 1000;
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
    if (logoPath.startsWith("http")) {
        return logoPath.replace("https://www.rightmove.co.uk/partner-logo/", "https://media.rightmove.co.uk/partner-logo/");
    }

    // Rightmove agent JSON often uses media paths like "/34k/33248/branch_logo_...png"
    // These are served from media.rightmove.co.uk (not www.rightmove.co.uk)
    const cleanPath = logoPath.startsWith("/") ? logoPath : `/${logoPath}`;
    return `https://media.rightmove.co.uk${cleanPath}`;
};

const pickCleanDescription = (...values) => {
    for (const value of values) {
        const cleaned = cleanRichText(value);
        if (cleaned) return cleaned;
    }
    return null;
};

const sameNormalizedText = (left, right) => {
    const a = cleanRichText(left)?.toLowerCase();
    const b = cleanRichText(right)?.toLowerCase();
    return !!a && !!b && a === b;
};

const resolveLocationIdentifier = async (searchLocation, proxyConfig) => {
    if (!searchLocation) return null;

    const locationKey = searchLocation.toLowerCase().trim();
    if (UK_REGIONS[locationKey]) return UK_REGIONS[locationKey];

    const query = searchLocation.replace(/[,()[\]{}]/g, "").toUpperCase();
    const url = `${TYPEAHEAD_BASE_URL}?query=${encodeURIComponent(query)}&limit=10&exclude=STREET`;

    try {
        const response = await fetchJson({
            url,
            proxyConfig,
            referer: RIGHTMOVE_HOME_URL,
        });
        const matches = Array.isArray(response?.matches) ? response.matches : [];
        const exactMatch = matches.find((match) => match?.displayName?.toLowerCase() === searchLocation.toLowerCase());
        const selected = exactMatch || matches[0];
        return selected?.id && selected?.type ? `${selected.type}^${selected.id}` : searchLocation;
    } catch (error) {
        log.info(`Typeahead lookup failed for "${searchLocation}": ${error.message}`);
        return searchLocation;
    }
};

const buildSearchUrl = async (input, proxyConfig) => {
    if (input.startUrl) return input.startUrl;
    const params = new URLSearchParams();

    if (input.locationIdentifier) {
        params.append("locationIdentifier", input.locationIdentifier);
    } else if (input.searchLocation) {
        const resolvedLocationIdentifier = await resolveLocationIdentifier(input.searchLocation, proxyConfig);
        params.append("locationIdentifier", resolvedLocationIdentifier || input.searchLocation);
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

    const description = pickCleanDescription(
        apr.branchDescription,
        apr.primaryDescription,
        apr.lettingsPrimaryDescription,
        apr.branchSummary
    );
    const branchSummary = cleanRichText(apr.branchSummary);

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

        logo: buildRightmoveLogoUrl(apr.fullBranchLogoUrl || apr.branchLogoUrl || apr.brandLogoPath),
        branchStaticMapImageUrl: ensureAbsoluteUrl(apr.branchStaticMapImageUrl),

        companyName: cleanText(apr.companyName),
        companyTradingName: cleanText(apr.companyTradingName),
        companyTypeAlias: cleanText(apr.companyTypeAlias),

        branchSummary: sameNormalizedText(branchSummary, description) ? null : branchSummary,
        description,

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

    const description = pickCleanDescription(item?.description, item?.primaryDescription, item?.microsite?.descriptionSummary);
    const branchSummary = cleanRichText(item?.branchSummary);

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
        branchSummary: sameNormalizedText(branchSummary, description) ? null : branchSummary,
        description,

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

const hasReachedLimit = (count, limit) => limit !== null && count >= limit;

const hasNextSearchPage = ({ pagination, rawAgents, pageNumber, maxPages, newAgentsFound }) => {
    if (hasReachedLimit(pageNumber, maxPages)) return false;
    if (!Array.isArray(rawAgents) || rawAgents.length === 0) return false;
    if (newAgentsFound === 0) return false;

    const nextPageUrl = pagination?.nextPageUrl || pagination?.next || pagination?.nextLink || null;
    if (nextPageUrl) return true;

    const hasNextPageFlag = pagination?.hasNextPage;
    if (typeof hasNextPageFlag === "boolean") return hasNextPageFlag;

    const indexLastAgent = parseOptionalPositiveInteger(pagination?.indexLastAgent);
    const totalAgents = parseOptionalPositiveInteger(
        pagination?.totalAgents ?? pagination?.numberOfAgents ?? pagination?.totalResults ?? pagination?.totalCount ?? pagination?.total
    );
    if (indexLastAgent !== null && totalAgents !== null) return indexLastAgent < totalAgents;

    const totalPages = parseOptionalPositiveInteger(
        pagination?.totalPages ?? pagination?.pageCount ?? pagination?.numberOfPages
    );
    const currentPage =
        parseOptionalPositiveInteger(pagination?.currentPage ?? pagination?.pageNumber ?? pagination?.page) || pageNumber;
    if (totalPages !== null) return currentPage < totalPages;

    return rawAgents.length >= DEFAULT_AGENTS_PER_PAGE;
};

const fetchSearchResultsPage = async ({ url, proxyConfig, referer }) => {
    const html = await fetchText({ url, proxyConfig, referer });
    const { agents, pagination } = extractAgentsFromSearchHtml(html);
    const nextData = extractNextDataFromHtml(html);
    const results = nextData?.props?.pageProps?.data?.results || null;
    return { agents, pagination, results };
};

const fetchProfileRecord = async ({ listingAgent, proxyConfig, referer }) => {
    try {
        const html = await fetchText({ url: listingAgent.url, proxyConfig, referer });
        const apr = extractAgentProfileResponseFromProfileHtml(html);
        const profile = normalizeProfileData(apr);

        return pruneNullishDeep({
            ...listingAgent,
            ...profile,
            scrapedAt: new Date().toISOString(),
            extractionMethod: "next-data",
        });
    } catch (error) {
        log.info(`Profile fallback for ${listingAgent.url}: ${error.message}`);
        return pruneNullishDeep({
            ...listingAgent,
            scrapedAt: new Date().toISOString(),
            extractionMethod: "next-data",
        });
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
        maxResults: inputMaxResults = null,
        maxPages: inputMaxPages = null,
        startUrl = null,
        enrichProfiles = false,
    } = input;
    const maxResults = parseOptionalPositiveInteger(inputMaxResults);
    const maxPages = parseOptionalPositiveInteger(inputMaxPages);
    const proxyConfig = input.proxyConfiguration
        ? await Actor.createProxyConfiguration(input.proxyConfiguration)
        : undefined;

    const searchUrl = await buildSearchUrl(
        { startUrl, searchLocation, locationIdentifier, radius, brandName, branchType },
        proxyConfig
    );

    log.info("Starting Rightmove Agent Scraper");
    log.info(`Search URL: ${searchUrl}`);
    log.info(
        `Config: maxResults=${maxResults ?? "unbounded"}, maxPages=${maxPages ?? "unbounded"}, branchType=${branchType || "ALL"}, enrichProfiles=${enrichProfiles}`
    );

    let agentsScraped = 0;
    let searchPagesProcessed = 0;
    let flushedBatchCount = 0;
    let maxReportedTotalAgents = 0;
    let repeatedLastPageDetected = false;
    let lastStopReason = "results_exhausted";
    let expandedSeedCount = 0;

    const agentIds = new Set();
    const pushedAgentIds = new Set();
    const agentDataBatch = [];
    const visitedSearchSeeds = new Set();
    const queuedSearchSeeds = new Set([normalizeSearchSeedUrl(searchUrl)]);
    const searchSeedQueue = [{ url: normalizeSearchSeedUrl(searchUrl), depth: 0, referer: RIGHTMOVE_HOME_URL }];

    const pushBatch = async () => {
        await flushAgentDataBatch(agentDataBatch, {
            onFlush: async (toPush) => {
                flushedBatchCount += 1;
                log.info(`Pushed batch ${flushedBatchCount}: ${toPush.length} agents`);
            },
        });
    };

    const bufferAgents = async (records) => {
        for (const record of records) {
            if (!record?.agentId) continue;
            if (pushedAgentIds.has(String(record.agentId))) continue;
            pushedAgentIds.add(String(record.agentId));
            agentDataBatch.push(record);
        }

        if (agentDataBatch.length >= DATASET_BATCH_SIZE) await pushBatch();
    };

    const processLeafPageRecords = async (listingAgents, referer) => {
        if (!listingAgents.length) return;

        if (!enrichProfiles) {
            const finalAgents = listingAgents.map((listingAgent) =>
                pruneNullishDeep({
                    ...listingAgent,
                    scrapedAt: new Date().toISOString(),
                    extractionMethod: "next-data",
                })
            );
            await bufferAgents(finalAgents);
            return;
        }

        for (const chunk of chunkArray(listingAgents, PROFILE_CONCURRENCY)) {
            const enrichedAgents = await Promise.all(
                chunk.map((listingAgent) => fetchProfileRecord({ listingAgent, proxyConfig, referer }))
            );
            await bufferAgents(enrichedAgents);
        }
    };

    while (searchSeedQueue.length > 0 && !hasReachedLimit(agentsScraped, maxResults)) {
        const seed = searchSeedQueue.shift();
        const seedUrl = normalizeSearchSeedUrl(seed.url);
        if (visitedSearchSeeds.has(seedUrl)) continue;
        visitedSearchSeeds.add(seedUrl);

        let currentUrl = seedUrl;
        let pageNumber = 1;
        let pagesWithinSeed = 0;
        let currentReferer = seed.referer || RIGHTMOVE_HOME_URL;
        while (!hasReachedLimit(agentsScraped, maxResults)) {
            let pageData;
            try {
                pageData = await fetchSearchResultsPage({
                    url: currentUrl,
                    proxyConfig,
                    referer: currentReferer,
                });
            } catch (error) {
                log.info(`Retrying ${currentUrl} after fetch error: ${error.message}`);
                lastStopReason = "search_fetch_failed";
                break;
            }

            searchPagesProcessed += 1;
            pagesWithinSeed += 1;

            const { agents: rawAgents, pagination, results } = pageData;
            const reportedTotalAgents = parseOptionalPositiveInteger(
                pagination?.totalAgents
                ?? pagination?.numberOfAgents
                ?? pagination?.totalResults
                ?? pagination?.totalCount
                ?? pagination?.total
                ?? results?.agentsData?.total
            );
            if (reportedTotalAgents !== null) {
                maxReportedTotalAgents = Math.max(maxReportedTotalAgents, reportedTotalAgents);
            }

            if (pageNumber === 1) {
                const sidebarLinks = extractSidebarEstateAgentLinks(results, currentUrl);
                if (shouldExpandSearchSeed({ totalAgents: reportedTotalAgents, sidebarLinks, depth: seed.depth, maxResults })) {
                    let enqueuedChildren = 0;
                    for (const childUrl of sidebarLinks) {
                        const normalizedChildUrl = normalizeSearchSeedUrl(childUrl);
                        if (visitedSearchSeeds.has(normalizedChildUrl) || queuedSearchSeeds.has(normalizedChildUrl)) continue;

                        searchSeedQueue.push({
                            url: normalizedChildUrl,
                            depth: seed.depth + 1,
                            referer: currentUrl,
                        });
                        queuedSearchSeeds.add(normalizedChildUrl);
                        enqueuedChildren += 1;
                    }

                    if (enqueuedChildren > 0) {
                        expandedSeedCount += 1;
                        log.info(`Expanded ${currentUrl} into ${enqueuedChildren} child search seeds`);
                    }
                }
            }

            if (!rawAgents.length) {
                log.info(`No agents found in structured page data for ${currentUrl}`);
                lastStopReason = "results_exhausted";
                break;
            }

            let newAgentsFound = 0;
            const listingAgents = [];
            for (const raw of rawAgents) {
                if (hasReachedLimit(agentsScraped, maxResults)) break;

                const listingAgent = normalizeSearchAgent(raw, branchType);
                if (!listingAgent?.agentId || !listingAgent?.url) continue;
                if (agentIds.has(listingAgent.agentId)) continue;

                agentIds.add(listingAgent.agentId);
                agentsScraped += 1;
                newAgentsFound += 1;
                listingAgents.push(listingAgent);
            }

            await processLeafPageRecords(listingAgents, currentUrl);

            if (
                pagesWithinSeed >= MAX_SEARCH_PAGES_PER_SEED
                || hasReachedLimit(agentsScraped, maxResults)
            ) {
                lastStopReason = hasReachedLimit(agentsScraped, maxResults) ? "target_reached" : "seed_page_limit_reached";
                break;
            }

            if (!hasNextSearchPage({ pagination, rawAgents, pageNumber, maxPages, newAgentsFound })) {
                if (hasReachedLimit(pageNumber, maxPages)) lastStopReason = "max_pages_reached";
                else if (newAgentsFound === 0 && pageNumber > 1) {
                    repeatedLastPageDetected = true;
                    lastStopReason = "repeated_last_page";
                } else {
                    lastStopReason = "results_exhausted";
                }
                break;
            }

            const urlObj = new URL(currentUrl);
            const currentIndex = parseInt(urlObj.searchParams.get("index") || "0", 10) || 0;
            const indexFirstAgent = pagination?.indexFirstAgent ?? null;
            const indexLastAgent = pagination?.indexLastAgent ?? null;
            const inferredPageSize =
                typeof indexFirstAgent === "number" && typeof indexLastAgent === "number"
                    ? Math.max(1, indexLastAgent - indexFirstAgent + 1)
                    : null;
            const pageSize = inferredPageSize || (rawAgents.length || DEFAULT_AGENTS_PER_PAGE);
            const nextIndex = currentIndex + pageSize;

            currentReferer = currentUrl;
            urlObj.searchParams.set("index", String(nextIndex));
            currentUrl = urlObj.toString();
            pageNumber += 1;
        }
    }

    if (agentDataBatch.length > 0) {
        await flushAgentDataBatch(agentDataBatch, {
            force: true,
            onFlush: async (toPush) => {
                flushedBatchCount += 1;
                log.info(`Pushed batch ${flushedBatchCount}: ${toPush.length} agents`);
            },
        });
    }

    if (hasReachedLimit(agentsScraped, maxResults)) {
        lastStopReason = "target_reached";
    } else if (repeatedLastPageDetected && maxReportedTotalAgents > pushedAgentIds.size) {
        lastStopReason = "repeated_last_page";
    }

    const completionNote =
        repeatedLastPageDetected && maxReportedTotalAgents > pushedAgentIds.size
            ? ` Search pagination repeated the last accessible page after ${pushedAgentIds.size} agents while reporting ${maxReportedTotalAgents} total.`
            : "";

    log.info("Completed");
    log.info(
        `Agents targeted: ${agentsScraped}, Unique: ${agentIds.size}, Search pages: ${searchPagesProcessed}, Expanded seeds: ${expandedSeedCount}, Pushed: ${pushedAgentIds.size}, Batches: ${flushedBatchCount}, Stop reason: ${lastStopReason}.${completionNote}`
    );

    await Actor.setValue("OUTPUT", {
        status: "success",
        agentsTargeted: agentsScraped,
        uniqueAgents: agentIds.size,
        searchPagesProcessed,
        expandedSeeds: expandedSeedCount,
        pushed: pushedAgentIds.size,
        reportedTotalAgents: maxReportedTotalAgents || null,
        stopReason: lastStopReason,
        repeatedLastPageDetected,
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
