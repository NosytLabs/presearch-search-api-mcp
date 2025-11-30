export class ContentAnalysisService {
  /**
   * Analyze content quality
   */
  analyzeContentQuality(content, options = {}) {
    const { min_quality_score = 0 } = options;

    const analysis = {
      overall_quality_score: 0,
      quality_factors: {},
      quality_issues: [],
    };

    // Quality scoring factors
    let quality_score = 0;
    const factors = {};

    // Title quality (0-25 points)
    if (content.title) {
      const title_length = content.title.length;
      if (title_length >= 30 && title_length <= 120) factors.title_length = 25;
      else if (title_length >= 20 && title_length < 30)
        factors.title_length = 20;
      else if (title_length > 120) factors.title_length = 15;
      else factors.title_length = 10;

      // Title descriptiveness
      const descriptive_words = [
        "guide",
        "how",
        "what",
        "why",
        "best",
        "review",
        "analysis",
        "complete",
      ];
      const has_descriptive = descriptive_words.some((word) =>
        content.title.toLowerCase().includes(word),
      );
      factors.title_descriptive = has_descriptive ? 15 : 5;
    } else {
      factors.title_length = 0;
      factors.title_descriptive = 0;
      analysis.quality_issues.push("Missing title");
    }

    // Description quality (0-25 points)
    if (content.description) {
      const desc_length = content.description.length;
      if (desc_length >= 100 && desc_length <= 300)
        factors.description_length = 25;
      else if (desc_length >= 50 && desc_length < 100)
        factors.description_length = 20;
      else if (desc_length > 300) factors.description_length = 15;
      else factors.description_length = 10;

      // Description completeness
      const has_keywords =
        content.description.includes(content.title?.split(" ")[0]) ||
        desc_length > 80;
      factors.description_completeness = has_keywords ? 15 : 10;
    } else {
      factors.description_length = 0;
      factors.description_completeness = 0;
      analysis.quality_issues.push("Missing description");
    }

    // Content depth (0-20 points)
    if (content.content) {
      const content_length = content.content.length;
      if (content_length > 2000) factors.content_depth = 20;
      else if (content_length > 1000) factors.content_depth = 15;
      else if (content_length > 500) factors.content_depth = 10;
      else factors.content_depth = 5;
    } else {
      factors.content_depth = 0;
    }

    // Source credibility (0-15 points)
    if (content.domain) {
      const credible_domains = [
        ".edu",
        ".gov",
        ".org",
        "wikipedia",
        "medium",
        "github",
      ];

      // Add country-specific credible domains if country is provided
      if (options.country) {
        const c = options.country.toLowerCase();
        // Common patterns for government and academic sites
        credible_domains.push(
          `.gov.${c}`,
          `.edu.${c}`,
          `.ac.${c}`,
          `.${c}.gov`,
          `.${c}.edu`,
          `.gc.${c}`,
        );
      }

      const is_credible = credible_domains.some((domain) =>
        content.domain.includes(domain),
      );
      factors.source_credibility = is_credible ? 15 : 10;
    } else {
      factors.source_credibility = 5;
    }

    // Calculate total score
    quality_score = Object.values(factors).reduce(
      (sum, score) => sum + score,
      0,
    );

    analysis.overall_quality_score = Math.min(100, quality_score);
    analysis.quality_factors = factors;
    analysis.meets_quality_threshold =
      analysis.overall_quality_score >= min_quality_score;

    return analysis;
  }

  /**
   * Analyze relevance to research focus
   */
  analyzeRelevance(content, options = {}) {
    const { research_focus = "general", custom_keywords = [] } = options;

    const analysis = {
      relevance_score: 0,
      relevance_factors: {},
      focus_alignment: "low",
      key_matches: [],
    };

    // Research focus keywords
    const focus_keywords = {
      academic: [
        "research",
        "study",
        "analysis",
        "data",
        "findings",
        "methodology",
        "peer-reviewed",
      ],
      market: [
        "market",
        "business",
        "industry",
        "competitive",
        "trends",
        "growth",
        "analysis",
      ],
      technical: [
        "technical",
        "implementation",
        "code",
        "architecture",
        "documentation",
        "api",
      ],
      competitive: [
        "competitive",
        "comparison",
        "analysis",
        "benchmark",
        "market share",
        "positioning",
      ],
      news: [
        "news",
        "latest",
        "breaking",
        "update",
        "recent",
        "current",
        "trending",
      ],
    };

    const keywords = [
      ...(focus_keywords[research_focus] || []),
      ...custom_keywords,
    ];

    // Text to analyze
    const text_to_analyze = [
      content.title || "",
      content.description || "",
      content.content || "",
    ]
      .join(" ")
      .toLowerCase();

    // Relevance scoring
    let relevance_score = 0;
    const matches = [];

    // Keyword matches
    keywords.forEach((keyword) => {
      const regex = new RegExp(keyword.toLowerCase(), "g");
      const matches_found = (text_to_analyze.match(regex) || []).length;
      if (matches_found > 0) {
        matches.push({ keyword, count: matches_found });
      }
    });

    // Calculate relevance based on matches
    const total_matches = matches.reduce((sum, match) => sum + match.count, 0);
    relevance_score = Math.min(100, total_matches * 15 + matches.length * 10);

    // Focus alignment
    if (relevance_score >= 70) analysis.focus_alignment = "high";
    else if (relevance_score >= 40) analysis.focus_alignment = "medium";
    else analysis.focus_alignment = "low";

    analysis.relevance_score = relevance_score;
    analysis.relevance_factors = {
      keyword_matches: matches.length,
      total_match_count: total_matches,
      research_focus: research_focus,
    };
    analysis.key_matches = matches;

    return analysis;
  }

  /**
   * Analyze temporal patterns in content
   */
  analyzeTemporalPatterns(content_list) {
    const analysis = {
      timelines: [],
      recency_score: 0,
      date_distribution: {},
      oldest_date: null,
      newest_date: null,
    };

    const dates = [];
    const now = new Date();

    content_list.forEach((item) => {
      let date = null;
      if (item.publishedDate) {
        date = new Date(item.publishedDate);
      } else {
        // Try to extract from text/snippet
        const dateMatch = (item.description || item.content || "").match(
          /\b(19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/i,
        );
        if (dateMatch) {
          date = new Date(dateMatch[0]);
        }
      }

      if (date && !isNaN(date.getTime())) {
        dates.push(date);
        const year = date.getFullYear();
        analysis.date_distribution[year] =
          (analysis.date_distribution[year] || 0) + 1;
      }
    });

    if (dates.length > 0) {
      dates.sort((a, b) => a - b);
      analysis.oldest_date = dates[0].toISOString().split("T")[0];
      analysis.newest_date = dates[dates.length - 1]
        .toISOString()
        .split("T")[0];

      // Calculate recency score (bias towards newer content)
      const totalAgeDays = dates.reduce(
        (sum, d) => sum + (now - d) / (1000 * 60 * 60 * 24),
        0,
      );
      const avgAgeDays = totalAgeDays / dates.length;
      // Score: < 30 days = 100, < 1 year = 80, < 2 years = 60, etc.
      if (avgAgeDays < 30) analysis.recency_score = 100;
      else if (avgAgeDays < 365) analysis.recency_score = 80;
      else if (avgAgeDays < 730) analysis.recency_score = 60;
      else analysis.recency_score = 40;
    }

    analysis.timelines = dates.map((d) => d.toISOString().split("T")[0]);
    return analysis;
  }

  /**
   * Analyze patterns across content items
   */
  analyzePatterns(content_list, options = {}) {
    const analysis = {
      common_themes: [],
      source_distribution: {},
      temporal_patterns: options.include_temporal_analysis
        ? this.analyzeTemporalPatterns(content_list)
        : [],
      content_categories: {},
      quality_distribution: {},
    };

    // Source distribution
    const sources = {};
    content_list.forEach((content) => {
      const source = content.source || content.domain || "Unknown";
      sources[source] = (sources[source] || 0) + 1;
    });
    analysis.source_distribution = sources;

    // Common themes (simple keyword extraction)
    const all_text = content_list
      .map((content) => `${content.title} ${content.description}`.toLowerCase())
      .join(" ");

    // Extract common words (excluding stop words)
    const stop_words = [
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
    ];
    const words = all_text
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stop_words.includes(word));

    const word_frequency = {};
    words.forEach((word) => {
      word_frequency[word] = (word_frequency[word] || 0) + 1;
    });

    analysis.common_themes = Object.entries(word_frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, frequency: count }));

    // Quality distribution
    const quality_ranges = {
      "excellent (90-100)": 0,
      "good (70-89)": 0,
      "average (50-69)": 0,
      "poor (30-49)": 0,
      "very poor (0-29)": 0,
    };

    content_list.forEach((content) => {
      const quality = content.qualityScore || 0;
      if (quality >= 90) quality_ranges["excellent (90-100)"]++;
      else if (quality >= 70) quality_ranges["good (70-89)"]++;
      else if (quality >= 50) quality_ranges["average (50-69)"]++;
      else if (quality >= 30) quality_ranges["poor (30-49)"]++;
      else quality_ranges["very poor (0-29)"]++;
    });

    analysis.quality_distribution = quality_ranges;

    return analysis;
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(analysis_results) {
    const recommendations = [];

    // Quality recommendations
    if (analysis_results.quality_analysis) {
      const avg_quality =
        analysis_results.quality_analysis.average_quality_score;
      if (avg_quality < 50) {
        recommendations.push({
          type: "quality",
          priority: "high",
          recommendation:
            "Focus on higher quality sources. Consider filtering out low-quality content.",
        });
      }
    }

    // Relevance recommendations
    if (analysis_results.relevance_analysis) {
      const avg_relevance =
        analysis_results.relevance_analysis.average_relevance_score;
      if (avg_relevance < 40) {
        recommendations.push({
          type: "relevance",
          priority: "medium",
          recommendation:
            "Consider refining search terms to improve relevance to research focus.",
        });
      }
    }

    // Source recommendations
    if (analysis_results.patterns_analysis) {
      const source_count = Object.keys(
        analysis_results.patterns_analysis.source_distribution,
      ).length;
      if (source_count < 3) {
        recommendations.push({
          type: "diversity",
          priority: "medium",
          recommendation:
            "Increase source diversity for more comprehensive analysis.",
        });
      }
    }

    return recommendations;
  }

  /**
   * Perform comprehensive analysis
   */
  async analyze(content_to_analyze, args) {
    const analysis_results = {
      summary: {},
      detailed_analysis: {},
    };

    // 1. Analyze Quality
    if (args.include_quality_assessment) {
      const quality_results = content_to_analyze.map((content) => ({
        url: content.url,
        title: content.title,
        ...this.analyzeContentQuality(content, {
          min_quality_score: args.min_quality_score,
          country: args.country,
        }),
      }));

      const avg_score =
        quality_results.reduce(
          (sum, res) => sum + res.overall_quality_score,
          0,
        ) / quality_results.length;

      analysis_results.quality_analysis = {
        average_quality_score: avg_score,
        items_meeting_threshold: quality_results.filter(
          (r) => r.meets_quality_threshold,
        ).length,
        details: quality_results,
      };
    }

    // 2. Analyze Relevance
    if (args.include_relevance_scoring) {
      const relevance_results = content_to_analyze.map((content) => ({
        url: content.url,
        ...this.analyzeRelevance(content, {
          research_focus: args.research_focus,
          custom_keywords: args.custom_keywords,
          country: args.country,
        }),
      }));

      const avg_relevance =
        relevance_results.reduce((sum, res) => sum + res.relevance_score, 0) /
        relevance_results.length;

      analysis_results.relevance_analysis = {
        average_relevance_score: avg_relevance,
        focus_alignment_distribution: {
          high: relevance_results.filter((r) => r.focus_alignment === "high")
            .length,
          medium: relevance_results.filter(
            (r) => r.focus_alignment === "medium",
          ).length,
          low: relevance_results.filter((r) => r.focus_alignment === "low")
            .length,
        },
        details: relevance_results,
      };
    }

    // 3. Analyze Patterns
    if (args.include_pattern_analysis) {
      analysis_results.patterns_analysis = this.analyzePatterns(
        content_to_analyze,
        {
          include_temporal_analysis: args.include_temporal_analysis,
        },
      );
    }

    return analysis_results;
  }
}

export default new ContentAnalysisService();
