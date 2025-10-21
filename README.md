# Presearch MCP Server

A Model Context Protocol (MCP) server for interacting with the Presearch search API, enabling AI assistants to perform web searches, export results, and scrape web content.

## Overview

The Presearch MCP Server provides a powerful interface to the Presearch search engine, offering AI assistants the ability to:

- Perform privacy-focused web searches without tracking
- Retrieve comprehensive search results with customizable parameters
- Export search data in multiple formats for analysis
- Extract structured content from web pages
- Maintain efficient performance through intelligent caching

## Features

- **Privacy-First Search**: Leverage Presearch's privacy-focused search engine that doesn't track users
- **Customizable Search Parameters**: Control location, language, safe search levels, and result freshness
- **Multiple Export Formats**: Export results in JSON, CSV, or Markdown for different use cases
- **Intelligent Content Scraping**: Extract text, links, images, and metadata from web pages
- **Performance Optimization**: Built-in caching system to improve response times
- **Comprehensive Error Handling**: Robust error reporting and health monitoring
- **Developer-Friendly**: Clear API documentation and easy integration with MCP clients

## Use Cases

### For AI Assistants

- **Research Tasks**: Conduct comprehensive research on any topic with up-to-date web information
- **Fact Verification**: Quickly verify claims and find supporting evidence
- **Content Creation**: Gather sources and inspiration for articles, reports, or creative work
- **Market Analysis**: Stay informed about industry trends and competitor activities
- **Academic Support**: Find scholarly sources and research materials

### For Developers

- **Data Extraction**: Build applications that need structured web data
- **Content Aggregation**: Create tools that compile information from multiple sources
- **Competitive Monitoring**: Track mentions of products, brands, or topics across the web
- **API Integration**: Add search capabilities to applications without handling complex web scraping

### For Businesses

- **Market Intelligence**: Monitor industry news and developments
- **Brand Monitoring**: Track mentions of your company or products
- **Trend Analysis**: Identify emerging trends in your market
- **Content Curation**: Find relevant content for marketing or knowledge bases

## Installation & Configuration

### Step 1: Add to MCP Client Configuration

Add the server to your MCP client configuration file:

```json
{
  "mcpServers": {
    "presearch": {
      "command": "npx",
      "args": ["presearch-mcp-server"]
    }
  }
}
```

### Step 2: Alternative Installation (Global)

If you prefer to install globally:

```json
{
  "mcpServers": {
    "presearch": {
      "command": "presearch-mcp-server"
    }
  }
}
```

### Step 3: Restart Your MCP Client

Restart your MCP client to load the new server. The Presearch tools will now be available in your client's tool palette.

## Usage Examples

### 1. Basic Search

Perform a web search using the Presearch API:

```javascript
// Example search request
{
  "query": "artificial intelligence trends",
  "ip": "192.168.1.1",
  "count": 10
}
```

### 2. Advanced Search with Filters

Customize your search with specific parameters:

```javascript
// Example advanced search
{
  "query": "renewable energy",
  "ip": "192.168.1.1",
  "count": 15,
  "country": "US",
  "search_lang": "en",
  "freshness": "pm", // Past month
  "safesearch": "moderate"
}
```

### 3. Export Results

Export search results in different formats for analysis:

```javascript
// Example export request
{
  "query": "climate change impact",
  "ip": "192.168.1.1",
  "format": "json",
  "count": 20
}
```

### 4. Content Scraping

Extract structured content from web pages:

```javascript
// Example scrape request
{
  "url": "https://example.com",
  "extractText": true,
  "extractLinks": false,
  "extractImages": false,
  "includeMetadata": true
}
```

### 5. Cache Management

Optimize performance with intelligent caching:

- View cache statistics to monitor performance
- Clear cache when needed to ensure fresh results

### 6. Health Monitoring

Monitor server status and performance with built-in health checks.

## Presearch API Features

The Presearch API offers several advantages over traditional search engines:

- **Privacy Protection**: No tracking of user searches or personal data
- **Decentralized Infrastructure**: Built on blockchain technology for transparency
- **Reward System**: Users can earn PRE tokens for contributing to the ecosystem
- **Customizable Results**: Fine-tuned control over search parameters and filters
- **Global Reach**: Search results from around the world with localization options
- **Developer-Friendly**: Simple API structure with comprehensive documentation

## Integration with Popular MCP Clients

### Claude Desktop

1. Open Claude Desktop settings
2. Navigate to "Developer" section
3. Edit the MCP configuration file
4. Add the Presearch server configuration as shown above
5. Restart Claude Desktop

### Other MCP Clients

The process is similar for other MCP-compatible clients:

1. Locate the MCP configuration file for your client
2. Add the Presearch server configuration
3. Restart the client to load the new server
4. The Presearch tools will appear in your client's tool palette

## API Reference

### Search Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Search query |
| ip | string | Yes | IP address of the user |
| count | number | No | Number of results (1-20, default 10) |
| offset | number | No | Pagination offset (default 0) |
| country | string | No | Country code (e.g., US, GB) |
| search_lang | string | No | Search language (e.g., en, es) |
| ui_lang | string | No | UI language (e.g., en-US) |
| safesearch | string | No | Safe search level (off, moderate, strict) |
| freshness | string | No | Time filter (pd, pw, pm, py) |
| useCache | boolean | No | Whether to use cached results |

### Export Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Search query to export |
| ip | string | Yes | IP address of the user |
| format | string | Yes | Export format (json, csv, markdown) |
| count | number | No | Number of results to export |
| country | string | No | Country code for search |

### Scrape Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes | URL to scrape content from |
| extractText | boolean | No | Extract text content |
| extractLinks | boolean | No | Extract links |
| extractImages | boolean | No | Extract images |
| includeMetadata | boolean | No | Include page metadata |

### Cache Management

- `cache_stats`: View cache statistics
- `cache_clear`: Clear cache

### Health Check

- `health_check`: Monitor server status and performance

## Advanced Configuration

### Custom Search Parameters

Fine-tune your searches with advanced parameters:

- **Freshness Filters**:
  - `pd`: Past day
  - `pw`: Past week
  - `pm`: Past month
  - `py`: Past year

- **Safe Search Levels**:
  - `off`: No filtering
  - `moderate`: Basic filtering
  - `strict`: Strict filtering

- **Localization**:
  - Use country codes (US, GB, DE, FR, etc.) for region-specific results
  - Specify language codes (en, es, fr, de, etc.) for language-specific results

### Performance Optimization

- **Caching**: Enable caching to improve response times for repeated queries
- **Result Limits**: Adjust the count parameter to balance between comprehensive results and performance
- **Network Considerations**: The server automatically handles network conditions and retries

## Troubleshooting

### Common Issues

1. **Server Not Found**:
   - Verify the MCP configuration is correct
   - Restart your MCP client
   - Check that the command path is correct

2. **Search Errors**:
   - Ensure the IP parameter is properly formatted
   - Check network connectivity
   - Verify search query format

3. **Performance Issues**:
   - Clear cache if results seem outdated
   - Reduce the number of results requested
   - Check if the Presearch API is experiencing issues

### Getting Help

- Check the [Presearch API Documentation](https://docs.presearch.com)
- Review the [MCP Specification](https://modelcontextprotocol.io)
- Open an issue on the project repository for bug reports or feature requests

## Development

### Scripts

- `npm start` - Start the server
- `npm test` - Run tests
- `npm run dev` - Start in development mode with hot reload

### Dependencies

- @modelcontextprotocol/sdk - MCP SDK for server implementation
- axios - HTTP client for API requests
- cheerio - Server-side HTML parsing
- cors - CORS middleware
- dotenv - Environment variable management
- express - Web server framework
- winston - Logging library
- zod - Schema validation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

- Create an issue in the GitHub repository
- Check the documentation at [Presearch Docs](https://docs.presearch.io/)
- Join the community at [Presearch Discord](https://discord.gg/presearch)