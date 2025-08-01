# Presearch MCP API Setup Guide

## 🔧 Fix Your Presearch API Configuration

### Current Status
✅ **Server Components Working:**
- API Client initialized
- Rate limiter configured
- Circuit breaker active
- Cache manager ready
- Environment variables loaded

❌ **Missing:** Real API Key (currently using placeholder)

### Step 1: Get Your Presearch API Key

1. **Visit:** https://presearch.com/developers
2. **Sign up** for a Presearch developer account
3. **Navigate** to API Keys section
4. **Generate** a new API key
5. **Copy** your API key (starts with `ps_` or similar)

### Step 2: Configure Your Environment

Replace the placeholder in your `.env` file:

```bash
# Open your .env file
code .env

# Replace this line:
PRESEARCH_API_KEY=your-api-key-here

# With your real API key:
PRESEARCH_API_KEY=your-real-api-key-here
```

### Step 3: Verify Setup

Run the test to verify everything works:

```bash
# Method 1: Using ts-node
npx tsx test-presearch-api.ts

# Method 2: Using the build
npm run build
node dist/test-presearch-api.js

# Method 3: Using npm script
npm run dev -- test-presearch-api.ts
```

### Expected Output (with valid API key)

```
🔍 Testing Presearch API...

📋 Environment Variables:
PRESEARCH_API_KEY: ✅ Set
PRESEARCH_BASE_URL: https://api.presearch.io

⚙️ Configuration:
Base URL: https://na-us-1.presearch.com
API Key: ✅ Configured
Timeout: 30000ms
Rate Limit: 60 requests / 60000ms

🔗 Testing API client initialization...
📊 Health Status:
{
  "rateLimiter": { "isEnabled": true, "requests": 60, "window": 60000 },
  "circuitBreaker": { "isEnabled": true, "state": "CLOSED" },
  "apiKey": { "configured": true, "validated": true }
}

🧪 Testing actual search...
✅ Search completed successfully!
Results: 10 results for "test query"
```

### Troubleshooting

#### If API key validation fails:
1. **Check API key format** - should be a long string starting with `ps_`
2. **Verify API key permissions** - ensure it has search API access
3. **Check rate limits** - new keys may have restrictions
4. **Contact Presearch support** if issues persist

#### If environment variables aren't loading:
1. **Restart your terminal/IDE**
2. **Check file encoding** - .env should be UTF-8
3. **Verify file location** - should be in project root
4. **Check for typos** in variable names

### Advanced Configuration

#### Custom Settings
Add these optional configurations to your `.env`:

```bash
# Custom base URL (if different region)
PRESEARCH_BASE_URL=https://api.presearch.io

# Custom rate limits
PRESEARCH_RATE_LIMIT_REQUESTS=100
PRESEARCH_RATE_LIMIT_WINDOW=60000

# Enhanced logging
LOG_LEVEL=debug

# Cache settings
PRESEARCH_CACHE_ENABLED=true
PRESEARCH_CACHE_TTL=300000
```

### Testing Endpoints

Once configured, test these MCP tools:

```bash
# Test search functionality
npx @modelcontextprotocol/inspector

# Or use the MCP server directly
npm start
```

### Security Best Practices

1. **Never commit** your API key to git
2. **Use environment variables** for all sensitive data
3. **Rotate keys** regularly
4. **Monitor usage** in Presearch dashboard
5. **Set up alerts** for unusual activity

### Support

- **Presearch API Docs:** https://presearch-search-api.readme.io/
- **Discord:** Presearch Developer Community
- **Email:** developers@presearch.com

Your Presearch MCP server is ready - just add your API key! 🚀