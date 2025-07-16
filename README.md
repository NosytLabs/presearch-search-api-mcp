# Presearch MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io/)

A Model Context Protocol (MCP) server that integrates Presearch's decentralized search engine with AI agents. Enables web searches, content scraping, and cache management using Presearch's privacy-focused API.

## 🚀 Features

- **Web Search**: Comprehensive searches using Presearch's decentralized API
- **Site-Specific Searches**: Target specific domains (e.g., `site:apple.com`)
- **Content Scraping**: Extract and analyze web page content
- **Intelligent Caching**: Improved performance with result caching
- **Rate Limiting**: Built-in API protection
- **MCP Compatible**: Works with any MCP-compatible AI platform

## 🛠️ Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Get Presearch API Key
1. Visit [Presearch API Portal](https://presearch.com/api)
2. Sign up or log in to your Presearch account
3. Generate a new API key for search access
4. Copy your API key for the next step

### 3. Configure Environment
Copy the example environment file and configure your settings:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Presearch API Configuration
PRESEARCH_API_KEY=your_actual_api_key_here

# Server Configuration
PORT=3001
LOG_LEVEL=info
```

**⚠️ Important**: Never commit your `.env` file to version control. Your API key should remain private.

### 4. Build and Start
```bash
npm run build
npm start
```

The server will be available at `http://localhost:3001/mcp`

## 🎯 Use Cases

- **Research**: Find academic papers, documentation, and technical resources
- **Development**: Search for code examples, API docs, and troubleshooting guides
- **Content Analysis**: Scrape and analyze web pages for data extraction
- **Market Research**: Gather competitive intelligence and industry insights

## 🔧 Available MCP Tools

### 1. `presearch_search`
Enhanced search using Presearch decentralized search engine with AI insights, entity extraction, and multiple output formats.

**Parameters:**
- `query` (string, required): The search query to execute
- `page` (number, optional): Page number for pagination (default: 1, min: 1)
- `resultsPerPage` (number, optional): Results per page (default: 10, max: 50)
- `format` (string, optional): Output format - "json" (default), "html", or "markdown"
- `lang` (string, optional): Language for results (BCP 47 format, e.g., "en-US")
- `time` (string, optional): Timeframe - "any", "day", "week", "month", "year"
- `location` (string, optional): JSON string with "lat" and "long" for location-based results
- `ip` (string, optional): IP address for geo-targeting
- `safe` (string, optional): Safe search - "1" (enabled) or "0" (disabled)
- `includeInsights` (boolean, optional): Include AI insights (default: true)
- `aiAnalysis` (boolean, optional): Enable AI-enhanced formatting (default: true)
- `extractEntities` (boolean, optional): Extract entities and keywords (default: true)

**Example:**
```json
{
  "name": "presearch_search",
  "arguments": {
    "query": "Tesla Model S electric vehicle site:tesla.com",
    "resultsPerPage": 5,
    "format": "markdown",
    "includeInsights": true
  }
}
```

### 2. `presearch_scrape_content`
Scrape a URL and convert content to markdown or HTML format using Puppeteer. Supports multiple output formats for flexible content processing.

**Parameters:**
- `url` (string, required): The URL to scrape and convert
- `format` (string, optional): Output format - "markdown" (default), "html", or "both"
- `waitTime` (number, optional): Time to wait for page load in milliseconds (default: 3000)

**Example:**
```json
{
  "name": "presearch_scrape_content",
  "arguments": {
    "url": "https://example.com/article",
    "format": "markdown",
    "waitTime": 5000
  }
}
```

### 3. `presearch_cache_stats`
Get cache statistics including hit rate, cache size, and performance metrics.

**Parameters:** None

**Example:**
```json
{
  "name": "presearch_cache_stats",
  "arguments": {}
}
```

### 4. `presearch_cache_clear`
Clear the search cache to free up memory and force fresh results.

**Parameters:**
- `pattern` (string, optional): Optional pattern to clear specific cache entries (e.g., "search:*") (default: "*")

**Example:**
```json
{
  "name": "presearch_cache_clear",
  "arguments": {
    "pattern": "search:*"
  }
}
```

## 🔗 MCP Integration

Connect to any MCP-compatible AI platform:

1. Add MCP server endpoint: `http://localhost:3001/mcp`
2. Configure available tools: `presearch_search`, `presearch_scrape_content`, `presearch_cache_stats`, `presearch_cache_clear`


## 🐛 Troubleshooting

**Server Won't Start**: Check if port 3001 is in use
**API Key Issues**: Verify `PRESEARCH_API_KEY` is set in `.env`
**Connection Refused**: Ensure server is running and firewall allows port 3001
**Search Results Empty**: Verify your Presearch API key has sufficient credits

## 🤝 Contributing

```bash
npm install
npm run dev
npm run validate
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Presearch](https://presearch.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [API Documentation](https://presearch-search-api.readme.io)