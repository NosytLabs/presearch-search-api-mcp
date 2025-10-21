# Presearch Search API MCP Server

[![npm version](https://badge.fury.io/js/presearch-search-api-mcp.svg)](https://badge.fury.io/js/presearch-search-api-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/NosytLabs/presearch-search-api-mcp/workflows/CI/badge.svg)](https://github.com/NosytLabs/presearch-search-api-mcp/actions)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io/)

A Model Context Protocol (MCP) server that provides search capabilities through the Presearch API, enabling AI assistants to perform web searches with privacy-focused, decentralized search technology.

## About Presearch

Presearch is a decentralized search engine that rewards users for searching and is powered by the community. Unlike traditional search engines that track your data, Presearch respects your privacy while delivering high-quality search results from multiple sources.

Key features of Presearch:

- **Privacy-focused**: No tracking or selling of your personal data
- **Decentralized**: Powered by community nodes around the world
- **Rewards system**: Users earn PRE tokens for their search activity
- **Open source**: Transparent and community-driven
- **Multiple search providers**: Combines results from various search engines

## Features

- ✅ Perform web searches through Presearch's API
- ✅ Export search results in multiple formats (JSON, CSV, Markdown)
- ✅ Web content scraping capabilities
- ✅ Configurable search parameters (country, language, safe search)
- ✅ Built-in caching for improved performance
- ✅ Full MCP protocol compliance
- ✅ Referral system integration
- ✅ Smithery AI compatibility

## Installation

### Prerequisites

- Node.js 18+ or Docker
- Presearch API key (see setup below)

### Using npm

```bash
npm install -g presearch-search-api-mcp
```

### Using Docker

```bash
docker pull nosyt/presearch-search-api-mcp:latest
```

## Setup

### 1. Get a Presearch API Key

To use the Presearch Search API, you need to obtain an API key:

1. Create an account at [Presearch](https://presearch.com/signup) if you don't have one
2. Navigate to [Presearch Extensions](https://presearch.org/extensions)
3. Sign up for the Search API service
4. Generate your API key from the dashboard
5. Note your API key for the next steps

### 2. Configure the MCP Server

Create a configuration file (e.g., `presearch-mcp-config.json`):

```json
{
  "apiKey": "your-presearch-api-key",
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

### 3. Run the Server

#### Direct Execution

```bash
npx presearch-search-api-mcp --config path/to/your/config.json
```

#### Using Docker

```bash
docker run -p 3000:3000 -v $(pwd)/config.json:/app/config.json nosyt/presearch-search-api-mcp:latest
```

## Configuration

### Environment Variables

You can also configure the server using environment variables:

```bash
export PRESEARCH_API_KEY="your-api-key"
export SERVER_HOST="localhost"
export SERVER_PORT="3000"
export CACHE_ENABLED="true"
export CACHE_MAX_SIZE="100"
export CACHE_TTL="3600"
export LOG_LEVEL="info"
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | - | Your Presearch API key (required) |
| `server.host` | string | localhost | Server host address |
| `server.port` | number | 3000 | Server port |
| `cache.enabled` | boolean | true | Enable result caching |
| `cache.maxSize` | number | 100 | Maximum cache size |
| `cache.ttl` | number | 3600 | Cache TTL in seconds |
| `logging.level` | string | info | Logging level (debug, info, warn, error) |

## Usage

### Basic Search

```javascript
// Using MCP client
const results = await client.call('search', {
  query: 'artificial intelligence',
  ip: '192.168.1.1',
  count: 10
});
```

### Advanced Search with Parameters

```javascript
const results = await client.call('search', {
  query: 'machine learning',
  ip: '192.168.1.1',
  count: 20,
  country: 'US',
  search_lang: 'en',
  ui_lang: 'en-US',
  safesearch: 'moderate',
  freshness: 'pm',
  useCache: true
});
```

### Export Results

```javascript
// Export to JSON
const jsonResults = await client.call('export_results', {
  query: 'climate change',
  ip: '192.168.1.1',
  format: 'json',
  count: 50,
  country: 'CA'
});

// Export to CSV
const csvResults = await client.call('export_results', {
  query: 'renewable energy',
  ip: '192.168.1.1',
  format: 'csv',
  count: 100
});

// Export to Markdown
const mdResults = await client.call('export_results', {
  query: 'web development',
  ip: '192.168.1.1',
  format: 'markdown',
  count: 25
});
```

### Web Content Scraping

```javascript
// Scrape page content
const content = await client.call('scrape_content', {
  url: 'https://example.com/article',
  extractText: true,
  extractLinks: true,
  extractImages: true,
  includeMetadata: true
});
```

## Presearch Referral System

Presearch offers a referral program that rewards users for bringing new members to the platform. When using this MCP server, you can:

1. **Use your own referral code**: Configure the server with your Presearch referral code
2. **Earn PRE tokens**: Get rewarded when new users sign up through your referral
3. **Support development**: Help fund continued development of this MCP server

### Setting Up Referral

Add your referral code to your configuration:

```json
{
  "apiKey": "your-presearch-api-key",
  "referralCode": "your-referral-code",
  // ... other config
}
```

To get your referral code:
1. Log in to your [Presearch account](https://presearch.com/login)
2. Navigate to the Referral section
3. Copy your unique referral code

## Smithery AI Integration

This MCP server is fully compatible with Smithery AI, allowing you to enhance your AI assistants with web search capabilities:

### Setting up with Smithery AI

1. Install the MCP server in your Smithery environment:
   ```bash
   npm install presearch-search-api-mcp
   ```

2. Add the server to your Smithery configuration:
   ```json
   {
     "mcpServers": {
       "presearch": {
         "command": "npx",
         "args": ["presearch-search-api-mcp", "--config", "path/to/config.json"]
       }
     }
   }
   ```

3. Restart your Smithery AI instance

### Using with Smithery AI

Once configured, you can use the search capabilities in your Smithery AI conversations:

- Ask your AI to search for current information
- Request web content analysis
- Get up-to-date data for your queries

## API Reference

### Search

Performs a web search using the Presearch API.

**Parameters:**
- `query` (string, required): Search query
- `ip` (string, required): User IP address
- `count` (number, optional): Number of results (1-20, default 10)
- `offset` (number, optional): Pagination offset (default 0)
- `country` (string, optional): Country code (e.g., US, GB)
- `search_lang` (string, optional): Search language (e.g., en, es)
- `ui_lang` (string, optional): UI language (e.g., en-US)
- `safesearch` (string, optional): Safe search level (off, moderate, strict)
- `freshness` (string, optional): Time filter (pd, pw, pm, py)
- `useCache` (boolean, optional): Whether to use cached results

**Returns:**
An array of search results with titles, descriptions, URLs, and metadata.

### Export Results

Exports search results in the specified format.

**Parameters:**
- `query` (string, required): Search query
- `ip` (string, required): User IP address
- `format` (string, required): Export format (json, csv, markdown)
- `count` (number, optional): Number of results to export
- `country` (string, optional): Country code for search

**Returns:**
Formatted search results in the specified format.

### Scrape Content

Extracts content from a web page.

**Parameters:**
- `url` (string, required): URL to scrape content from
- `extractText` (boolean, optional): Extract text content
- `extractLinks` (boolean, optional): Extract links
- `extractImages` (boolean, optional): Extract images
- `includeMetadata` (boolean, optional): Include page metadata

**Returns:**
Structured content from the specified web page.

### Cache Management

#### Cache Stats

Returns statistics about the current cache state.

```javascript
const stats = await client.call('cache_stats');
```

#### Clear Cache

Clears all cached search results.

```javascript
await client.call('cache_clear');
```

#### Health Check

Checks the health status of the MCP server.

```javascript
const health = await client.call('health_check');
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

## Contributing

We welcome contributions! Please see our [Contributing Guide](./docs/contributing.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Support

- 🐛 [Report Issues](https://github.com/NosytLabs/presearch-search-api-mcp/issues)
- 📖 [Documentation](https://github.com/NosytLabs/presearch-search-api-mcp/wiki)
- 💬 [Discussions](https://github.com/NosytLabs/presearch-search-api-mcp/discussions)
- 📧 [Email Support](mailto:support@nosyt.com)

## Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Presearch](https://presearch.com/)
- [Smithery AI](https://smithery.ai/)

## Acknowledgments

- Thanks to the Presearch team for providing the search API
- Thanks to the Model Context Protocol community for the protocol specification
- Thanks to all contributors who help improve this project

#presearch #mcp #smithery #privacy #decentralized
