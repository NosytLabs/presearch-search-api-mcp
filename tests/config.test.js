import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidCountryCode, filterSearchParams, isValidLanguageCode } from '../src/core/config.js';

describe('Config Utilities', () => {
  describe('isValidCountryCode', () => {
    it('should return true for valid 2-letter country codes', () => {
      assert.equal(isValidCountryCode('US'), true);
      assert.equal(isValidCountryCode('GB'), true);
      assert.equal(isValidCountryCode('CA'), true);
    });

    it('should return false for invalid codes', () => {
      assert.equal(isValidCountryCode('USA'), false);
      assert.equal(isValidCountryCode('u'), false);
      assert.equal(isValidCountryCode('12'), false);
      assert.equal(isValidCountryCode(''), false);
    });
  });

  describe('isValidLanguageCode', () => {
    it('should return true for valid language codes', () => {
      assert.equal(isValidLanguageCode('en'), true);
      assert.equal(isValidLanguageCode('en-US'), true);
      assert.equal(isValidLanguageCode('fr-FR'), true);
    });

    it('should return false for invalid language codes', () => {
      assert.equal(isValidLanguageCode('eng'), false); // Too long
      assert.equal(isValidLanguageCode('e'), false);   // Too short
      assert.equal(isValidLanguageCode('en_US'), false); // Wrong separator
    });
  });

  describe('filterSearchParams', () => {
    it('should pass through valid country params', () => {
      const params = { q: 'test', country: 'US' };
      const filtered = filterSearchParams(params);
      assert.equal(filtered.country, 'US');
    });

    it('should normalize country params to uppercase', () => {
      const params = { q: 'test', country: 'us' };
      const filtered = filterSearchParams(params);
      assert.equal(filtered.country, 'US');
    });

    it('should ignore invalid country params', () => {
      const params = { q: 'test', country: 'USA' };
      const filtered = filterSearchParams(params);
      assert.equal(filtered.country, undefined);
    });

    it('should handle safe search parameters', () => {
      assert.equal(filterSearchParams({ q: 't', safe: 'off' }).safe, '0');
      assert.equal(filterSearchParams({ q: 't', safe: 'strict' }).safe, '1');
      assert.equal(filterSearchParams({ q: 't', safe: 'moderate' }).safe, '1');
    });

    it('should default IP if not provided', () => {
      const filtered = filterSearchParams({ q: 'test' });
      assert.equal(filtered.ip, '8.8.8.8');
    });

    it('should allow valid IP', () => {
      const filtered = filterSearchParams({ q: 'test', ip: '1.1.1.1' });
      assert.equal(filtered.ip, '1.1.1.1');
    });
  });
});
