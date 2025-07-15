import { logger } from './logger.js';
import {
  PresearchAPIResponse,
  SearchResult,
  NormalizedSearchResult,
  MCPToolResponse,
  PresearchResponse,
  AISearchResponse,
  StandardizedSearchResult,
  SearchInsights,
  TimeframeAnalysis
} from '../types/presearch-types.js';

/**
 * Unified response processor for normalizing, formatting, and extracting entities
 * from Presearch API responses. Consolidates functionality from multiple utilities.
 */
export class ResponseProcessor {
  private static instance: ResponseProcessor;

  // Entity extraction patterns
  private readonly patterns = {
    dates: /\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/gi,
    urls: /https?:\/\/(?:[-\w.])+(?:[:\d]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?/gi,
    emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    phones: /\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/gi,
    money: /\$[0-9,]+(?:\.[0-9]{2})?\b|\b[0-9,]+(?:\.[0-9]{2})?\s*(?:USD|EUR|GBP|dollars?|euros?|pounds?)\b/gi,
    percentages: /\b\d+(?:\.\d+)?%\b/gi,
    years: /\b(?:19|20)\d{2}\b/g,
    programmingLanguages: /\b(?:JavaScript|TypeScript|Python|Java|C\+\+|C#|PHP|Ruby|Go|Rust|Swift|Kotlin|Scala|R|MATLAB|SQL|HTML|CSS|React|Vue|Angular|Node\.js|Express|Django|Flask|Spring|Laravel)\b/gi,
    technologies: /\b(?:API|REST|GraphQL|JSON|XML|HTTP|HTTPS|SSL|TLS|OAuth|JWT|Docker|Kubernetes|AWS|Azure|GCP|MongoDB|PostgreSQL|MySQL|Redis|Elasticsearch|Git|GitHub|GitLab|CI\/CD|DevOps|Machine Learning|AI|Blockchain|IoT)\b/gi
  };

  private readonly stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
  ]);

  private constructor() {
    logger.debug('Response Processor initialized');
  }

  public static getInstance(): ResponseProcessor {
    if (!ResponseProcessor.instance) {
      ResponseProcessor.instance = new ResponseProcessor();
    }
    return ResponseProcessor.instance;
  }

  /**
   * Parse and normalize a single search response
   */
  public parseSearchResponse(
    response: PresearchAPIResponse,
    query: string,
    operationType: string = 'search'
  ): PresearchResponse {
    try {
      const results = response.data?.standardResults || response.results || [];
      const infoSection = response.data?.infoSection || response.infoSection;
      const specialSections = response.data?.specialSections || response.specialSections;

      logger.debug('Parsing search response', {
        operationType,
        query: query.substring(0, 50),
        hasResults: results.length > 0,
        resultCount: results.length,
        hasInfoSection: !!infoSection,
        specialSectionCount:
          (specialSections?.topStories?.length || 0) + (specialSections?.videos?.length || 0),
      });

      if (!response || results.length === 0) {
        logger.warn('Empty or invalid API response', { operationType, query });
        return {
          query,
          data: { standardResults: [] },
          meta: { current_page: response.meta?.current_page || 1 },
          totalResults: 0,
          searchTime: 0,
        };
      }

      const normalizedResults = this.normalizeSearchResults(results);

      const parsedResponse: PresearchResponse = {
        query,
        data: {
          standardResults: normalizedResults,
          infoSection,
          specialSections,
        },
        links: {
          first: response.links?.first,
          last: response.links?.last,
          prev: response.links?.prev,
          next: response.links?.next,
        },
        meta: {
          current_page: response.meta?.current_page || 1,
          from: response.meta?.from,
          last_page: response.meta?.last_page,
          path: response.meta?.path,
          pages: response.meta?.pages,
        },
        totalResults: response.meta?.pages || response.totalResults || normalizedResults.length,
        searchTime: response.searchTime || 0,
        results: normalizedResults,
        currentPage: response.meta?.current_page || 1,
        resultsPerPage: normalizedResults.length,
      };

      logger.info('Search response parsed successfully', {
        operationType,
        query: query.substring(0, 50),
        resultCount: normalizedResults.length,
        totalResults: parsedResponse.totalResults,
      });

      return parsedResponse;
    } catch (error) {
      logger.error('Error parsing search response', {
        operationType,
        query: query.substring(0, 50),
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to parse search response: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Format search response for AI consumption with standardized structure
   */
  public formatForAI(response: PresearchResponse): AISearchResponse {
    try {
      const results = response.data?.standardResults || response.results || [];
      const query = response.query || 'Unknown query';
      
      const standardizedResults = this.createStandardizedResults(results);
      const insights = this.extractInsights(results);
      const summary = this.generateSearchSummary(results, query);
      
      const aiResponse: AISearchResponse = {
        query,
        summary,
        results: standardizedResults,
        insights,
        metadata: {
          totalResults: response.totalResults || results.length,
          searchTime: response.searchTime || 0,
          currentPage: response.currentPage || 1,
          resultsPerPage: results.length,
          timestamp: new Date().toISOString(),
          searchEngine: 'presearch',
          qualityScore: this.calculateOverallQuality(results)
        },
        pagination: {
          hasNext: !!response.links?.next,
          hasPrevious: !!response.links?.prev,
          currentPage: response.meta?.current_page || 1,
          totalPages: response.meta?.last_page || 1
        }
      };

      logger.info('Search response formatted for AI', {
        query: query.substring(0, 50),
        resultCount: standardizedResults.length,
        qualityScore: aiResponse.metadata.qualityScore
      });

      return aiResponse;
    } catch (error) {
      logger.error('Error formatting response for AI', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Parse multiple search responses (for multi-search)
   */
  public parseMultiSearchResponse(
    responses: PresearchAPIResponse[],
    queries: string[]
  ): MCPToolResponse {
    try {
      logger.debug('Parsing multi-search response', {
        responseCount: responses.length,
        queryCount: queries.length,
      });

      const parsedResults = responses.map((response, index) => {
        const query = queries[index] || `Query ${index + 1}`;
        return this.parseSearchResponse(response, query, 'multi-search');
      });

      const totalResults = parsedResults.reduce(
        (sum, result) => sum + (result.totalResults || 0),
        0
      );

      const totalSearchTime = parsedResults.reduce(
        (sum, result) => sum + (result.searchTime || 0),
        0
      );

      logger.info('Multi-search response parsed successfully', {
        queryCount: queries.length,
        totalResults,
        averageSearchTime: totalSearchTime / responses.length,
      });

      return {
        success: true,
        data: {
          queries,
          results: parsedResults,
          totalQueries: queries.length,
          totalResults,
          averageSearchTime: totalSearchTime / responses.length,
          summary: this.generateMultiSearchSummary(parsedResults),
        },
      };
    } catch (error) {
      logger.error('Error parsing multi-search response', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: `Failed to parse multi-search response: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Extract entities from text content
   */
  public extractEntities(text: string): ExtractedEntities {
    try {
      const entities: ExtractedEntities = {
        dates: this.extractPattern(text, this.patterns.dates),
        urls: this.extractPattern(text, this.patterns.urls),
        emails: this.extractPattern(text, this.patterns.emails),
        phones: this.extractPattern(text, this.patterns.phones),
        money: this.extractPattern(text, this.patterns.money),
        percentages: this.extractPattern(text, this.patterns.percentages),
        years: this.extractPattern(text, this.patterns.years),
        programmingLanguages: this.extractPattern(text, this.patterns.programmingLanguages),
        technologies: this.extractPattern(text, this.patterns.technologies),
        keywords: this.extractKeywords(text),
        namedEntities: this.extractNamedEntities(text)
      };

      logger.debug('Entities extracted', {
        textLength: text.length,
        entityCounts: Object.fromEntries(
          Object.entries(entities).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])
        )
      });

      return entities;
    } catch (error) {
      logger.error('Error extracting entities', {
        error: error instanceof Error ? error.message : String(error)
      });
      return this.getEmptyEntities();
    }
  }

  // Private helper methods
  private normalizeSearchResults(results: SearchResult[]): NormalizedSearchResult[] {
    return results.map((result: SearchResult, index: number) => {
      const normalized: NormalizedSearchResult = {
        title: this.sanitizeText(result.title || 'Untitled'),
        url: result.url || '',
        link: result.link || result.url || '',
        description: this.sanitizeText(result.description || result.snippet || ''),
        rank: index + 1,
        domain: this.extractDomain(result.url || ''),
        publishedDate: result.publishedDate || result.date,
        author: result.author,
        imageUrl: result.imageUrl || result.image,
        score: result.score || result.relevance,
        metadata: {
          source: result.source || 'presearch',
          contentType: this.detectContentType(result),
          language: result.language || 'en',
          wordCount: this.estimateWordCount(result.description || result.snippet || ''),
          hasImage: !!(result.imageUrl || result.image),
          isSecure: (result.url || '').startsWith('https://'),
          lastCrawled: result.lastCrawled,
        },
      };
      return normalized;
    });
  }

  private createStandardizedResults(results: SearchResult[]): StandardizedSearchResult[] {
    return results.map((result, index) => {
      const domain = this.extractDomain(result.url || '');
      const contentType = this.detectContentType(result);
      
      return {
        title: this.sanitizeText(result.title || 'Untitled'),
        url: result.url || '',
        link: result.link || result.url || '',
        snippet: this.sanitizeText(result.description || result.snippet || ''),
        description: this.sanitizeText(result.description || result.snippet || ''),
        source: domain,
        rank: index + 1,
        relevanceScore: result.score || result.relevance || 0,
        publishedDate: result.publishedDate || result.date || undefined,
        author: result.author || null,
        imageUrl: result.imageUrl || result.image || null,
        contentType,
        metadata: {
          domain,
          isSecure: (result.url || '').startsWith('https://'),
          wordCount: this.estimateWordCount(result.description || result.snippet || ''),
          hasImage: !!(result.imageUrl || result.image),
          language: result.language || 'en',
          lastCrawled: result.lastCrawled || null
        },
        aiTags: this.generateAITags(result)
      };
    });
  }

  private extractInsights(results: SearchResult[]): SearchInsights {
    const domains = this.extractUniqueDomains(results);
    const contentTypes = this.analyzeContentTypes(results);
    const keywords = this.extractKeywords(results.map(r => `${r.title || ''} ${r.description || r.snippet || ''}`).join(' '));
    const timeframe = this.analyzeTimeframe(results);
    
    return {
      topDomains: domains.slice(0, 5),
      contentTypeDistribution: contentTypes,
      extractedKeywords: keywords,
      timeframeAnalysis: timeframe,
      averageRelevance: this.calculateAverageRelevance(results),
      resultDiversity: this.calculateResultDiversity(results)
    };
  }

  private generateSearchSummary(results: SearchResult[], query: string): string {
    if (results.length === 0) {
      return `No results found for "${query}".`;
    }

    const topDomains = this.extractUniqueDomains(results).slice(0, 3);
    const contentTypes = this.analyzeContentTypes(results);
    const primaryType = Object.keys(contentTypes).reduce((a, b) => 
      contentTypes[a] > contentTypes[b] ? a : b
    );

    return `Found ${results.length} results for "${query}". ` +
           `Primary content type: ${primaryType}. ` +
           `Top sources: ${topDomains.join(', ')}. ` +
           `Results include ${Object.keys(contentTypes).length} different content types.`;
  }

  private generateMultiSearchSummary(results: PresearchResponse[]): string {
    const totalResults = results.reduce((sum, result) => sum + (result.totalResults || 0), 0);
    const avgSearchTime = results.reduce((sum, result) => sum + (result.searchTime || 0), 0) / results.length;
    
    return `Multi-search completed: ${results.length} queries processed, ${totalResults} total results found, average search time: ${avgSearchTime.toFixed(2)}ms`;
  }

  private generateAITags(result: SearchResult): string[] {
    const tags: string[] = [];
    const title = (result.title || '').toLowerCase();
    const description = (result.description || result.snippet || '').toLowerCase();
    const url = result.url || '';

    // Content type tags
    if (url.includes('youtube.com') || url.includes('vimeo.com')) tags.push('video');
    if (url.includes('.edu') || title.includes('research')) tags.push('academic');
    if (url.includes('/news/') || description.includes('breaking')) tags.push('news');
    if (url.includes('github.com') || title.includes('code')) tags.push('code');
    if (url.includes('stackoverflow.com') || title.includes('tutorial')) tags.push('tutorial');
    
    // Quality indicators
    if (result.publishedDate) tags.push('dated');
    if (result.author) tags.push('authored');
    if (result.imageUrl) tags.push('visual');
    if ((result.description || '').length > 100) tags.push('detailed');
    
    // Recency tags
    if (result.publishedDate) {
      const publishDate = new Date(result.publishedDate);
      const now = new Date();
      const daysDiff = (now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff <= 7) tags.push('recent');
      else if (daysDiff <= 30) tags.push('current');
      else if (daysDiff <= 365) tags.push('this-year');
      else tags.push('archived');
    }

    return tags;
  }

  private extractPattern(text: string, pattern: RegExp): string[] {
    const matches = text.match(pattern) || [];
    return [...new Set(matches)];
  }

  private extractKeywords(text: string, maxKeywords: number = 10): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !this.stopWords.has(word) &&
        !/^\d+$/.test(word)
      );

    const wordCounts = new Map<string, number>();
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word]) => word);
  }

  private extractNamedEntities(text: string): string[] {
    const namedEntityPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const matches = text.match(namedEntityPattern) || [];
    
    const filtered = matches.filter(match => 
      match.length > 2 && 
      !this.stopWords.has(match.toLowerCase()) &&
      !/^(The|This|That|These|Those|And|Or|But|In|On|At|To|For|Of|With|By)$/i.test(match)
    );

    return [...new Set(filtered)];
  }

  private sanitizeText(text: string): string {
    return text
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  private detectContentType(result: SearchResult): string {
    const url = result.url || '';
    const title = (result.title || '').toLowerCase();
    
    if (url.includes('youtube.com') || url.includes('vimeo.com')) return 'video';
    if (url.includes('.pdf')) return 'pdf';
    if (url.includes('/news/') || title.includes('news')) return 'news';
    if (url.includes('github.com')) return 'code';
    if (url.includes('.edu')) return 'academic';
    
    return 'webpage';
  }

  private estimateWordCount(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private extractUniqueDomains(results: SearchResult[]): string[] {
    const domainCounts = new Map<string, number>();
    
    results.forEach(result => {
      const domain = this.extractDomain(result.url || '');
      if (domain !== 'unknown') {
        domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
      }
    });

    return Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([domain]) => domain);
  }

  private analyzeContentTypes(results: SearchResult[]): Record<string, number> {
    const contentTypes: Record<string, number> = {};
    
    results.forEach(result => {
      const type = this.detectContentType(result);
      contentTypes[type] = (contentTypes[type] || 0) + 1;
    });

    return contentTypes;
  }

  private analyzeTimeframe(results: SearchResult[]): TimeframeAnalysis {
    const now = new Date();
    const timeframes = {
      recent: 0,    // Last 7 days
      current: 0,   // Last 30 days
      thisYear: 0,  // This year
      older: 0,     // Older than this year
      hasDateInfo: false
    };

    results.forEach(result => {
      if (result.publishedDate) {
        timeframes.hasDateInfo = true;
        const publishDate = new Date(result.publishedDate);
        const daysDiff = (now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= 7) timeframes.recent++;
        else if (daysDiff <= 30) timeframes.current++;
        else if (daysDiff <= 365) timeframes.thisYear++;
        else timeframes.older++;
      }
    });

    return timeframes;
  }

  private calculateAverageRelevance(results: SearchResult[]): number {
    const scores = results
      .map(r => r.score || r.relevance || 0)
      .filter(score => score > 0);
    
    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  }

  private calculateResultDiversity(results: SearchResult[]): number {
    const domains = new Set(results.map(r => this.extractDomain(r.url || '')));
    return domains.size / Math.max(results.length, 1);
  }

  private calculateOverallQuality(results: SearchResult[]): number {
    let qualityScore = 0;
    const factors = {
      hasDescription: 0.2,
      hasAuthor: 0.1,
      hasDate: 0.1,
      hasImage: 0.1,
      isSecure: 0.1,
      relevanceScore: 0.4
    };

    results.forEach(result => {
      let resultScore = 0;
      
      if (result.description || result.snippet) resultScore += factors.hasDescription;
      if (result.author) resultScore += factors.hasAuthor;
      if (result.publishedDate) resultScore += factors.hasDate;
      if (result.imageUrl) resultScore += factors.hasImage;
      if ((result.url || '').startsWith('https://')) resultScore += factors.isSecure;
      
      const relevance = (result.score || result.relevance || 0) / 100;
      resultScore += relevance * factors.relevanceScore;
      
      qualityScore += resultScore;
    });

    return results.length > 0 ? (qualityScore / results.length) * 100 : 0;
  }

  private getEmptyEntities(): ExtractedEntities {
    return {
      dates: [],
      urls: [],
      emails: [],
      phones: [],
      money: [],
      percentages: [],
      years: [],
      programmingLanguages: [],
      technologies: [],
      keywords: [],
      namedEntities: []
    };
  }
}

// Type definitions for entity extraction
export interface ExtractedEntities {
  dates: string[];
  urls: string[];
  emails: string[];
  phones: string[];
  money: string[];
  percentages: string[];
  years: string[];
  programmingLanguages: string[];
  technologies: string[];
  keywords: string[];
  namedEntities: string[];
}

export interface AggregatedEntities {
  dates: Map<string, number>;
  urls: Map<string, number>;
  emails: Map<string, number>;
  phones: Map<string, number>;
  money: Map<string, number>;
  percentages: Map<string, number>;
  years: Map<string, number>;
  programmingLanguages: Map<string, number>;
  technologies: Map<string, number>;
  keywords: Map<string, number>;
  namedEntities: Map<string, number>;
}