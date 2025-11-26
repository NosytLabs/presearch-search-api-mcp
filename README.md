# 🔍 Presearch MCP Server

[![smithery badge](https://smithery.ai/badge/@NosytLabs/presearch-search-api-mcp)](https://smithery.ai/server/@NosytLabs/presearch-search-api-mcp)
[![Presearch](https://img.shields.io/badge/Presearch-Decentralized%20Search-blue?logo=presearch)](https://presearch.io/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-green)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/presearch-mcp-server.svg)](https://badge.fury.io/js/presearch-mcp-server)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)
[![Powered by Presearch](https://img.shields.io/badge/Powered%20by-Presearch-blue)](https://presearch.io)

> **The Ultimate Privacy-First Search Integration for AI Agents**
> Empower your AI with decentralized, uncensored web search capabilities through the Model Context Protocol (MCP).

<a href="https://smithery.ai/deploy?repository=https://github.com/NosytLabs/presearch-search-api-mcp" target="_blank">
  <img src="https://smithery.ai/button/deploy-on-smithery" alt="Deploy on Smithery" height="40" />
</a>

## 🌟 Overview

The **Presearch MCP Server** is a professional-grade integration bridge that connects AI assistants (like Claude, Cursor, and Trae) to the **Presearch decentralized search engine**.

Designed for privacy-conscious developers and enterprises, this server enables AI agents to perform real-time web searches, scrape content, and conduct deep research without compromising user data or relying on centralized tech giants.

### Why Choose Presearch MCP?

*   **🚫 Zero Tracking**: Search queries are anonymized. No IP logging. No search history tracking.
*   **🌐 Decentralized**: Results sourced from a community-powered network, ensuring unbiased information access.
*   **🤖 AI-Optimized**: Output formats (JSON, Markdown) specifically structured for LLM consumption.
*   **⚡ High Performance**: Built-in intelligent caching (Redis-compatible) and rate limiting for enterprise reliability.

### 🔗 Quick Links
- **Repository**: [GitHub](https://github.com/NosytLabs/presearch-search-api-mcp)
- **Smithery**: [Smithery.ai](https://smithery.ai/server/@NosytLabs/presearch-search-api-mcp)
- **Presearch API**: [Developer Portal](https://presearch.io/searchapi)
- **Issues**: [Support](https://github.com/NosytLabs/presearch-search-api-mcp/issues)

---

## 💡 Use Cases

### 1. Market Intelligence & Competitor Analysis
*   **Scenario**: An AI agent needs to track competitor pricing and product launches without triggering anti-bot protections or revealing intent.
*   **Solution**: Use `presearch_search_and_scrape` to anonymously gather data from multiple sources and compile a comprehensive report.

### 2. Academic & Technical Research
*   **Scenario**: A researcher needs to find specific whitepapers and technical documentation across the web.
*   **Solution**: Use `presearch_deep_research` to perform a multi-step investigation, gathering sources, summarizing findings, and citing references automatically.

### 3. News Aggregation & Sentiment Analysis
*   **Scenario**: A financial analyst bot needs the latest news on crypto regulations.
*   **Solution**: Use `presearch_ai_search` with `freshness="day"` to pull the most recent articles and feed them into a sentiment analysis pipeline.

### 4. Content Verification & Fact-Checking
*   **Scenario**: An AI writing assistant needs to verify claims made in an article.
*   **Solution**: Use `presearch_ai_search` to find primary sources and `scrape_url_content` to extract text for cross-referencing.

---

## ✨ Key Features

### 🛡️ Privacy & Security
- **Decentralized Infrastructure**: Leverages Presearch's distributed node network.
- **Bearer Token Auth**: Secure, standard authentication for API access.
- **No Data Persistence**: The server is stateless; no user queries are stored on disk.

### 🔧 Powerful Tools
- **Deep Research Mode**: Recursive search and analysis capabilities.
- **Smart Scraping**: Headless browser integration to scrape dynamic JS-heavy websites.
- **Multi-Format Export**: Export results to JSON, CSV, Markdown, HTML, or PDF.

### 🚀 Enterprise Ready
- **Intelligent Caching**: Configurable TTL and memory limits to save API credits and speed up repeated queries.
- **Rate Limiting & Retries**: Robust error handling with exponential backoff.
- **Health Monitoring**: Real-time status checks for API connectivity and node health.

---

## 🛠️ Available Tools

| Tool Name | Description | Key Parameters |
|-----------|-------------|----------------|
| **`presearch_ai_search`** | Standard web search optimized for AI. | `query`, `count`, `safesearch`, `freshness` |
| **`presearch_deep_research`** | **NEW!** Autonomous multi-step research agent. | `query`, `depth`, `breadth`, `focus` |
| **`presearch_search_and_scrape`** | Search and immediately scrape top results. | `query`, `scrape_count`, `export_format` |
| **`scrape_url_content`** | Extract full text/HTML from specific URLs. | `urls`, `include_metadata`, `format` |
| **`content_analysis`** | Analyze text for quality, sentiment, and key topics. | `content`, `focus_areas` |
| **`export_search_results`** | Save search data to local files. | `query`, `export_format`, `file_path` |
| **`presearch_node_status`** | Check the status of Presearch nodes. | `node_api_key`, `stats` |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: Version 20.0.0 or higher
- **Presearch API Key**: [Get it here](https://presearch.io/searchapi)

### Installation

```bash
# Clone the repository
git clone https://github.com/NosytLabs/presearch-search-api-mcp.git
cd presearch-search-api-mcp

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

### Configuration
Edit `.env` file with your settings:

```env
PRESEARCH_API_KEY=your_key_here
PRESEARCH_BASE_URL=https://na-us-1.presearch.com
LOG_LEVEL=info
```

### Running the Server

#### 1. STDIO Mode (Recommended for AI Editors)
Best for Cursor, Trae, VS Code, and desktop agents.

```bash
npm run start:stdio
```

Add to your MCP config (e.g., `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "presearch": {
      "command": "node",
      "args": ["/absolute/path/to/presearch-mcp/src/index.js", "--stdio"],
      "env": {
        "PRESEARCH_API_KEY": "your-key"
      }
    }
  }
}
```

#### 2. HTTP Mode (For Remote/Docker)
Best for distributed systems or containerized deployments.

```bash
npm start
```

#### 3. Docker Deployment
```bash
docker build -t presearch-mcp .
docker run -p 3000:3000 -e PRESEARCH_API_KEY=your_key presearch-mcp
```

---

## 🧪 Testing

We provide a comprehensive test suite to ensure reliability.

```bash
# 1. Standard Unit Tests (Mocked)
npm test

# 2. Real API Integration Tests
# WARNING: Consumes API credits. Requires valid .env file.
npm run test:real

# 3. Tool-Specific Functional Tests
# Verifies Scraper, Analyzer, and Health checks
npm run test:tools

# 4. Coverage Report
npm run test:coverage
```

---

## ❓ Troubleshooting

**Q: I get "Unauthorized" errors.**
A: Check that your `PRESEARCH_API_KEY` in `.env` is correct and has not expired.

**Q: Search results are empty.**
A: Verify your internet connection and try a broader query. Ensure `PRESEARCH_BASE_URL` is reachable.

**Q: Scraping fails on some sites.**
A: Some websites block automated scrapers. The tool uses a headless browser to mitigate this, but extremely strict sites may still block access.

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

<div align="center">
  <sub>Built with ❤️ for the decentralized web.</sub>
</div>