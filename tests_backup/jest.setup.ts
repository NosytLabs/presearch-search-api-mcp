import 'jest-extended/all';

// Jest setup file for global test configuration

// Set test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    // Keep error and warn for debugging
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  };
});

afterAll(() => {
  global.console = originalConsole;
});

// Global test environment setup
process.env.NODE_ENV = 'test';
process.env.PRESEARCH_API_KEY = 'test-api-key';
process.env.PRESEARCH_BASE_URL = 'https://api.presearch.io';