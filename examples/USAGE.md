# Presearch MCP Tool Usage Examples

This guide provides JSON-RPC example payloads for calling the Presearch MCP tools. These examples demonstrate how an AI assistant (like Claude or Trae) interacts with the server.

## 1. Search (Standard)

**Tool:** `presearch_ai_search`
**Goal:** Find information about a topic.

```json
{
  "name": "presearch_ai_search",
  "arguments": {
    "query": "latest developments in solid state batteries",
    "limit": 5,
    "safe_search": true,
    "include_analysis": true
  }
}
```

## 2. Deep Research (Autonomous)

**Tool:** `presearch_deep_research`
**Goal:** Conduct a comprehensive multi-step investigation.

```json
{
  "name": "presearch_deep_research",
  "arguments": {
    "query": "market analysis of commercial space flight 2024-2030",
    "depth": 3,
    "breadth": 10,
    "research_focus": "market",
    "freshness": "year"
  }
}
```

## 3. Search & Scrape (Fast)

**Tool:** `presearch_search_and_scrape`
**Goal:** Search and immediately get content from top results (saves round-trips).

```json
{
  "name": "presearch_search_and_scrape",
  "arguments": {
    "query": "python 3.12 new features tutorial",
    "limit": 3,
    "exclude_domains": ["pinterest.com", "reddit.com"]
  }
}
```

## 4. Scrape URL

**Tool:** `scrape_url`
**Goal:** Extract clean text from a specific webpage.

```json
{
  "name": "scrape_url",
  "arguments": {
    "url": "https://docs.python.org/3/whatsnew/3.12.html",
    "format": "markdown",
    "onlyMainContent": true
  }
}
```

## 5. Site Export

**Tool:** `presearch_site_export`
**Goal:** Crawl a site and export content to JSON or Markdown.

```json
{
  "name": "presearch_site_export",
  "arguments": {
    "url": "https://example.com/blog",
    "format": "markdown",
    "recursive": true,
    "depth": 2
  }
}
```

## 6. Export Results

**Tool:** `export_search_results`
**Goal:** Format a list of results into CSV or HTML.

```json
{
  "name": "export_search_results",
  "arguments": {
    "results": [
      { "title": "Example 1", "url": "https://example.com/1" },
      { "title": "Example 2", "url": "https://example.com/2" }
    ],
    "format": "csv"
  }
}
```

## 7. Node Status

**Tool:** `presearch_node_status`
**Goal:** Check the health of a Presearch node.

```json
{
  "name": "presearch_node_status",
  "arguments": {
    "node_api_key": "YOUR_NODE_KEY",
    "stats": true
  }
}
```
