/**
 * Content Quality Analysis Service
 * Analyzes readability, depth, engagement, and SEO health
 */

import type { ContentQualityAnalysis, Keyword } from '../types';

/**
 * Analyzes content quality comprehensively
 */
export const analyzeContentQuality = (
  articleContent: string,
  primaryKeywords: Keyword[]
): ContentQualityAnalysis => {

  // Readability Analysis
  const readability = analyzeReadability(articleContent);

  // Depth Analysis
  const depth = analyzeDepth(articleContent);

  // Engagement Analysis
  const engagement = analyzeEngagement(articleContent);

  // SEO Analysis
  const seo = analyzeSEO(articleContent, primaryKeywords);

  // Issues Detection
  const issues = detectIssues(readability, depth, engagement, seo);

  // Recommendations
  const recommendations = generateRecommendations(readability, depth, engagement, seo);

  // Overall Score (weighted average)
  const overallScore = Math.round(
    (readability.fleschKincaidScore * 0.2) +
    (depth.depthScore * 0.3) +
    (engagement.engagementScore * 0.2) +
    (seo.seoHealthScore * 0.3)
  );

  return {
    readability,
    depth,
    engagement,
    seo,
    issues,
    recommendations,
    overallScore,
  };
};

/**
 * Analyzes readability using Flesch-Kincaid and other metrics
 */
const analyzeReadability = (content: string): ContentQualityAnalysis['readability'] => {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);

  const sentenceCount = sentences.length || 1;
  const wordCount = words.length || 1;
  const syllableCount = syllables || 1;

  const avgSentenceLength = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllableCount / wordCount;
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / wordCount;

  // Flesch-Kincaid Reading Ease (0-100, higher = easier)
  const fleschKincaidScore = Math.max(0, Math.min(100,
    206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord)
  ));

  // Flesch-Kincaid Grade Level
  const fleschKincaidGrade = (0.39 * avgSentenceLength) + (11.8 * avgSyllablesPerWord) - 15.59;

  // Complex words (3+ syllables)
  const complexWords = words.filter(w => countSyllables(w) >= 3).length;

  // Reading Level
  const readingLevel = getReadingLevel(fleschKincaidScore);

  // Reading Time (250 words per minute average)
  const readingTime = Math.ceil(wordCount / 250);

  return {
    fleschKincaidScore: Math.round(fleschKincaidScore),
    fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgWordLength: Math.round(avgWordLength * 10) / 10,
    complexWords,
    syllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
    readingLevel,
    readingTime,
  };
};

/**
 * Counts syllables in a word (simple heuristic)
 */
const countSyllables = (word: string): number => {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  const vowels = word.match(/[aeiouy]+/g);
  let count = vowels ? vowels.length : 0;

  // Adjust for silent 'e'
  if (word.endsWith('e')) count--;
  if (word.endsWith('le') && word.length > 2) count++;

  return Math.max(1, count);
};

/**
 * Determines reading level from Flesch-Kincaid score
 */
const getReadingLevel = (score: number): ContentQualityAnalysis['readability']['readingLevel'] => {
  if (score >= 90) return 'Very Easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly Easy';
  if (score >= 60) return 'Standard';
  if (score >= 50) return 'Fairly Difficult';
  if (score >= 30) return 'Difficult';
  return 'Very Difficult';
};

/**
 * Analyzes content depth and structure
 */
const analyzeDepth = (content: string): ContentQualityAnalysis['depth'] => {
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const characterCount = content.length;

  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const paragraphCount = paragraphs.length;

  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length || 1;

  // Count headings (simple heuristic - lines that are short and end without punctuation)
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const headings = {
    h2: 0, // Can't detect from plain text, but we can estimate
    h3: 0,
    h4: 0,
    h5: 0,
    h6: 0,
  };

  // Estimate: short lines (< 100 chars) without ending punctuation
  const potentialHeadings = lines.filter(line =>
    line.length < 100 &&
    !/[.!?]$/.test(line.trim()) &&
    line.length > 10
  ).length;
  headings.h2 = Math.min(potentialHeadings, 10);

  const avgParagraphLength = paragraphCount > 0 ? wordCount / paragraphCount : 0;
  const avgSentenceLength = wordCount / sentenceCount;

  // Depth Score (0-100)
  let depthScore = 50;
  if (wordCount >= 800 && wordCount <= 2000) depthScore += 20;
  if (wordCount > 2000) depthScore += 30;
  if (paragraphCount >= 5) depthScore += 10;
  if (potentialHeadings >= 3) depthScore += 10;
  if (avgParagraphLength >= 80 && avgParagraphLength <= 150) depthScore += 10;
  depthScore = Math.min(100, depthScore);

  // Optimal word count for news articles
  const optimalWordCount = wordCount < 500 ? '500-800 words'
    : wordCount < 1000 ? '800-1500 words (good)'
    : wordCount < 2000 ? '1000-2000 words (excellent)'
    : '1500-2500 words (comprehensive)';

  return {
    wordCount,
    characterCount,
    paragraphCount,
    sentenceCount,
    headings,
    avgParagraphLength: Math.round(avgParagraphLength),
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    depthScore,
    optimalWordCount,
  };
};

/**
 * Analyzes engagement elements
 */
const analyzeEngagement = (content: string): ContentQualityAnalysis['engagement'] => {
  const questionsCount = (content.match(/\?/g) || []).length;
  const statisticsCount = (content.match(/\d+(\.\d+)?%|\d+\s*(percent|per cent)/gi) || []).length;
  const quotesCount = (content.match(/[""].*?[""]|[''].*?['']/g) || []).length;

  // Examples (heuristic: phrases like "for example", "such as", "for instance")
  const examplesCount = (content.match(/for example|such as|for instance|e\.g\./gi) || []).length;

  // Lists (heuristic: bullet points or numbered lists)
  const listsCount = (content.match(/^\s*[-•*]\s/gm) || []).length +
                     (content.match(/^\s*\d+\.\s/gm) || []).length;

  // Tables (can't detect in plain text, estimate)
  const tablesCount = 0;

  // Engagement Score
  let engagementScore = 40;
  if (questionsCount > 0) engagementScore += 10;
  if (statisticsCount >= 3) engagementScore += 15;
  if (quotesCount >= 2) engagementScore += 15;
  if (examplesCount >= 1) engagementScore += 10;
  if (listsCount >= 1) engagementScore += 10;
  engagementScore = Math.min(100, engagementScore);

  return {
    questionsCount,
    statisticsCount,
    quotesCount,
    examplesCount,
    listsCount,
    tablesCount,
    engagementScore,
  };
};

/**
 * Analyzes SEO health
 */
const analyzeSEO = (
  content: string,
  primaryKeywords: Keyword[]
): ContentQualityAnalysis['seo'] => {

  if (primaryKeywords.length === 0) {
    return {
      keywordDensity: 0,
      keywordDistribution: 'even',
      keywordInTitle: false,
      keywordInFirstParagraph: false,
      keywordInLastParagraph: false,
      internalLinksCount: 0,
      externalLinksCount: 0,
      brokenLinksCount: 0,
      imageCount: 0,
      imagesWithAlt: 0,
      seoHealthScore: 50,
    };
  }

  const primaryKeyword = primaryKeywords[0].term.toLowerCase();
  const contentLower = content.toLowerCase();
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Keyword density
  const keywordOccurrences = (contentLower.match(new RegExp(primaryKeyword, 'g')) || []).length;
  const keywordDensity = (keywordOccurrences / wordCount) * 100;

  // Keyword distribution
  const firstThird = content.substring(0, content.length / 3).toLowerCase();
  const middleThird = content.substring(content.length / 3, 2 * content.length / 3).toLowerCase();
  const lastThird = content.substring(2 * content.length / 3).toLowerCase();

  const firstCount = (firstThird.match(new RegExp(primaryKeyword, 'g')) || []).length;
  const middleCount = (middleThird.match(new RegExp(primaryKeyword, 'g')) || []).length;
  const lastCount = (lastThird.match(new RegExp(primaryKeyword, 'g')) || []).length;

  let keywordDistribution: 'even' | 'top-heavy' | 'bottom-heavy' | 'middle-heavy' = 'even';
  if (firstCount > middleCount && firstCount > lastCount) keywordDistribution = 'top-heavy';
  else if (lastCount > firstCount && lastCount > middleCount) keywordDistribution = 'bottom-heavy';
  else if (middleCount > firstCount && middleCount > lastCount) keywordDistribution = 'middle-heavy';

  // Keyword placement
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const title = lines[0] || '';
  const firstParagraph = content.split(/\n\n+/)[0] || '';
  const lastParagraph = content.split(/\n\n+/).slice(-1)[0] || '';

  const keywordInTitle = title.toLowerCase().includes(primaryKeyword);
  const keywordInFirstParagraph = firstParagraph.toLowerCase().includes(primaryKeyword);
  const keywordInLastParagraph = lastParagraph.toLowerCase().includes(primaryKeyword);

  // Links (can't detect in plain text, but can estimate from URLs)
  const urlPattern = /https?:\/\/[^\s]+/g;
  const urls = content.match(urlPattern) || [];
  const internalLinksCount = urls.filter(url => url.includes('thedailystar.net')).length;
  const externalLinksCount = urls.length - internalLinksCount;

  // Images (can't detect in plain text)
  const imageCount = 0;
  const imagesWithAlt = 0;

  // SEO Health Score
  let seoHealthScore = 50;
  if (keywordDensity >= 0.5 && keywordDensity <= 2.5) seoHealthScore += 15;
  if (keywordInTitle) seoHealthScore += 15;
  if (keywordInFirstParagraph) seoHealthScore += 10;
  if (keywordDistribution === 'even' || keywordDistribution === 'top-heavy') seoHealthScore += 10;
  seoHealthScore = Math.min(100, seoHealthScore);

  return {
    keywordDensity: Math.round(keywordDensity * 100) / 100,
    keywordDistribution,
    keywordInTitle,
    keywordInFirstParagraph,
    keywordInLastParagraph,
    internalLinksCount,
    externalLinksCount,
    brokenLinksCount: 0,
    imageCount,
    imagesWithAlt,
    seoHealthScore,
  };
};

/**
 * Detects content issues
 */
const detectIssues = (
  readability: any,
  depth: any,
  engagement: any,
  seo: any
): ContentQualityAnalysis['issues'] => {

  const issues: ContentQualityAnalysis['issues'] = [];

  // Readability issues
  if (readability.fleschKincaidScore < 50) {
    issues.push({
      severity: 'warning',
      type: 'readability',
      message: 'Content is difficult to read',
      fix: 'Use shorter sentences and simpler words',
      impact: 'May lose readers with complex language',
    });
  }

  if (readability.avgSentenceLength > 25) {
    issues.push({
      severity: 'warning',
      type: 'readability',
      message: 'Sentences are too long (avg > 25 words)',
      fix: 'Break long sentences into shorter ones',
      impact: 'Reduces readability and engagement',
    });
  }

  // Depth issues
  if (depth.wordCount < 300) {
    issues.push({
      severity: 'critical',
      type: 'content',
      message: 'Content too short (< 300 words)',
      fix: 'Add more depth and detail to the article',
      impact: 'Google prefers longer, comprehensive content',
    });
  }

  if (depth.paragraphCount < 3) {
    issues.push({
      severity: 'warning',
      type: 'structure',
      message: 'Too few paragraphs',
      fix: 'Break content into more paragraphs',
      impact: 'Large text blocks discourage reading',
    });
  }

  // SEO issues
  if (!seo.keywordInTitle) {
    issues.push({
      severity: 'error',
      type: 'seo',
      message: 'Primary keyword not in title',
      fix: 'Include primary keyword in the title',
      impact: 'Major SEO ranking factor',
    });
  }

  if (!seo.keywordInFirstParagraph) {
    issues.push({
      severity: 'warning',
      type: 'seo',
      message: 'Primary keyword not in first paragraph',
      fix: 'Mention primary keyword early in content',
      impact: 'Helps search engines understand topic',
    });
  }

  if (seo.keywordDensity < 0.5) {
    issues.push({
      severity: 'warning',
      type: 'seo',
      message: 'Keyword density too low (< 0.5%)',
      fix: 'Use primary keyword more naturally throughout',
      impact: 'Search engines may not recognize topic relevance',
    });
  }

  if (seo.keywordDensity > 3) {
    issues.push({
      severity: 'error',
      type: 'seo',
      message: 'Keyword stuffing detected (> 3%)',
      fix: 'Reduce keyword usage, use synonyms',
      impact: 'Google penalty risk',
    });
  }

  return issues;
};

/**
 * Generates recommendations
 */
const generateRecommendations = (
  readability: any,
  depth: any,
  engagement: any,
  seo: any
): ContentQualityAnalysis['recommendations'] => {

  const recommendations: ContentQualityAnalysis['recommendations'] = [];

  if (depth.wordCount < 800) {
    recommendations.push({
      category: 'Content Depth',
      priority: 'high',
      recommendation: 'Expand article to 800-1500 words for better SEO',
      expectedImpact: 'Improved rankings and authority',
    });
  }

  if (engagement.statisticsCount < 2) {
    recommendations.push({
      category: 'Engagement',
      priority: 'medium',
      recommendation: 'Add statistics and data to support claims',
      expectedImpact: 'Increases credibility and engagement',
    });
  }

  if (engagement.quotesCount < 1) {
    recommendations.push({
      category: 'Engagement',
      priority: 'medium',
      recommendation: 'Include expert quotes or statements',
      expectedImpact: 'Adds authority and E-E-A-T signals',
    });
  }

  if (seo.seoHealthScore < 70) {
    recommendations.push({
      category: 'SEO',
      priority: 'high',
      recommendation: 'Improve keyword placement and density',
      expectedImpact: 'Better search engine visibility',
    });
  }

  if (readability.fleschKincaidScore < 60) {
    recommendations.push({
      category: 'Readability',
      priority: 'medium',
      recommendation: 'Simplify language for broader audience',
      expectedImpact: 'Better user engagement and time on page',
    });
  }

  return recommendations;
};
