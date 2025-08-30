# Presearch MCP Server v1.0

**Model Context Protocol server for Presearch Search API**

> **⚠️ Community Project Notice**: This is an independent, community-developed MCP server and is not officially affiliated with, endorsed by, or connected to Presearch. It provides access to Presearch's public API through the Model Context Protocol.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/NosytLabs/presearch-search-api-mcp)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![API](https://img.shields.io/badge/API-Presearch%20v1-orange.svg)](https://presearch-search-api.readme.io/reference/get_v1-search)

## 📋 **Current Implementation Status**

This MCP server provides **functional access** to Presearch's decentralized search engine through the official API at `https://na-us-1.presearch.com/v1/search`. It implements core search functionality with basic caching and export capabilities, verified through automated testing.

## ✨ **Implemented Features**

### **🔍 Core Search Functionality**
- **Search API Integration**: Direct integration with Presearch's search API
- **Parameter Support**: Query, page, language, time filters, safe search, and IP address
- **API Compatibility**: Verified compatibility with Presearch API v1 endpoint

### **🛠️ MCP Tools**
- **MCP Protocol Compliance**: Full Model Context Protocol implementation
- **Search Tool**: `presearch_search` with caching and parameter validation
- **Export Tool**: `presearch_export_results` for JSON, CSV, and Markdown formats
- **Content Scraping**: `presearch_scrape_content` for web page extraction
- **Cache Management**: `presearch_cache_stats` and `presearch_cache_clear`
- **Health Check Tool**: `presearch_health_check` for system diagnostics

### **🔒 Security Features**
- **JWT Authentication**: API key management with Bearer token
- **HTTPS Only**: All communications encrypted
- **Input Validation**: Parameter validation using Zod schema

### **📊 Monitoring & Caching**
- **Health Checks**: API connectivity and system health verification
- **In-Memory Caching**: 5-minute TTL caching for improved performance
- **Error Handling**: Comprehensive error recovery with proper HTTP status codes
- **Test Suite**: Automated test coverage for core functionality

## ⚡ **Quick Start**

### Prerequisites
- **Node.js**: Version 18.0 or higher
- **NPM**: Latest version recommended
- **Presearch API Key**: Valid JWT token from [Presearch Search API](https://presearch.io/searchapi)
- **Network**: HTTPS connectivity for API calls

### 1. Install Dependencies
```bash
# Install the MCP server package
npm install presearch-mcp-server

# Or clone and install from source
git clone https://github.com/NosytLabs/presearch-search-api-mcp.git
cd presearch-search-api-mcp
npm install
```

### 2. Configure Environment
Create a `.env` file in your project root:
```env
# Required: Your Presearch API key (JWT token)
PRESEARCH_API_KEY=your_jwt_token_here

# Optional: Custom configuration
NODE_ENV=production
LOG_LEVEL=info
CACHE_TTL=3600000
```

### 3. Verify Installation
```bash
# Test the installation
npm test

# Check server health
npm start -- --help
```

### 4. Launch Server
```bash
# Start the MCP server
npm start

# Or run directly
node src/server/server_enhanced.js
```

## 🛠 **MCP Integration**

Add to your MCP client configuration:

### Claude Desktop
```json
{
  "mcpServers": {
    "presearch": {
      "command": "npx",
      "args": ["presearch-mcp-server"],
      "env": {
        "PRESEARCH_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Kiro IDE
```json
{
  "mcpServers": {
    "presearch": {
      "command": "node",
      "args": ["./node_modules/presearch-mcp-server/src/server/server_enhanced.js"],
      "env": {
        "PRESEARCH_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## 🚀 **Launch Instructions**

### **Production Deployment**

#### **1. Environment Setup**
```bash
# Clone the repository
git clone https://github.com/NosytLabs/presearch-search-api-mcp.git
cd presearch-search-api-mcp

# Install dependencies
npm install

# Create production environment file
cp .env.example .env
```

#### **2. Configuration for Production**
```env
# Production Configuration
NODE_ENV=production
PRESEARCH_API_KEY=your_production_jwt_token
LOG_LEVEL=warn
CACHE_TTL=7200000
PORT=3000
HOST=0.0.0.0

# Optional: Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
```

#### **3. Production Launch**
```bash
# Start with PM2 (recommended for production)
npm install -g pm2
pm2 start ecosystem.config.js

# Or start directly
npm start

# Or use Docker
docker build -t presearch-mcp .
docker run -p 3000:3000 --env-file .env presearch-mcp
```

#### **4. Health Verification**
```bash
# Test the deployment
curl http://localhost:3000/health

# Run production tests
npm test

# Check logs
pm2 logs presearch-mcp
```

### **Development Setup**

#### **Local Development**
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Run tests in watch mode
npm test -- --watch
```

#### **IDE Integration**

**Visual Studio Code:**
```json
{
  "mcp.server.presearch": {
    "command": "npm",
    "args": ["run", "dev"],
    "cwd": "${workspaceFolder}/presearch-mcp-server",
    "env": {
      "PRESEARCH_API_KEY": "${env:PRESEARCH_API_KEY}"
    }
  }
}
```

### **Cloud Deployment**

#### **AWS EC2**
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Deploy application
git clone https://github.com/NosytLabs/presearch-search-api-mcp.git
cd presearch-search-api-mcp
npm install --production
npm start
```

#### **Heroku**
```bash
# Create Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set PRESEARCH_API_KEY=your_jwt_token
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

#### **Docker Deployment**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### **Monitoring & Maintenance**

#### **Log Management**
```bash
# View application logs
pm2 logs presearch-mcp

# Monitor resource usage
pm2 monit

# Rotate logs
pm2 reloadLogs
```

#### **Backup & Recovery**
```bash
# Backup configuration
cp .env .env.backup

# Cache management
# Use built-in cache clearing tools
presearch_cache_clear
```

#### **Scaling**
```bash
# Horizontal scaling with PM2
pm2 scale presearch-mcp 3

# Load balancer configuration
# Use nginx or AWS ALB for production scaling
```

## 📖 **Real-World Usage Examples**

### **🔍 Research & Academic Use Case**
**Scenario**: A researcher studying AI ethics needs comprehensive information about recent developments.

```javascript
// Advanced search with time filtering and safe search
const researchQuery = {
  query: "artificial intelligence ethics 2024",
  page: "1",
  lang: "en-US",
  time: "year",
  safe: "1",
  useCache: true
};

// Expected response structure:
{
  "data": {
    "standardResults": [
      {
        "title": "AI Ethics: Current Challenges and Future Directions",
        "link": "https://example.com/ai-ethics-2024",
        "description": "Comprehensive overview of AI ethics frameworks, regulatory developments, and industry best practices in 2024...",
        "rank": 1,
        "domain": "example.com"
      }
    ],
    "infoSection": {
      "title": "AI Ethics Overview",
      "content": "Artificial Intelligence ethics encompasses responsible AI development, bias mitigation, transparency, and accountability..."
    }
  },
  "links": {
    "next": "https://api.presearch.com/search?page=2"
  }
}
```

### **📰 News & Current Events Monitoring**
**Scenario**: A journalist tracking cryptocurrency market developments.

```javascript
// Real-time news search with weekly filter
const newsQuery = {
  query: "cryptocurrency market analysis",
  time: "week",
  lang: "en-US",
  page: "1"
};

// Use case: Automated news aggregation for market reports
```

### **Search with Time Filters**
```javascript
// Using time-based filters
const recentSearch = {
  query: "latest technology",
  time: "week"
};

const monthlySearch = {
  query: "market trends",
  time: "month"
};
```

### **📊 Data Analysis & Export**
**Scenario**: A data analyst collecting market research data.

```javascript
// Export search results for data analysis
const exportQuery = {
  query: "renewable energy market trends",
  format: "csv",
  maxResults: 100
};

// Generated CSV output:
"title,link,description,domain
Renewable Energy Market 2024,https://example.com/renewable-market,Detailed analysis of global renewable energy market trends...,example.com
Solar Power Industry Growth,https://example.com/solar-growth,Comprehensive report on solar energy sector expansion...,example.com"
```

### **🔬 Content Research & Scraping**
**Scenario**: A content strategist analyzing competitor websites.

```javascript
// Comprehensive content scraping for SEO analysis
const scrapingQuery = {
  url: "https://competitor-site.com/blog/ai-trends",
  extractText: true,
  extractLinks: true,
  extractImages: false,
  includeMetadata: true
};

// Response includes page metadata, main content, and internal/external links
```

### **💼 Business Intelligence**
**Scenario**: Competitive analysis for market entry strategy.

```javascript
// Multi-page search for comprehensive market analysis
const businessQuery = {
  query: "SaaS market analysis 2024",
  page: "1",
  lang: "en-US",
  time: "year"
};

// Follow-up queries for pagination
const page2Query = { ...businessQuery, page: "2" };
const page3Query = { ...businessQuery, page: "3" };
```

### **🛠️ Development & Debugging**
**Scenario**: Developer testing API integration and troubleshooting.

```javascript
// Cache management for development testing
// Clear cache between tests
const cacheClear = {};

// Check cache statistics
const cacheStats = {};

// Verify API connectivity
const connectivityTest = {
  query: "test connectivity",
  useCache: false
};
```

### **📊 Automated Reporting**
**Scenario**: Business analyst generating weekly market reports.

```javascript
// Automated export for weekly reporting
const weeklyReport = {
  query: "technology industry news",
  format: "markdown",
  maxResults: 25,
  time: "week"
};

// Generated Markdown for reports:
"# Technology Industry News - Weekly Report

Generated: 2024-01-15T10:30:00Z

## 1. Major Tech Merger Announced
**Link:** https://example.com/tech-merger
**Description:** Leading technology companies announce $50B merger...

## 2. AI Breakthrough in Healthcare
**Link:** https://example.com/ai-healthcare
**Description:** New AI system shows 95% accuracy in medical diagnosis..."
```

## 🔧 **Available Tools**

### `presearch_search`
**Web search with caching and parameter support**
```javascript
{
  "query": "javascript programming",
  "page": "1",
  "lang": "en-US",
  "time": "week",
  "ip": "192.168.1.1",
  "safe": "1",
  "useCache": true
}
```

### `presearch_export_results`
**Export search results in multiple formats**
```javascript
{
  "query": "web development",
  "format": "json",
  "maxResults": 10
}
```

### `presearch_scrape_content`
**Extract content from web pages**
```javascript
{
  "url": "https://example.com",
  "extractText": true,
  "extractLinks": true,
  "includeMetadata": true
}
```

### `presearch_cache_stats`
**View cache statistics**
```javascript
{}
```

### `presearch_cache_clear`
**Clear all cached results**
```javascript
{}
```

### `presearch_health_check`
**System health and connectivity verification**
```javascript
{}
```

## 📋 **API Documentation**

### **Search Parameters**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `query` | string | Yes | Search query | "javascript programming" |
| `page` | string | No | Page number (1-based) | "1" |
| `lang` | string | No | Language code | "en-US" |
| `time` | string | No | Time filter | "week", "month", "year" |
| `location` | object | No | Geographic coordinates | `{"lat":40.7128,"long":-74.0060}` |
| `ip` | string | No | Client IP address | "192.168.1.1" |
| `safe` | string | No | Safe search (0=off, 1=on) | "1" |

### **Time Filters**

| Filter | Description | Use Case |
|--------|-------------|----------|
| `week` | Results from the past week | Recent content and news |
| `month` | Results from the past month | Monthly trends and updates |
| `year` | Results from the past year | Annual overviews and historical data |

### **API Response Format**

#### Standard Results
```json
{
  "data": {
    "standardResults": [
      {
        "title": "Result Title",
        "link": "https://example.com",
        "description": "Result description and snippet",
        "rank": 1,
        "domain": "example.com"
      }
    ],
    "infoSection": {
      "title": "Featured Information",
      "content": "Detailed information panel"
    },
    "specialSections": {
      "news": [...],
      "videos": [...],
      "images": [...]
    }
  },
  "links": {
    "first": "https://api.example.com/search?page=1",
    "last": "https://api.example.com/search?page=10",
    "prev": null,
    "next": "https://api.example.com/search?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 10,
    "path": "https://api.example.com/search",
    "per_page": 10,
    "to": 10,
    "total": 100
  }
}
```

#### Export Formats
```json
{
  "format": "json|csv|markdown|html",
  "data": [...],
  "metadata": {
    "query": "search term",
    "timestamp": "2024-01-01T00:00:00Z",
    "totalResults": 50
  }
}
```

#### Error Response Format
```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid",
    "status": 401,
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### **Error Codes**

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_API_KEY` | 401 | API key is missing or invalid |
| `INSUFFICIENT_CREDITS` | 402 | Account has insufficient API credits |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in time window |
| `INVALID_PARAMETERS` | 422 | Request parameters are invalid |
| `SERVER_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | API service temporarily unavailable |

## 🧪 **Testing**

Run the production test suite:
```bash
npm test
```

**Latest Test Results (Real API Data):**
```
📊 TEST SUMMARY
================
Total Tests: 7
✅ Passed: 7
❌ Failed: 0
Success Rate: 100%

🎉 ALL TESTS PASSED!
```

**Test Coverage:**
- ✅ Basic search functionality
- ✅ Search with pagination
- ✅ Language filter support
- ✅ Time filter functionality
- ✅ Safe mode operation
- ✅ API error handling (401 unauthorized)
- ✅ Response structure validation
- ✅ All API parameters tested against real Presearch API

## 📊 **Testing & Validation**

### **Test Suite Results**
```
🧪 Presearch MCP Server v1.0 - Test Suite
🔗 Testing against: https://na-us-1.presearch.com/v1/search

📊 TEST SUMMARY
===============
Total Tests: 7
✅ Passed: 7
❌ Failed: 0
Success Rate: 100%

🎉 ALL TESTS PASSED!
```

### **Test Coverage**
- ✅ Basic search functionality
- ✅ Search with pagination
- ✅ Language filter support
- ✅ Time filter functionality
- ✅ Safe mode operation
- ✅ API error handling (401 unauthorized)
- ✅ Response structure validation
- ✅ All API parameters tested against real Presearch API

### **Quality Assurance**
- ✅ **Real API Integration**: Tests use authentic Presearch API responses
- ✅ **Error Handling**: Comprehensive error recovery for API failures
- ✅ **Security Validation**: JWT authentication and HTTPS enforcement
- ✅ **Input Validation**: Parameter validation using Zod schemas

## 🔒 **Security Features**

- **API Key Protection**: Secure environment variable storage
- **HTTPS Only**: All API communications encrypted
- **Input Validation**: Parameter validation using Zod schemas
- **Error Handling**: Secure error responses without exposing sensitive data

## ⚡ **Performance Features**

- **In-Memory Caching**: 5-minute TTL caching for improved response times
- **Request Timeout**: 30-second timeout handling
- **Memory Management**: Automatic cache cleanup and memory optimization
- **Health Monitoring**: Built-in system health checks

## 🔗 **API Documentation**

- **Official Docs**: https://presearch-search-api.readme.io/reference/get_v1-search
- **Endpoint**: https://na-us-1.presearch.com/v1/search
- **API Version**: v1
- **Response Format**: JSON

## 🔧 **Troubleshooting**

### **Common Issues & Solutions**

#### **API Key Authentication Errors**
```
Error: 401 Unauthorized
```
**Solutions:**
- Verify your API key is correctly set in `.env` file
- Ensure the API key is a valid JWT token from Presearch
- Check that your account has sufficient credits
- Confirm the API key hasn't expired

#### **Connection Timeout Issues**
```
Error: Timeout of 30000ms exceeded
```
**Solutions:**
- Check your internet connection
- Verify Presearch API is accessible: `curl https://na-us-1.presearch.com/v1/search`
- Increase timeout in configuration if needed
- Check for firewall/proxy blocking requests

#### **Invalid Parameters Error**
```
Error: 422 Unprocessable Entity
```
**Solutions:**
- Validate all required parameters are provided
- Check parameter formats (especially JSON objects for location)
- Ensure query parameter is not empty
- Verify IP address format if provided

#### **Rate Limiting**
```
Error: 429 Too Many Requests
```
**Solutions:**
- Implement request throttling in your application
- Wait before retrying (exponential backoff recommended)
- Check your API usage limits
- Consider upgrading your Presearch plan for higher limits

#### **Memory Issues**
```
Error: JavaScript heap out of memory
```
**Solutions:**
- Increase Node.js memory limit: `node --max-old-space-size=1024`
- Clear cache periodically using `presearch_cache_clear`
- Consider horizontal scaling for high-load scenarios

### **Debugging Steps**

1. **Enable Debug Logging**
   ```bash
   DEBUG=* npm start
   ```

2. **Test API Connectivity**
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        "https://na-us-1.presearch.com/v1/search?q=test&ip=8.8.8.8"
   ```

3. **Check Server Health**
   ```javascript
   // Use the health check tool
   const health = await presearch_health_check();
   console.log(health);
   ```

4. **Validate Configuration**
   ```bash
   node -e "console.log(require('dotenv').config())"
   ```

### **Performance Optimization**

- **Enable Caching**: Results are cached automatically with TTL
- **Use Filters**: Predefined filters reduce response times
- **Batch Requests**: Combine multiple queries when possible
- **Monitor Usage**: Track performance with built-in metrics

### **Getting Help**

- **Check Logs**: Review server logs for detailed error information
- **Test Suite**: Run `npm test` to verify functionality
- **GitHub Issues**: Search existing issues or create new ones
- **Community Support**: Join Presearch Discord for community help

## 📋 **Requirements**

- **Node.js**: 18+
- **API Key**: Valid Presearch API key
- **Network**: HTTPS connectivity
- **Memory**: 512MB+ recommended

## 🤝 **Support**

- **Issues**: [GitHub Issues](https://github.com/NosytLabs/presearch-search-api-mcp/issues)
- **Documentation**: [API Docs](https://presearch-search-api.readme.io)
- **Community**: [Presearch Discord](https://discord.gg/presearch)

## 💝 **Support the Project**

If you find this MCP server helpful, consider supporting Presearch by signing up through our referral link: [Join Presearch](https://presearch.com/signup?rid=4779685)

Your support helps grow the decentralized search ecosystem! 🚀

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

---

**Version**: 1.0.0 | **Status**: Functional Implementation | **API**: Presearch v1