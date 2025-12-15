/**
 * Content Analysis Service
 * Evaluates relevance, sentiment, and quality of content
 */
export class ContentAnalysisService {
  constructor() {
    this.stopwords = new Set([
      "the",
      "is",
      "in",
      "at",
      "of",
      "on",
      "and",
      "a",
      "to",
    ]); // Expanded in real usage
  }

  analyze(text, query) {
    if (!text) return { score: 0, sentiment: "neutral", keywords: [] };

    const cleanText = text.toLowerCase();
    const cleanQuery = query.toLowerCase();

    // 1. Relevance Score
    const relevanceScore = this.calculateRelevance(cleanText, cleanQuery);

    // 2. Keyword Extraction
    const keywords = this.extractKeywords(cleanText);

    // 3. Basic Sentiment (Placeholder for more advanced NLP)
    const sentiment = this.analyzeSentiment(cleanText);

    return {
      relevanceScore,
      keywords,
      sentiment,
      wordCount: text.split(/\s+/).length,
      readabilityScore: this.calculateReadability(text),
    };
  }

  /**
   * Analyze a batch of search results
   * @param {string} query
   * @param {Array} results
   */
  async analyzeSearchResults(query, results) {
    if (!results || results.length === 0) return null;

    const analysis = {
      summary: "Analysis of top results",
      topKeywords: {},
      averageSentiment: { score: 0, label: "neutral" },
      resultsAnalysis: []
    };

    let totalSentiment = 0;
    const allKeywords = {};

    results.forEach(result => {
      const text = (result.title + " " + (result.snippet || "")).trim();
      const resultAnalysis = this.analyze(text, query);
      
      analysis.resultsAnalysis.push({
        url: result.url,
        ...resultAnalysis
      });

      // Aggregate sentiment
      if (resultAnalysis.sentiment === "positive") totalSentiment++;
      if (resultAnalysis.sentiment === "negative") totalSentiment--;

      // Aggregate keywords
      resultAnalysis.keywords.forEach(kw => {
        allKeywords[kw] = (allKeywords[kw] || 0) + 1;
      });
    });

    // Finalize aggregates
    analysis.averageSentiment.score = totalSentiment;
    if (totalSentiment > 0) analysis.averageSentiment.label = "positive";
    else if (totalSentiment < 0) analysis.averageSentiment.label = "negative";

    analysis.topKeywords = Object.entries(allKeywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return analysis;
  }

  calculateRelevance(text, query) {
    const queryTerms = query.split(/\s+/).filter((t) => !this.stopwords.has(t));
    if (queryTerms.length === 0) return 0;

    let matchCount = 0;
    queryTerms.forEach((term) => {
      const regex = new RegExp(`\\b${term}\\b`, "g");
      const matches = (text.match(regex) || []).length;
      matchCount += matches > 0 ? 1 : 0;
    });

    return matchCount / queryTerms.length;
  }

  extractKeywords(text) {
    const words = text.match(/\b\w+\b/g) || [];
    const frequency = {};

    words.forEach((word) => {
      if (word.length > 3 && !this.stopwords.has(word)) {
        frequency[word] = (frequency[word] || 0) + 1;
      }
    });

    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((entry) => entry[0]);
  }

  analyzeSentiment(text) {
    const positiveWords = ["good", "great", "excellent", "best", "amazing"];
    const negativeWords = ["bad", "worst", "terrible", "poor", "awful"];

    let score = 0;
    const words = text.split(/\s+/);
    words.forEach((word) => {
      if (positiveWords.includes(word)) score++;
      if (negativeWords.includes(word)) score--;
    });

    if (score > 0) return "positive";
    if (score < 0) return "negative";
    return "neutral";
  }

  calculateReadability(text) {
    // Flesch-Kincaid simplified approximation
    const sentences = text.split(/[.!?]+/).length;
    const words = text.split(/\s+/).length;
    return words / (sentences || 1); // Avg sentence length
  }
}

export const contentAnalyzer = new ContentAnalysisService();
