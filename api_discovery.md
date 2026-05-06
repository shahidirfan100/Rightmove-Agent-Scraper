# API Discovery: Rightmove Agent Scraper

This document outlines the structured data discovery process used by the Rightmove Agent Scraper to ensure high-performance and resilient data extraction.

## Data Source Identification

The scraper leverages Rightmove's modern frontend architecture (Next.js) to access structured JSON data directly from the page source, avoiding the fragility of traditional CSS selectors.

### Primary Data Source: `__NEXT_DATA__`

Rightmove embeds its application state within a `<script>` tag identified by `id="__NEXT_DATA__"`. This JSON blob contains the complete, hydrated state of the page, including:

- **Agent Lists**: Comprehensive branch details, contact info, and branding assets.
- **Pagination**: Structured metadata for navigating multiple pages of results.
- **Profile Details**: Deep branch descriptions, industry affiliations, and service offerings.

## Extraction Logic & Resilience

The Actor uses a discovery-first approach to locate data within the deeply nested JSON structure.

### Robust Path Resolution

Instead of relying on hardcoded paths that break when Rightmove updates their UI, the Actor implements a recursive search pattern (`findDeepObject`) to locate key data entities:

- **Agent Profiles**: Identified by the presence of `branchId`, `branchName`, and `branchAddress`.
- **Search Results**: Dynamically located within the `pageProps` hierarchy.

### Automatic Endpoint Fallbacks

The scraper is designed to handle various response structures:
1. **Direct Path**: Tries known high-priority paths in the Next.js state.
2. **Deep Search**: Performs a structural scan if direct paths are moved or renamed.
3. **Hybrid Extraction**: Merges listing data with full profile details when enrichment is enabled.

## API-First Performance

By targeting the structured state directly:
- **Speed**: Extraction happens instantly after the HTML is received, without waiting for complex DOM parsing or rendering.
- **Accuracy**: Data is retrieved in its raw, typed format (Strings, Booleans, Objects) directly from the source.
- **Stability**: The Actor is resistant to visual changes, CSS class renames, or layout shifts.

## Maintenance & Updates

The discovery process is monitored for structural shifts. If Rightmove significantly alters the `__NEXT_DATA__` schema, the Actor's deep-search logic acts as an "auto-healing" mechanism to maintain data continuity.
