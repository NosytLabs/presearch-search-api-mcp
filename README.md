<div align="center">
  <h1>🔍 Presearch MCP Server</h1>

  <p>
    <a href="https://smithery.ai/server/@NosytLabs/presearch-search-api-mcp"><img src="https://smithery.ai/badge/@NosytLabs/presearch-search-api-mcp" alt="Smithery Badge" /></a>
    <a href="https://presearch.io/"><img src="https://img.shields.io/badge/Presearch-Decentralized%20Search-blue?logo=presearch" alt="Presearch" /></a>
    <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/MCP-Model%20Context%20Protocol-green" alt="MCP" /></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License" /></a>
    <a href="https://badge.fury.io/js/presearch-mcp-server"><img src="https://badge.fury.io/js/presearch-mcp-server.svg" alt="npm version" /></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen" alt="Node.js" /></a>
  </p>

  <a href="https://presearch.com/signup?rid=4779685" target="_blank">
    <img src="https://assets.presearch.com/referral/ban-4.jpg" title="Presearch" alt="Presearch Banner" />
  </a>

  <h3>🔐 Privacy-First AI Search Integration</h3>
  <p><strong>Empower your AI with decentralized, uncensored web search capabilities through the Model Context Protocol (MCP).</strong></p>

  <a href="https://smithery.ai/server/@NosytLabs/presearch-search-api-mcp" target="_blank">
    <img src="https://smithery.ai/button/deploy-on-smithery" alt="Deploy on Smithery" height="40" />
  </a>
</div>

---

## 🌟 Overview

The **Presearch MCP Server** is a professional-grade integration bridge that connects AI assistants (like Claude, Cursor, and Trae) to the **Presearch decentralized search engine**.

Unlike traditional search APIs that track user behavior, Presearch offers a decentralized, privacy-centric alternative. This server enables your AI to:

<div align="center">

| 🛡️ **Search Anonymously** | 🔍 **Scrape Intelligently** | 🧠 **Research Deeply** | 📊 **Monitor Nodes** |
|:--:|:--:|:--:|:--:|
| No IP tracking or search history logging | Extract clean content from modern, dynamic websites | Perform multi-step investigations autonomously | Track the status and earnings of Presearch nodes |

</div>

---

## 🛡️ What is Presearch?

Presearch is a **decentralized search engine** built on blockchain technology that rewards community members with Presearch tokens (PRE) for their usage, contribution to, and promotion of the platform.

### Why Presearch Matters for AI

<div align="center">

| 🚫 **Uncensored Access** | 🔒 **Privacy Protection** | 🌐 **Community Infrastructure** |
|:--:|:--:|:--:|
| Results are not filtered by central authorities | Your AI's queries are not profiled by ad-tech giants | Search index powered by independent community nodes |
| Complete view of the web | Proprietary data remains private | Resilient, distributed control |

</div>

---

## 💡 Key Features

### 🛡️ Privacy & Security
- **Decentralized Infrastructure**: Leverages Presearch's distributed node network
- **Bearer Token Auth**: Secure, standard authentication for API access
- **No Data Persistence**: The server is stateless; no user queries are stored on disk

### 🔧 Robust Tooling
- **Deep Research Mode**: Recursive search and analysis capabilities
- **Smart Scraping**: Headless browser integration to scrape dynamic JS-heavy websites
- **Flexible Input Handling**: Tools accept JSON strings and loose types for maximum compatibility with LLMs
- **Multi-Format Export**: Export results to JSON, CSV, Markdown, HTML, or PDF

### 🚀 Enterprise Ready
- **Intelligent Caching**: Configurable TTL and memory limits
- **Rate Limiting & Retries**: Robust error handling with exponential backoff
- **Health Monitoring**: Real-time status checks for API connectivity

---

## 🛠️ Available Tools

<div align="center">

| Tool Name | Description | Key Parameters |
|:----------|:------------|:---------------|
| **`presearch_ai_search`** | Standard web search optimized for AI | `query`, `count`, `safesearch`, `freshness`, `content_categories` |
| **`presearch_deep_research`** | Autonomous multi-step research agent | `query`, `depth`, `breadth`, `focus`, `location` |
| **`presearch_search_and_scrape`** | Search and immediately scrape top results | `query`, `scrape_count`, `include_text`, `location` |
| **`scrape_url_content`** | Scrape content from specific URLs | `urls`, `include_text`, `timeout_ms` |
| **`analyze_content`** | Analyze content quality and relevance | `content`, `include_quality_assessment`, `custom_keywords` |
| **`export_search_results`** | Export search results to files | `count`, `format` (json/csv/md/html/pdf), `file_output` |
| **`presearch_site_export`** | Advanced export with scraping and analysis | `query`, `format`, `file_output`, `include_analysis`, `scrape_content` |
| **`presearch_node_status`** | Monitor Presearch node health | `node_api_key`, `stats`, `connected`, `include_inactive` |
| **`cache_stats`** | View internal cache metrics | (None) |
| **`cache_clear`** | Clear the internal cache | (None) |
| **`presearch_health_check`** | Verify API connectivity | (None) |

</div>

> **Note**: All tools support robust input parsing. Parameters can be passed as native types (numbers, booleans, arrays) or as strings/JSON strings (e.g., `"true"`, `"10"`, `"['url1', 'url2']"`).

---

## 📝 Available Prompts

The server provides built-in prompts to help you get started with common tasks:

<div align="center">

| Prompt Name | Purpose |
|:------------|:--------|
| **`presearch-deep-dive`** | Conduct deep research on a specific topic |
| **`presearch-news`** | Find the latest news about a topic from the last 24 hours |
| **`presearch-fact-check`** | Verify a claim or statement with evidence |
| **`presearch-market-analysis`** | Analyze a market sector or product category |
| **`presearch-node-monitor`** | Check the status and earnings of your Presearch nodes |
| **`presearch-product-review`** | Research reviews and sentiment for a product |
| **`presearch-academic`** | Conduct academic research prioritizing .edu and journals |
| **`presearch-tutorial`** | Learn how to use a specific tool effectively |

</div>

---

## 📚 Resources

The server exposes the following resources for configuration and debugging:

<div align="center">

| Resource URI | Description |
|:-------------|:------------|
| **`presearch://config`** | View current server configuration (secrets masked) |
| **`presearch://rate-limits`** | Check current API rate limit status |
| **`presearch://supported-countries`** | List of supported ISO 3166-1 alpha-2 country codes |
| **`presearch://supported-languages`** | List of supported BCP 47 language codes |

</div>

---

## ⚙️ Configuration

The server can be configured via environment variables or MCP settings.

### Environment Variables

<div align="center">

| Variable | Description | Default |
|:---------|:------------|:--------|
| `PRESEARCH_API_KEY` | Your Presearch API Key (Required) | - |
| `PRESEARCH_BASE_URL` | API Endpoint URL | `https://na-us-1.presearch.com` |
| `PRESEARCH_TIMEOUT` | Request timeout in ms | `10000` |
| `LOG_LEVEL` | Logging verbosity (`info`, `debug`, `error`) | `info` |

</div>

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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

<div align="center">

| Step | Action |
|:-----|:-------|
| 1 | Fork the repository |
| 2 | Create your feature branch (`git checkout -b feature/AmazingFeature`) |
| 3 | Commit your changes (`git commit -m 'Add some AmazingFeature'`) |
| 4 | Push to the branch (`git push origin feature/AmazingFeature`) |
| 5 | Open a Pull Request |

</div>

---

<div align="center">
  <sub>Built with ❤️ for the decentralized web.</sub>
</div>

## 📜 License

MIT © [Presearch MCP Team](https://github.com/NosytLabs)