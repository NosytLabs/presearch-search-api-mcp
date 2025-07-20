/**
 * Tests for Presearch MCP Server
 */

import { PresearchServer } from '../../src/server/presearch-mcp-server.js';
import { Configuration } from '../../src/config/configuration.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('PresearchServer', () => {
  let server: PresearchServer;
  let mockConfig: Configuration;

  beforeEach(() => {
    mockConfig = new Configuration({
      baseURL: 'https://api.presearch.io',
      apiKey: 'test-api-key-12345',
      userAgent: 'PresearchMCP/Test',
      timeout: 5000,
      cache: {
        enabled: true,
        ttl: 60000,
        maxSize: 100,
      },
      rateLimit: {
        requests: 10,
        window: 60000,
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        resetTimeout: 10000,
      },
      retry: {
        maxRetries: 2,
        baseDelay: 500,
      },
      logLevel: 'error',
    });
    
    server = new PresearchServer(mockConfig);
  });

  afterEach(async () => {
    if (server && server.isListening()) {
      await server.stop();
    }
  });

  describe('Constructor', () => {
    it('should create server instance with correct configuration', () => {
      expect(server).toBeInstanceOf(PresearchServer);
      expect(server.hasApiKey()).toBe(true);
    });

    it('should create MCP server with correct name and version', () => {
      const mcpServer = server.getServer();
      expect(mcpServer).toBeInstanceOf(McpServer);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      await expect(server.initialize()).resolves.not.toThrow();
    });

    it('should register tools during initialization', async () => {
      await server.initialize();
      const tools = server.getToolDefinitions();
      
      expect(tools).toBeArray();
      expect(tools.length).toBeGreaterThan(0);
      
      // Check for expected tools
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('presearch_search');
      expect(toolNames).toContain('presearch_cache_stats');
      expect(toolNames).toContain('presearch_cache_clear');
      expect(toolNames).toContain('presearch_scrape_content');
      expect(toolNames).toContain('presearch_health_check');
      expect(toolNames).toContain('presearch_system_info');
    });

    it('should handle initialization without API key', async () => {
      const configWithoutKey = new Configuration({
        baseURL: 'https://api.presearch.io',
        // No API key
      });
      const serverWithoutKey = new PresearchServer(configWithoutKey);
      
      await expect(serverWithoutKey.initialize()).resolves.not.toThrow();
      expect(serverWithoutKey.hasApiKey()).toBe(false);
    });
  });

  describe('Tool Management', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should return tool definitions immediately after initialization', () => {
      const tools = server.getToolDefinitions();
      expect(tools).toBeArray();
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should return specific tool by name', () => {
      const searchTool = server.getTool('presearch_search');
      expect(searchTool).toBeDefined();
      expect(searchTool?.definition).toBeDefined();
      expect(searchTool?.handler).toBeFunction();
    });

    it('should return undefined for non-existent tool', () => {
      const nonExistentTool = server.getTool('non_existent_tool');
      expect(nonExistentTool).toBeUndefined();
    });

    it('should have valid tool definitions with required properties', () => {
      const tools = server.getToolDefinitions();
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.name).toBeString();
        expect(tool.description).toBeString();
        expect(tool.inputSchema).toBeObject();
      });
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration successfully', async () => {
      await server.initialize();
      
      const newConfig = {
        timeout: 10000,
        logLevel: 'debug' as const,
      };
      
      await expect(server.updateConfig(newConfig)).resolves.not.toThrow();
    });

    it('should validate API key availability', () => {
      expect(server.hasApiKey()).toBe(true);
      
      const serverWithoutKey = new PresearchServer(new Configuration({
        baseURL: 'https://api.presearch.io',
      }));
      expect(serverWithoutKey.hasApiKey()).toBe(false);
    });
  });

  describe('Server Lifecycle', () => {
    it('should start and stop server successfully', async () => {
      await server.initialize();
      await server.start();
      
      expect(server.isListening()).toBe(true);
      
      await server.stop();
      expect(server.isListening()).toBe(false);
    });

    it('should handle multiple stop calls gracefully', async () => {
      await server.initialize();
      await server.start();
      
      await server.stop();
      await expect(server.stop()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configuration gracefully', () => {
      expect(() => {
        new PresearchServer(new Configuration({
          baseURL: 'invalid-url',
        }));
      }).toThrow();
    });

    it('should handle tool execution errors', async () => {
      await server.initialize();
      
      const searchTool = server.getTool('presearch_search');
      expect(searchTool).toBeDefined();
      
      // Test with invalid arguments
      await expect(
        searchTool!.handler({})
      ).rejects.toThrow();
    });
  });

  describe('MCP Protocol Compliance', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should provide tools in MCP-compliant format', () => {
      const tools = server.getToolDefinitions();
      
      tools.forEach(tool => {
        // Check MCP tool definition structure
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        
        // Validate input schema structure
        expect(tool.inputSchema).toHaveProperty('type');
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema).toHaveProperty('properties');
      });
    });

    it('should handle MCP tool calls correctly', async () => {
      const healthTool = server.getTool('presearch_health_check');
      expect(healthTool).toBeDefined();
      
      const result = await healthTool!.handler({});
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });
});