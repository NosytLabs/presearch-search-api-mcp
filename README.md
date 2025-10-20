# 🔍 Presearch MCP Server

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/NosytLabs/presearch-search-api-mcp)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![API](https://img.shields.io/badge/API-Presearch%20v1-orange.svg)](https://presearch.com)
[![MCP](https://img.shields.io/badge/MCP-Compliant-brightgreen.svg)](https://modelcontextprotocol.io)
[![Smithery](https://img.shields.io/badge/Smithery-Ready-purple.svg)](https://smithery.ai)

A Model Context Protocol server that integrates Presearch's decentralized search engine with AI assistants like Claude.

> **⚠️ Community Project**: Independent project, not officially affiliated with Presearch.

## What This MCP Does

This server enables AI assistants to:
- **Search the web** using Presearch's decentralized search engine
- **Export search results** in JSON, CSV, or Markdown formats  
- **Scrape web content** from search result URLs
- **Filter searches** by country, freshness, and safety settings
- **Cache results** for improved performance

## Quick Start

1. **Get API Key**: Register at [Presearch Search API](https://presearch.io/searchapi)
2. **Install**: `npm install`
3. **Configure**: Create `.env` with `PRESEARCH_API_KEY=your_key`
4. **Run**: `node src/server/server.js`

## MCP Integration

### Claude Desktop
```json
{
  "mcpServers": {
    "presearch": {
      "command": "node",
      "args": ["src/server/server.js"],
      "cwd": "/path/to/presearch-mcp-server",
      "env": {
        "PRESEARCH_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Available Tools

| Tool | Purpose |
|------|---------|
| `search` | Perform web searches with filtering options |
| `export_results` | Export search results in multiple formats |
| `scrape_content` | Extract content from web pages |
| `cache_stats` | View cache performance metrics |
| `cache_clear` | Clear cached search results |
| `health_check` | Check server status |

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PRESEARCH_API_KEY` | ✅ | - | Your Presearch API key |
| `PORT` | ❌ | 8081 | Server port |
| `LOG_LEVEL` | ❌ | info | Logging level |

## Deployment

### Smithery.ai
One-click deploy: [Smithery.ai](https://smithery.ai/server/@nosytlabs/presearch-search-api-mcp)

### Docker
```bash
docker build -t presearch-mcp .
docker run -e PRESEARCH_API_KEY=your_key -p 8081:8081 presearch-mcp
```

## Resources

- **Documentation**: [API Docs](https://presearch-search-api.readme.io)
- **GitHub Issues**: [Report Bugs](https://github.com/NosytLabs/presearch-search-api-mcp/issues)
- **Community**: [Presearch Discord](https://discord.gg/presearch)

## Support Presearch

If you find this MCP server helpful, consider supporting Presearch by signing up through our referral link: [Join Presearch](https://presearch.com/signup?rid=4779685)

---

**Version**: 1.0.0 | **Status**: Production Ready | **API**: Presearch v1 | **MCP**: Compliant | **Platform**: Smithery.ai Ready

## License

MIT License - see [LICENSE](LICENSE) file.