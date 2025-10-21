# Presearch MCP Server

[![npm version](https://badge.fury.io/js/presearch-mcp-server.svg)](https://badge.fury.io/js/presearch-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io/)

A Model Context Protocol (MCP) server that provides seamless integration with the Presearch API, enabling privacy-focused search capabilities and web scraping functionality for AI assistants.

## Features

- 🔍 **Privacy-focused search** through Presearch API
- 🌐 **Web content scraping** with intelligent extraction
- 🔌 **MCP Protocol compliance** for seamless AI assistant integration
- 📊 **Search result caching** for improved performance
- 🛡️ **Configurable safe search** options
- 🗂️ **Multiple export formats** (JSON, CSV, Markdown)
- 🌍 **Multi-language support** for search and UI
- 📈 **Performance insights** and analytics

## Installation

```bash
npm install presearch-mcp-server
```

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/NosytLabs/presearch-search-api-mcp.git
cd presearch-search-api-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Copy and configure the environment variables:
```bash
cp .env.example .env
# Edit .env with your Presearch API key and other settings
```

4. Start the server:
```bash
npm start
```

## MCP Configuration

To use this server with an MCP client, add the following to your MCP client configuration:

```json
{
  "mcpServers": {
    "presearch": {
      "command": "node",
      "args": ["path/to/presearch-mcp-server/src/server/server.js"]
    }
  }
}
```

## Available Tools

### Search Tools

#### `search`
Perform a search query using the Presearch API.

**Parameters:**
- `query` (string, required): Search query
- `ip` (string, required): IP address of the user
- `count` (number, optional): Number of results (1-20, default 10)
- `offset` (number, optional): Pagination offset (default 0)
- `country` (string, optional): Country code (e.g., US, GB)
- `search_lang` (string, optional): Search language (e.g., en, es)
- `ui_lang` (string, optional): UI language (e.g., en-US)
- `safesearch` (string, optional): Safe search level (off, moderate, strict)
- `freshness` (string, optional): Time filter (pd, pw, pm, py)
- `useCache` (boolean, optional): Whether to use cached results

**Example:**
```javascript
{
  "query": "Model Context Protocol",
  "ip": "192.168.1.1",
  "count": 5,
  "search_lang": "en",
  "safesearch": "moderate"
}
```

#### `export_results`
Export search results in different formats.

**Parameters:**
- `query` (string, required): Search query to export
- `ip` (string, required): IP address of the user
- `format` (string, required): Export format (json, csv, markdown)
- `count` (number, optional): Number of results to export
- `country` (string, optional): Country code for search

### Web Scraping Tools

#### `scrape_content`
Extract content from a web page.

**Parameters:**
- `url` (string, required): URL to scrape content from
- `extractText` (boolean, optional): Extract text content
- `extractLinks` (boolean, optional): Extract links
- `extractImages` (boolean, optional): Extract images
- `includeMetadata` (boolean, optional): Include page metadata

### Cache Management Tools

#### `cache_stats`
Get statistics about the search result cache.

#### `cache_clear`
Clear the search result cache.

#### `health_check`
Check the health status of the MCP server.

## Usage Examples

### Basic Search

```javascript
const searchResults = await client.call("search", {
  "query": "artificial intelligence",
  "ip": "192.168.1.1",
  "count": 10,
  "search_lang": "en"
});
```

### Web Scraping

```javascript
const pageContent = await client.call("scrape_content", {
  "url": "https://example.com",
  "extractText": true,
  "extractLinks": true,
  "includeMetadata": true
});
```

### Export to CSV

```javascript
const csvExport = await client.call("export_results", {
  "query": "machine learning",
  "ip": "192.168.1.1",
  "format": "csv",
  "count": 50
});
```

## Configuration

The server can be configured using environment variables or a configuration file:

### Environment Variables

- `PRESEARCH_API_KEY`: Your Presearch API key (required)
- `SERVER_HOST`: Host address for the MCP server (default: localhost)
- `SERVER_PORT`: Port for the MCP server (default: 3000)
- `CACHE_SIZE`: Maximum number of cached results (default: 100)
- `CACHE_TTL`: Cache time-to-live in seconds (default: 3600)
- `LOG_LEVEL`: Logging level (error, warn, info, debug)

### Configuration File

Create a `config/config.json` file with the following structure:

```json
{
  "presearch": {
    "apiKey": "your-api-key",
    "defaultCountry": "US",
    "defaultLanguage": "en",
    "safeSearch": "moderate"
  },
  "server": {
    "host": "localhost",
    "port": 3000
  },
  "cache": {
    "enabled": true,
    "maxSize": 100,
    "ttl": 3600
  },
  "logging": {
    "level": "info"
  }
}
```

## Testing

Run the test suite:

```bash
# Run basic tests
npm test

# Run MCP protocol tests
npm run test:mcp

# Run all tests
npm run test:all
```

## Development

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit them: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## API Reference

For detailed API documentation, see the [API Reference](./docs/api-reference.md).

## Contributing

We welcome contributions! Please see our [Contributing Guide](./docs/contributing.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Support

- 🐛 [Report Issues](https://github.com/NosytLabs/presearch-search-api-mcp/issues)
- 📖 [Documentation](https://github.com/NosytLabs/presearch-search-api-mcp/wiki)
- 💬 [Discussions](https://github.com/NosytLabs/presearch-search-api-mcp/discussions)

## Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Presearch](https://presearch.com/)

#presearch #mcp
