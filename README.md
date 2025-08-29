# Presearch MCP Server

**Model Context Protocol Server for Decentralized Web Search**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io/)

*Privacy-focused web search capabilities for AI agents through the Model Context Protocol*

## 🌟 Overview

**Presearch MCP Server** is a Model Context Protocol (MCP) server that provides AI agents with access to Presearch's decentralized search engine. This server enables privacy-first web search capabilities without tracking or data collection.

### 🎯 Key Features

- **🔍 Full Presearch API Integration** - Complete access to Presearch search features
- **🛡️ Privacy-First** - Decentralized search with no user tracking
- **⚡ Production-Ready** - Built with reliability patterns (caching, rate limiting, circuit breaker)
- **🔧 6 MCP Tools** - Comprehensive toolkit for AI agent integration
- **📊 Enterprise Features** - Monitoring, health checks, and performance optimization

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** (latest version recommended)
- **Presearch API Key** (free from [Presearch Developer Portal](https://presearch.com/developers))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/presearch-mcp-server.git
cd presearch-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

1. **Get your Presearch API Key**
   - Visit [Presearch Developer Portal](https://presearch.com/developers)
   - Sign up for a free API key

2. **Configure Environment**
   ```bash
   # Copy environment template
   cp .env.example .env

   # Edit .env file with your API key
   PRESEARCH_API_KEY=your_api_key_here
   ```

3. **Start the Server**
   ```bash
   # Start the MCP server
   npm start
   ```

## 🔧 MCP Tools

Presearch MCP Server provides **6 comprehensive tools** for AI agents:

### 1. 🔍 `presearch_search`

**Primary search tool with full Presearch API capabilities**

```typescript
// Tool signature
{
  name: "presearch_search",
  description: "Performs a web search using the Presearch engine with comprehensive filtering options.",
  inputSchema: {
    query: { type: "string", description: "Search query" },
    page: { type: "number", description: "Page number (optional)" },
    resultsPerPage: { type: "number", description: "Results per page (1-50)" },
    lang: { type: "string", description: "Language code (e.g., 'en', 'es', 'fr')" },
    time: { type: "string", enum: ["any", "day", "week", "month", "year"] },
    location: { type: "string", description: "Location coordinates" },
    ip: { type: "string", description: "IP address for geo-targeting" },
    safe: { type: "string", enum: ["0", "1"], description: "Safe search mode" }
  }
}
```

**Example Usage:**
```javascript
const result = await agent.callTool('presearch_search', {
  query: "renewable energy innovations",
  resultsPerPage: 20,
  time: "month",
  lang: "en",
  safe: "1"
});
```

### 2. 📊 `presearch_cache_stats`

**Monitor cache performance and statistics**

```typescript
{
  name: "presearch_cache_stats",
  description: "Get cache statistics and performance metrics.",
  inputSchema: { type: "object", properties: {} }
}
```

### 3. 🗑️ `presearch_cache_clear`

**Clear cached data for fresh results**

```typescript
{
  name: "presearch_cache_clear",
  description: "Clear all cached data.",
  inputSchema: { type: "object", properties: {} }
}
```

### 4. 🌐 `presearch_scrape_content`

**Extract content from web pages**

```typescript
{
  name: "presearch_scrape_content",
  description: "Scrape content from a web page.",
  inputSchema: {
    url: { type: "string", description: "URL to scrape" }
  }
}
```

### 5. ❤️ `presearch_health_check`

**Check server health and status**

```typescript
{
  name: "presearch_health_check",
  description: "Check the health status of the Presearch service.",
  inputSchema: { type: "object", properties: {} }
}
```

### 6. ℹ️ `presearch_system_info`

**Get comprehensive system information**

```typescript
{
  name: "presearch_system_info",
  description: "Get system information and status.",
  inputSchema: { type: "object", properties: {} }
}
```

## 📚 Documentation

### 📖 Official Resources

- **[Presearch Website](https://presearch.io)** - Learn about decentralized search
- **[Presearch API Documentation](https://presearch-search-api.readme.io/)** - Complete API reference
- **[MCP Specification](https://modelcontextprotocol.io/)** - Model Context Protocol docs
- **[Developer Portal](https://presearch.com/developers)** - Get your API key

### ⚙️ Configuration

#### Environment Variables

```env
# Required Settings
PRESEARCH_API_KEY=your_api_key_here

# Optional Settings
PRESEARCH_BASE_URL=https://na-us-1.presearch.com
LOG_LEVEL=info
PRESEARCH_CACHE_ENABLED=true
PRESEARCH_RATE_LIMIT_REQUESTS=10
PRESEARCH_CIRCUIT_BREAKER_ENABLED=true
```

## 🏗️ Architecture

### System Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Agent      │────│  MCP Server      │────│  Presearch API  │
│   (Claude, etc.)│    │  (This Project)  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
            ┌─────────────┐ ┌─────────┐ ┌─────────┐
            │   Cache     │ │  Rate   │ │ Circuit │
            │  Manager    │ │ Limiter │ │ Breaker │
            └─────────────┘ └─────────┘ └─────────┘
```

### Core Components

#### 🔧 **MCP Server Layer**
- **File**: `src/server/presearch-mcp-server.ts`
- **Purpose**: MCP protocol implementation and tool orchestration

#### 🌐 **API Client Layer**
- **File**: `src/api/api-client.ts`
- **Purpose**: Presearch API communication with reliability patterns

#### ⚙️ **Configuration Layer**
- **File**: `src/config/configuration.ts`
- **Purpose**: Environment and settings management

#### 🛠️ **Utility Layer**
- **Cache Manager**: Intelligent caching with TTL and size limits
- **Rate Limiter**: Request throttling with sliding window
- **Circuit Breaker**: Fault tolerance and recovery
- **Logger**: Structured logging with multiple levels

## 🔧 Development

### Development Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start in development mode
npm run dev

# Clean build artifacts
npm run clean
```

### Project Structure

```
src/
├── mcp-entry.ts              # Main MCP server entry point
├── server/
│   └── presearch-mcp-server.ts    # MCP server implementation
├── api/
│   └── api-client.ts              # Presearch API client
├── config/
│   └── configuration.ts           # Configuration management
├── types/
│   └── presearch-types.ts         # TypeScript definitions
├── utils/
│   ├── cache-manager.ts           # Caching system
│   ├── rate-limiter.ts            # Rate limiting
│   ├── circuit-breaker.ts         # Fault tolerance
│   ├── logger.ts                  # Logging system
│   └── response-processor.ts      # Response processing
└── middleware/
    ├── auth-middleware.ts         # Authentication
    └── security-middleware.ts     # Security features
```

## 🤝 Community

### 📞 Support & Discussion

- **🐛 Issues**: [GitHub Issues](https://github.com/yourusername/presearch-mcp-server/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/yourusername/presearch-mcp-server/discussions)
- **🌐 Presearch Community**: Join our [Discord](https://discord.gg/presearch) or [Forum](https://forum.presearch.io)

### 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

**MIT License** - see [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for the decentralized web**

*Presearch MCP Server is not officially affiliated with Anthropic or the Model Context Protocol project.*

</div>