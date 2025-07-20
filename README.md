# Presearch MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io/)
[![Production Ready](https://img.shields.io/badge/Status-Production%20Ready-green.svg)]()

A fully functional Model Context Protocol (MCP) server that integrates Presearch's decentralized search engine with AI agents. This production-ready implementation provides comprehensive web search capabilities using Presearch's privacy-focused API with advanced features like rate limiting, caching, and circuit breaking.

## 🚀 Features

- **🔍 Advanced Web Search**: Full Presearch API integration with all supported parameters
- **🎯 Site-Specific Searches**: Target specific domains (e.g., `site:apple.com`)
- **🧠 AI-Enhanced Results**: Intelligent result processing with insights and analysis
- **⚡ Performance Optimized**: Built-in caching, rate limiting, and circuit breaker
- **🔒 Security First**: Secure API key management and validation
- **📊 Monitoring**: Cache statistics and health monitoring tools
- **🔧 MCP Compatible**: Works seamlessly with any MCP-compatible AI platform

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

## ⚙️ Advanced Configuration

The server supports extensive configuration through environment variables:

### Core Settings
```env
# Required
PRESEARCH_API_KEY=your_api_key_here

# Server Configuration
PORT=3001                           # Server port (default: 3001)
LOG_LEVEL=info                      # Logging level: debug, info, warn, error

# API Configuration
PRESEARCH_BASE_URL=https://api.presearch.com  # API base URL
PRESEARCH_USER_AGENT=PresearchMCP/1.0         # Custom user agent
PRESEARCH_TIMEOUT=30000                       # Request timeout (ms)
PRESEARCH_RETRIES=3                           # Max retry attempts
```

### Performance & Reliability
```env
# Caching
PRESEARCH_CACHE_ENABLED=true        # Enable result caching
PRESEARCH_CACHE_TTL=300             # Cache TTL in seconds (5 minutes)
PRESEARCH_CACHE_MAX_SIZE=1000       # Maximum cached entries

# Rate Limiting
PRESEARCH_RATE_LIMIT_ENABLED=true   # Enable rate limiting
PRESEARCH_RATE_LIMIT_REQUESTS=100   # Requests per window
PRESEARCH_RATE_LIMIT_WINDOW=60000   # Window size in ms (1 minute)

# Circuit Breaker
PRESEARCH_CIRCUIT_BREAKER_ENABLED=true     # Enable circuit breaker
PRESEARCH_CIRCUIT_BREAKER_THRESHOLD=5      # Failure threshold
PRESEARCH_CIRCUIT_BREAKER_TIMEOUT=30000    # Recovery timeout (ms)
```

## 📚 API Reference

### Presearch Search API Integration

This MCP server integrates with the [Presearch Search API v1](https://presearch-search-api.readme.io/reference/get_v1-search) endpoint:

**Base URL:** `https://api.presearch.com/v1/search`

**Authentication:** API Key via `X-API-Key` header

**Supported Parameters:**
- `query` (required) - Search terms/keywords
- `page` (optional) - Page number for pagination (default: 1)
- `resultsPerPage` (optional) - Results per page, 1-50 (default: 10)
- `lang` (optional) - Language code (e.g., 'en', 'es', 'fr', 'de')
- `time` (optional) - Time filter: 'any', 'day', 'week', 'month', 'year'
- `location` (optional) - Geographic location (JSON string with lat/long)
- `ip` (optional) - IP address for geo-targeting
- `safe` (optional) - Safe search mode: '1' (enabled), '0' (disabled)

### Response Structure

The API returns structured search results with:
- **Search Results**: Title, URL, snippet, rank
- **AI Insights**: Content analysis and key findings
- **Metadata**: Query info, pagination, timing
- **Special Sections**: Top stories, videos, related searches

## 🔍 Search Query Examples

### Basic Searches
```json
{
  "query": "machine learning algorithms",
  "resultsPerPage": 20
}

{
  "query": "AI OR artificial intelligence",
  "page": 2,
  "safe": "1"
}

{
  "query": "python -java",
  "lang": "en"
}
```

### Language-Specific Searches
```json
{
  "query": "intelligence artificielle",
  "lang": "fr",
  "resultsPerPage": 15
}

{
  "query": "künstliche intelligenz",
  "lang": "de",
  "time": "month"
}
```

### Time-Filtered Searches
```json
{
  "query": "latest AI news",
  "time": "day",
  "safe": "1"
}

{
  "query": "stock market trends",
  "time": "week",
  "resultsPerPage": 25
}

{
  "query": "research papers machine learning",
  "time": "year",
  "lang": "en"
}
```

### Geographic Targeting
```json
{
  "query": "local restaurants",
  "location": "{\"lat\": 40.7128, \"lng\": -74.0060}",
  "resultsPerPage": 10
}

{
  "query": "weather forecast",
  "ip": "192.168.1.1",
  "time": "day"
}
```

### Advanced Search Combinations
```json
{
  "query": "site:github.com python tutorial",
  "lang": "en",
  "time": "month",
  "safe": "0",
  "resultsPerPage": 30
}

{
  "query": "filetype:pdf climate change",
  "time": "year",
  "lang": "en",
  "page": 1
}
```

## 🚀 Production Deployment

### Docker Deployment
```bash
# Build the image
docker build -t presearch-mcp .

# Run with environment variables
docker run -d \
  --name presearch-mcp \
  -p 3001:3001 \
  -e PRESEARCH_API_KEY=your_key_here \
  -e LOG_LEVEL=info \
  presearch-mcp
```

### Health Monitoring
The server provides health endpoints:
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system status
- `GET /metrics` - Performance metrics

### Performance Optimization
- **Caching**: Reduces API calls and improves response times
- **Rate Limiting**: Prevents API quota exhaustion
- **Circuit Breaker**: Handles API failures gracefully
- **Connection Pooling**: Optimizes HTTP connections
- **Request Batching**: Efficient handling of multiple requests

## 🛠️ Development

### Development Mode
```bash
npm run dev          # Start with hot reload
npm run build        # Build for production
npm run lint         # Code linting
npm run format       # Code formatting
```

### Project Structure
```
src/
├── api/             # API client implementation
├── server/          # MCP server core
├── types/           # TypeScript definitions
├── config/          # Configuration management
├── utils/           # Utility modules
│   ├── cache-manager.ts
│   ├── rate-limiter.ts
│   └── circuit-breaker.ts
└── middleware/      # Request/response middleware
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests for any improvements.

## 📞 Support

For issues and questions:
- Check the [Issues](https://github.com/your-repo/presearch-mcp/issues) page
- Review the [Presearch API Documentation](https://presearch-search-api.readme.io/)
- Contact the maintainers

---

**Built with ❤️ for the decentralized web**