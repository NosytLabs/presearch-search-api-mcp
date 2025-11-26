# 🔍 Presearch MCP Server

[![Presearch](https://img.shields.io/badge/Presearch-Decentralized%20Search-blue?logo=presearch)](https://presearch.io/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-green)](https://modelcontextprotocol.io/)
[![Smithery](https://smithery.ai/badge/@NosytLabs/presearch-search-api-mcp)](https://smithery.ai/server/@NosytLabs/presearch-search-api-mcp)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/presearch-mcp-server.svg)](https://badge.fury.io/js/presearch-mcp-server)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)

<a href="https://presearch.com/signup?rid=4779685" target="_blank">
  <img src="https://assets.presearch.com/referral/ban-4.jpg" title="Presearch" alt="presearch" />
</a>

> **The Ultimate Privacy-First Search Integration for AI Agents**
> Empower your AI with decentralized, uncensored web search capabilities through the Model Context Protocol (MCP).

<a href="https://smithery.ai/deploy?repository=https://github.com/NosytLabs/presearch-search-api-mcp" target="_blank">
  <img src="https://smithery.ai/button/deploy-on-smithery" alt="Deploy on Smithery" height="40" />
</a>

## 🌟 Overview

The **Presearch MCP Server** is a professional-grade integration bridge that connects AI assistants (like Claude, Cursor, and Trae) to the **Presearch decentralized search engine**.

Unlike traditional search APIs that track user behavior, Presearch offers a decentralized, privacy-centric alternative. This server enables your AI to:
- **Search anonymously**: No IP tracking or search history logging.
- **Scrape intelligently**: Extract clean content from modern, dynamic websites.
- **Research deeply**: Perform multi-step investigations autonomously.
- **Monitor Nodes**: Track the status and earnings of Presearch nodes.

---

## 🛡️ What is Presearch?

Presearch is a decentralized search engine built on blockchain technology that rewards community members with Presearch tokens (PRE) for their usage, contribution to, and promotion of the platform.

### Why it matters for AI:
1.  **Uncensored Access**: Results are not filtered by a central authority, giving your AI a more complete view of the web.
2.  **Privacy**: Your AI's queries (and by extension, your proprietary data) are not profiled by ad-tech giants.
3.  **Community Nodes**: The search index is powered by independent nodes run by community members, ensuring resilience and distributed control.

---

## 💡 Key Features

### 🛡️ Privacy & Security
- **Decentralized Infrastructure**: Leverages Presearch's distributed node network.
- **Bearer Token Auth**: Secure, standard authentication for API access.
- **No Data Persistence**: The server is stateless; no user queries are stored on disk.

### 🔧 Robust Tooling
- **Deep Research Mode**: Recursive search and analysis capabilities.
- **Smart Scraping**: Headless browser integration to scrape dynamic JS-heavy websites.
- **Flexible Input Handling**: Tools accept JSON strings and loose types for maximum compatibility with LLMs.
- **Multi-Format Export**: Export results to JSON, CSV, Markdown, HTML, or PDF.

### 🚀 Enterprise Ready
- **Intelligent Caching**: Configurable TTL and memory limits.
- **Rate Limiting & Retries**: Robust error handling with exponential backoff.
- **Health Monitoring**: Real-time status checks for API connectivity.

---

## 🛠️ Available Tools

| Tool Name | Description | Key Parameters |
|-----------|-------------|----------------|
| **`presearch_ai_search`** | Standard web search optimized for AI. | `query`, `count`, `safesearch`, `freshness`, `content_categories` |
| **`presearch_deep_research`** | Autonomous multi-step research agent. | `query`, `depth`, `breadth`, `focus`, `location` |
| **`presearch_search_and_scrape`** | Search and immediately scrape top results. | `query`, `scrape_count`, `include_text`, `location` |
| **`presearch_scrape`** | Scrape content from specific URLs. | `urls`, `include_text`, `timeout_ms` |
| **`presearch_content_analysis`** | Analyze content quality and relevance. | `content`, `include_quality_assessment`, `custom_keywords` |
| **`presearch_export`** | Export search results to files. | `count`, `format` (json/csv/md/html/pdf), `file_output` |
| **`presearch_node_status`** | Monitor Presearch node health. | `node_api_key`, `stats`, `connected`, `include_inactive` |
| **`presearch_cache_stats`** | View internal cache metrics. | (None) |

> **Note**: All tools support robust input parsing. Parameters can be passed as native types (numbers, booleans, arrays) or as strings/JSON strings (e.g., `"true"`, `"10"`, `"['url1', 'url2']"`).

---

## ⚙️ Configuration

The server can be configured via environment variables or MCP settings.

| Variable | Description | Default |
|----------|-------------|---------|
| `PRESEARCH_API_KEY` | Your Presearch API Key (Required). | - |
| `PRESEARCH_BASE_URL` | API Endpoint URL. | `https://na-us-1.presearch.com` |
| `PRESEARCH_TIMEOUT` | Request timeout in ms. | `10000` |
| `LOG_LEVEL` | Logging verbosity (`info`, `debug`, `error`). | `info` |

### JSON Configuration Schema
When using Smithery or an MCP client, the configuration object supports:
```json
{
  "apiKey": "YOUR_KEY",
  "rateLimit": {
    "maxRequests": 100,
    "windowMs": 60000
  },
  "cache": {
    "enabled": true,
    "ttl": 300
  },
  "search": {
    "defaultSafeSearch": "moderate",
    "defaultLanguage": "en-US"
  }
}
```

---

## 🚀 Quick Start

### 1. Get an API Key
Sign up at [Presearch.io](https://presearch.io) to obtain your API key.

### 2. Run with npx
```bash
npx presearch-mcp-server
```

### 3. Deploy via Smithery
Use the button above or run:
```bash
npx -y @smithery/cli@latest install @NosytLabs/presearch-search-api-mcp --client claude
```

---

## 🧪 Development

### Install Dependencies
```bash
npm install
```

### Run Tests
```bash
# Run real API tests (requires .env with API key)
npm run test:real

# Run mock tool tests
npm run test:tools
```

### Build & Lint
```bash
npm run lint
npm run format
```

---

## 📜 License
MIT © [Presearch MCP Team](https://github.com/NosytLabs)
