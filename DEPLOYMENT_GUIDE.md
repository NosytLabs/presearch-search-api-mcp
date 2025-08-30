# Presearch MCP Server Deployment Guide for smithery.ai

## Overview

This guide provides comprehensive instructions for deploying the Presearch MCP Server on smithery.ai. The server is fully optimized and configured for seamless deployment with proper API key management and containerization.

## Prerequisites

### Required Accounts and Access
- **smithery.ai Account**: Active account with deployment permissions
- **Presearch API Key**: Valid JWT token from [Presearch Search API](https://presearch.io/searchapi)
- **Network Access**: HTTPS connectivity for API calls

### System Requirements
- **Node.js**: Version 18.0 or higher (handled by Docker container)
- **Docker**: smithery.ai handles containerization
- **Memory**: 512MB+ recommended
- **Storage**: Minimal storage requirements

### API Key Setup
1. Visit [Presearch Search API](https://presearch.io/searchapi)
2. Sign up or log in to your account
3. Generate a new API key (JWT token)
4. Ensure your account has sufficient API credits
5. Keep the API key secure - it will be required during deployment

## Step-by-Step Deployment Process

### Step 1: Access smithery.ai Platform

1. Log in to your smithery.ai account
2. Navigate to the MCP Server deployment section
3. Click "Deploy New Server" or "Add MCP Server"

### Step 2: Configure Server Settings

#### Basic Configuration
- **Server Name**: `presearch-mcp-server`
- **Version**: `1.0.0`
- **Runtime**: Container (automatically configured)
- **Description**: Official Model Context Protocol server for Presearch Search API

#### Environment Variables
Set the following required environment variable:

```env
PRESEARCH_API_KEY=your_jwt_token_here
```

**Important**: Replace `your_jwt_token_here` with your actual Presearch API key.

#### Optional Environment Variables
You can customize the server behavior with these optional variables:

```env
# Logging Configuration
LOG_LEVEL=info
LOG_ENABLE_CONSOLE=true
LOG_ENABLE_FILE=false
LOG_DIRECTORY=./logs
LOG_MAX_FILE_SIZE=10485760
LOG_MAX_FILES=5
LOG_ENABLE_PERFORMANCE=true
LOG_ENABLE_REQUEST=true

# Error Handling
ERROR_ENABLE_DETAILED=true
ERROR_MAX_RETRIES=3
ERROR_RETRY_DELAY=1000
ERROR_CIRCUIT_BREAKER_ENABLED=true
ERROR_CIRCUIT_BREAKER_THRESHOLD=5
ERROR_CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Performance Monitoring
PERF_ENABLE_METRICS=true
PERF_SLOW_QUERY_THRESHOLD=5000
PERF_ENABLE_MEMORY_MONITORING=true
PERF_METRICS_INTERVAL=60000

# API Configuration
PRESEARCH_BASE_URL=https://na-us-1.presearch.com
PRESEARCH_TIMEOUT=30000
PRESEARCH_MAX_RETRIES=3
PRESEARCH_RETRY_DELAY=1000
PRESEARCH_USER_AGENT=PresearchMCP/1.0.0
```

### Step 3: Deploy the Server

1. **Upload Configuration**: Use the provided `smithery.yaml` configuration file
2. **Set API Key**: Enter your Presearch API key in the secure configuration field
3. **Review Settings**: Verify all configuration parameters
4. **Deploy**: Click "Deploy" to start the deployment process

The deployment will:
- Build the Docker container using the provided Dockerfile
- Install Node.js dependencies
- Configure the MCP server with your API key
- Start the server in stdio mode for MCP communication

### Step 4: Verify Deployment

#### Health Check
After deployment, verify the server is running correctly:

```bash
# The server should respond to MCP protocol messages
# Use smithery.ai's built-in health check or test with:
curl -X POST https://your-deployment-url/health \
  -H "Authorization: Bearer your_api_key"
```

#### Test Basic Functionality
Test the core search functionality:

```javascript
// Test search tool
{
  "tool": "presearch_search",
  "parameters": {
    "query": "test search",
    "page": "1"
  }
}
```

Expected response format:
```json
{
  "content": [
    {
      "type": "text",
      "text": "{ ... search results ... }"
    }
  ]
}
```

## Post-Deployment Configuration

### smithery.ai Integration

#### MCP Client Configuration
Once deployed, configure your MCP client to use the server:

```json
{
  "mcpServers": {
    "presearch": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "presearch-mcp-server"],
      "env": {
        "PRESEARCH_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

#### Available Tools
The deployed server provides these MCP tools:

1. **`presearch_search`**: Web search with caching and parameter support
2. **`presearch_export_results`**: Export search results in JSON, CSV, or Markdown
3. **`presearch_scrape_content`**: Extract content from web pages
4. **`presearch_cache_stats`**: View cache statistics
5. **`presearch_cache_clear`**: Clear all cached results
6. **`presearch_health_check`**: System health and connectivity verification

### Monitoring and Maintenance

#### Performance Monitoring
The server includes built-in performance monitoring:
- Response time tracking
- Memory usage monitoring
- Cache hit rates
- Circuit breaker status
- Error rate monitoring

#### Cache Management
- **Automatic Caching**: 5-minute TTL for search results
- **Cache Statistics**: Monitor cache performance
- **Manual Cache Clearing**: Clear cache when needed

#### Logging
- **Console Logging**: Real-time log output
- **File Logging**: Optional persistent logging
- **Performance Logging**: Detailed operation metrics
- **Request Logging**: API request/response tracking

## Troubleshooting

### Common Deployment Issues

#### API Key Authentication Errors
```
Error: 401 Unauthorized
```
**Solutions:**
- Verify your API key is correctly entered in smithery.ai
- Ensure the API key is a valid JWT token from Presearch
- Check that your Presearch account has sufficient credits
- Confirm the API key hasn't expired

#### Container Build Failures
```
Error: Docker build failed
```
**Solutions:**
- Check smithery.ai deployment logs
- Verify network connectivity during build
- Ensure all required files are present in the repository
- Check for any Docker-specific errors in the build log

#### Connection Timeout Issues
```
Error: Timeout of 30000ms exceeded
```
**Solutions:**
- Verify internet connectivity in smithery.ai environment
- Check if Presearch API is accessible
- Increase timeout in configuration if needed
- Review firewall/proxy settings

#### Invalid Parameters Error
```
Error: 422 Unprocessable Entity
```
**Solutions:**
- Validate all required parameters are provided
- Check parameter formats (especially JSON objects)
- Ensure query parameter is not empty
- Verify IP address format if provided

#### Rate Limiting
```
Error: 429 Too Many Requests
```
**Solutions:**
- Implement request throttling in your application
- Wait before retrying (exponential backoff recommended)
- Check your API usage limits
- Consider upgrading your Presearch plan for higher limits

### Debugging Steps

1. **Check Deployment Logs**
   - Access smithery.ai deployment logs
   - Look for error messages during startup
   - Verify configuration loading

2. **Test API Connectivity**
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        "https://na-us-1.presearch.com/v1/search?q=test&ip=8.8.8.8"
   ```

3. **Validate Configuration**
   - Ensure all required environment variables are set
   - Check API key format and validity
   - Verify network connectivity

4. **Health Check Verification**
   ```javascript
   // Use the health check tool
   const health = await presearch_health_check();
   console.log(health);
   ```

## Security Considerations

### API Key Management
- Store API keys securely in smithery.ai's encrypted environment
- Never expose API keys in logs or error messages
- Rotate API keys regularly
- Monitor API key usage for unauthorized access

### Network Security
- All communications use HTTPS encryption
- Input validation prevents injection attacks
- Rate limiting protects against abuse
- Circuit breaker prevents cascade failures

### Data Protection
- No sensitive data is stored persistently
- Cache data is temporary and automatically expires
- Error messages don't expose sensitive information
- Logging can be configured to exclude sensitive data

## Performance Optimization

### Caching Strategy
- **In-Memory Cache**: 5-minute TTL for improved response times
- **Cache Key Generation**: Based on query parameters
- **Automatic Cleanup**: Expired entries removed automatically
- **Cache Statistics**: Monitor hit rates and performance

### Resource Management
- **Memory Monitoring**: Built-in memory usage tracking
- **Circuit Breaker**: Prevents cascade failures
- **Retry Logic**: Automatic retry for transient failures
- **Timeout Handling**: Configurable timeouts for all operations

### Scaling Considerations
- **Horizontal Scaling**: Multiple instances can be deployed
- **Load Balancing**: Distribute requests across instances
- **Resource Limits**: Configure appropriate memory and CPU limits
- **Monitoring**: Track performance metrics for optimization

## Support and Resources

### Documentation Links
- [Presearch API Documentation](https://presearch-search-api.readme.io/reference/get_v1-search)
- [smithery.ai Documentation](https://smithery.ai/docs)
- [Model Context Protocol](https://modelcontextprotocol.io)

### Getting Help
- **smithery.ai Support**: Contact smithery.ai support for deployment issues
- **Presearch Support**: Visit Presearch Discord for API-related questions
- **GitHub Issues**: Report bugs in the [project repository](https://github.com/NosytLabs/presearch-search-api-mcp)

### Community Resources
- **Presearch Discord**: Join the community for support and updates
- **GitHub Discussions**: Participate in technical discussions
- **API Changelog**: Stay updated with API changes

## Verification Checklist

After deployment, verify these items:

- [ ] Server starts without errors
- [ ] Health check returns success
- [ ] Basic search functionality works
- [ ] API key authentication is successful
- [ ] Cache is functioning properly
- [ ] Logging is configured correctly
- [ ] Performance monitoring is active
- [ ] All MCP tools are accessible
- [ ] Error handling works as expected
- [ ] Network connectivity is stable

## Summary

This deployment guide covers all aspects needed for successful deployment of the Presearch MCP Server on smithery.ai. The server is production-ready with comprehensive error handling, caching, and monitoring capabilities. Follow the steps carefully, and use the troubleshooting section if you encounter any issues.

For additional support, refer to the resources listed above or contact the respective support channels.