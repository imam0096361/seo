
export interface Keyword {
  term: string;
  rationale: string;
  searchIntent?: 'informational' | 'navigational' | 'transactional' | 'commercial';
  searchVolume?: 'high' | 'medium' | 'low' | string;  // Can be estimate or real number
  searchVolumeNumeric?: number;      // Real search volume from API (if available)
  difficulty?: 'easy' | 'medium' | 'hard';
  difficultyScore?: number;          // 0-100 (0=easiest, 100=impossible)
  winnability?: 'Easy' | 'Medium' | 'Hard' | 'Very Hard';
  // Bilingual support for Bangla keywords
  termBangla?: string;        // Bengali script version
  termEnglish?: string;       // English/transliteration version
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface RankingConfidence {
  overall: number;  // 0-100
  factors: {
    searchVolume: number;       // High volume = more traffic potential
    difficulty: number;         // Low difficulty = easier to rank
    articleRelevance: number;   // How well article covers keywords
    domainAuthority: number;    // Daily Star's authority
    freshnessBonus: number;     // News articles rank higher when fresh
  };
  topKeywords: Array<{
    term: string;
    confidence: number;  // Individual keyword confidence
    estimatedRank: string;  // "Top 3", "#1", "Top 10"
  }>;
}

export interface KeywordResult {
  primary: Keyword[];
  secondary: Keyword[];
  longtail: Keyword[];
  lsiKeywords?: Keyword[];
  entities?: Keyword[];
  questionKeywords?: Keyword[];
  competitorInsights: string;
  searchReferences: GroundingChunk[];
  contentType: string;
  seoScore?: number;
  metaTitle?: string;
  metaDescription?: string;
  serpFeatureTargets?: string[];
  localSeoSignals?: string[];
  rankingConfidence?: RankingConfidence;  // NEW: Ranking predictions
  dataSourceUsed?: 'gemini-estimate' | 'dataforseo-api' | 'google-data';  // Which data source
  // Bilingual/Bangla-specific fields
  detectedLanguage?: 'english' | 'bangla' | 'mixed';
  metaTitleBangla?: string;           // Bangla version of meta title
  metaDescriptionBangla?: string;     // Bangla version of meta description
  banglaSearchInsights?: string;      // Bangla-specific search behavior insights
  transliterationGuide?: string;      // How to transliterate key Bangla terms
}

// ============================================
// NEW INTERFACES FOR WORLD-CLASS SEO FEATURES
// ============================================

/**
 * Complete Metadata Package for 100% SEO Coverage
 */
export interface MetadataResult {
  // Open Graph (Facebook, LinkedIn, WhatsApp)
  openGraph: {
    ogTitle: string;
    ogDescription: string;
    ogType: 'article';
    ogUrl: string;
    ogImage: string;
    ogImageAlt: string;
    ogImageWidth: number;
    ogImageHeight: number;
    ogLocale: 'en_BD' | 'bn_BD';
    ogSiteName: 'The Daily Star';
    article: {
      publishedTime?: string;
      modifiedTime?: string;
      author: string[];
      section: string;
      tag: string[];
    };
  };

  // Twitter Cards (Twitter/X)
  twitter: {
    card: 'summary_large_image';
    site: '@dailystarnews';
    title: string;
    description: string;
    image: string;
    imageAlt: string;
  };

  // Schema.org JSON-LD (Rich Snippets & Knowledge Graph)
  schema: {
    newsArticle: object;
    breadcrumbList: object;
    organization: object;
    person?: object[];
    faqPage?: object;
  };

  // Technical SEO Meta Tags
  technical: {
    canonical: string;
    robots: string;
    googlebot: string;
    hreflang: Array<{
      lang: string;
      url: string;
    }>;
  };

  // Performance Hints
  performance: {
    preconnect: string[];
    dnsPrefetch: string[];
  };

  // Copy-ready HTML
  htmlTags: string;
}

/**
 * Headline Suggestions (The Daily Star Style)
 */
export interface HeadlineSuggestion {
  variants: Array<{
    headline: string;
    style: 'statement' | 'quote' | 'question' | 'number' | 'location' | 'urgency';
    length: number;
    powerWords: string[];
    emotionalScore: number;      // 0-100 (emotional engagement)
    clickabilityScore: number;    // 0-100 (predicted CTR)
    seoScore: number;             // 0-100 (keyword optimization)
    dailyStarCompliance: number;  // 0-100 (matches DS style)
    explanation: string;
  }>;

  currentHeadline: {
    text: string;
    analysis: {
      strengths: string[];
      weaknesses: string[];
      score: number;
    };
  };

  recommendations: {
    bestOverall: string;
    bestForSEO: string;
    bestForEngagement: string;
    bestForDailyStarStyle: string;
  };

  guidelines: {
    idealLength: string;
    toneAdvice: string;
    keywordPlacement: string;
  };
}

/**
 * SEO-Optimized URL Slug
 */
export interface SlugSuggestion {
  recommended: string;
  alternatives: string[];

  analysis: {
    keywordPresence: string[];
    length: number;
    readabilityScore: number;
    seoScore: number;
    dailyStarFormat: boolean;
  };

  structure: {
    category: string;
    subcategory?: string;
    articleType: string;
    slug: string;
    fullUrl: string;
  };

  banglaTransliteration?: {
    original: string;
    transliterated: string;
    romanized: string;
  };
}

/**
 * Internal Linking Intelligence
 */
export interface InternalLinkingSuggestions {
  recommendedLinks: Array<{
    anchorText: string;
    targetUrl: string;
    relevanceScore: number;        // 0-100
    keywordMatch: string[];
    placement: 'introduction' | 'body' | 'conclusion';
    reason: string;
    category: string;
  }>;

  contextualLinks: Array<{
    paragraph: string;              // First 100 chars of paragraph
    suggestedAnchors: string[];
    linkDensity: number;            // Percentage
    maxLinks: number;
  }>;

  siteStructure: {
    currentCategory: string;
    relatedCategories: string[];
    topicCluster: string;
    pillarPageSuggestion?: string;
  };

  strategy: {
    totalSuggestedLinks: number;
    internalLinkScore: number;      // 0-100
    recommendations: string[];
  };
}

/**
 * Google AI Overview Optimization (Critical for 2025+)
 */
export interface AIOverviewOptimization {
  aiReadiness: {
    overallScore: number;           // 0-100
    citationQuality: number;
    authoritySignals: number;
    structuredDataScore: number;
    comprehensivenessScore: number;
  };

  // People Also Ask (PAA)
  peopleAlsoAsk: Array<{
    question: string;
    answer: string;                 // Extracted from article
    confidence: number;             // How well article answers
    optimizationTips: string[];
    probability: number;            // Likelihood of appearing in PAA
  }>;

  // AI Citation Optimization
  citations: {
    citableQuotes: Array<{
      quote: string;
      context: string;
      citationScore: number;        // How citeable (0-100)
    }>;
    expertStatements: string[];
    statistics: Array<{
      stat: string;
      context: string;
      source?: string;
      verifiability: number;        // 0-100
    }>;
  };

  // E-E-A-T Signals
  eeat: {
    experience: {
      score: number;
      signals: string[];
    };
    expertise: {
      score: number;
      signals: string[];
    };
    authoritativeness: {
      score: number;
      signals: string[];
    };
    trustworthiness: {
      score: number;
      signals: string[];
    };
  };

  // Recommendations
  improvements: Array<{
    type: 'citation' | 'structure' | 'expertise' | 'depth' | 'eeat';
    priority: 'critical' | 'high' | 'medium' | 'low';
    issue: string;
    suggestion: string;
    impact: string;
  }>;

  // AI Overview Targeting
  aiOverviewTargeting: {
    eligibility: boolean;
    requiredChanges: string[];
    strengthScore: number;          // 0-100
  };
}

/**
 * Content Quality Analysis
 */
export interface ContentQualityAnalysis {
  readability: {
    fleschKincaidScore: number;
    fleschKincaidGrade: number;
    avgSentenceLength: number;
    avgWordLength: number;
    complexWords: number;
    syllablesPerWord: number;
    readingLevel: 'Very Easy' | 'Easy' | 'Fairly Easy' | 'Standard' | 'Fairly Difficult' | 'Difficult' | 'Very Difficult';
    readingTime: number;            // Minutes
  };

  depth: {
    wordCount: number;
    characterCount: number;
    paragraphCount: number;
    sentenceCount: number;
    headings: {
      h2: number;
      h3: number;
      h4: number;
      h5: number;
      h6: number;
    };
    avgParagraphLength: number;
    avgSentenceLength: number;
    depthScore: number;             // 0-100
    optimalWordCount: string;       // Recommended range
  };

  engagement: {
    questionsCount: number;
    statisticsCount: number;
    quotesCount: number;
    examplesCount: number;
    listsCount: number;
    tablesCount: number;
    engagementScore: number;        // 0-100
  };

  seo: {
    keywordDensity: number;         // Percentage
    keywordDistribution: 'even' | 'top-heavy' | 'bottom-heavy' | 'middle-heavy';
    keywordInTitle: boolean;
    keywordInFirstParagraph: boolean;
    keywordInLastParagraph: boolean;
    internalLinksCount: number;
    externalLinksCount: number;
    brokenLinksCount: number;
    imageCount: number;
    imagesWithAlt: number;
    seoHealthScore: number;         // 0-100
  };

  issues: Array<{
    severity: 'critical' | 'error' | 'warning' | 'info';
    type: 'readability' | 'seo' | 'structure' | 'content' | 'technical';
    message: string;
    location?: string;
    fix: string;
    impact: string;
  }>;

  recommendations: Array<{
    category: string;
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    expectedImpact: string;
  }>;

  overallScore: number;             // 0-100
}

/**
 * Complete SEO Analysis Result
 * Combines all features into one comprehensive result
 */
export interface CompleteSEOResult extends KeywordResult {
  metadata: MetadataResult;
  headlines: HeadlineSuggestion;
  slug: SlugSuggestion;
  internalLinking: InternalLinkingSuggestions;
  aiOverview: AIOverviewOptimization;
  contentQuality: ContentQualityAnalysis;

  // Summary Dashboard
  dashboard: {
    overallSEOScore: number;        // 0-100
    readinessForPublish: boolean;
    criticalIssues: number;
    recommendations: string[];
    estimatedTraffic: string;
    competitiveEdge: string;
  };
}