/**
 * Slug Generation Service - The Daily Star URL Format
 * Generates SEO-optimized URL slugs following thedailystar.net patterns
 * Format: /[category]/[subcategory]/[article-type]/[headline-slug]-[ID]
 */

import { GoogleGenAI } from "@google/genai";
import type { SlugSuggestion, Keyword } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Stop words to remove from slugs (common English words with low SEO value)
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'this', 'but', 'they', 'have', 'had',
]);

/**
 * Bangla to English transliteration map
 */
const BANGLA_TRANSLITERATION: { [key: string]: string } = {
  'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri',
  'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
  'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
  'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'ny',
  'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
  'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
  'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
  'য': 'z', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
  'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri',
  'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
  'ং': 'ng', 'ঃ': 'h', 'ঁ': '',
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

/**
 * The Daily Star category mapping
 */
const CATEGORY_MAP: { [key: string]: string } = {
  'business': 'business',
  'sports': 'sports',
  'entertainment': 'entertainment',
  'tech': 'tech',
  'technology': 'tech',
  'startup': 'tech',
  'opinion': 'opinion',
  'world': 'world',
  'international': 'world',
  'lifestyle': 'lifestyle',
  'health': 'health',
  'education': 'education',
  'campus': 'campus',
  // Default Bangladesh news
  'politics': 'news/bangladesh/politics',
  'crime': 'news/bangladesh/crime-justice',
  'bangladesh': 'news/bangladesh',
};

/**
 * Generates SEO-optimized slug suggestions
 */
export const generateSlugSuggestions = async (
  headline: string,
  primaryKeywords: Keyword[],
  contentType: string,
  detectedLanguage: 'english' | 'bangla' | 'mixed'
): Promise<SlugSuggestion> => {

  const keywordTerms = primaryKeywords.map(k => k.term).join(', ');

  const prompt = `You are an SEO URL specialist for The Daily Star Bangladesh.

**Task:** Generate the perfect URL slug for this article following The Daily Star's URL structure.

**Headline:** ${headline}
**Primary Keywords:** ${keywordTerms}
**Content Type:** ${contentType}
**Language:** ${detectedLanguage}

**THE DAILY STAR URL STRUCTURE:**

Pattern: \`/[category]/[subcategory]/[article-type]/[headline-slug]\`

Examples from thedailystar.net:
1. \`/news/bangladesh/politics/news/referendum-must-be-held-election-day-fakhrul\`
2. \`/business/news/govt-may-consider-compensating-small-shareholders-bb\`
3. \`/business/economy/banks/news/trading-five-banks-shares-suspended-merger-process-begins\`
4. \`/news/asia/news/philippines-death-toll-tops-140-typhoon-heads-towards-vietnam\`

**SLUG GENERATION RULES:**

1. **Lowercase only:** all letters lowercase
2. **Hyphen separator:** use hyphens (-) not underscores
3. **Remove stop words:** remove 'a', 'the', 'is', 'of', 'in', 'to', etc.
4. **Keep meaningful words:** verbs, nouns, adjectives, numbers
5. **Keyword-rich:** include primary keywords
6. **Length:** 50-80 characters ideal
7. **Readable:** humans should understand it
8. **No special chars:** only a-z, 0-9, and hyphens

**CATEGORY MAPPING:**
- Business articles → \`/business/news/\`
- Politics → \`/news/bangladesh/politics/news/\`
- Crime → \`/news/bangladesh/crime-justice/news/\`
- International → \`/news/asia/news/\` or \`/news/world/news/\`
- Sports → \`/sports/news/\`
- Tech → \`/tech/startup/news/\`

**For Bangla Content:**
- Transliterate Bangla to English (readable phonetic)
- Example: "বাংলাদেশ ব্যাংক" → "bangladesh-bank"
- Keep recognizable terms in English

**Generate:**
1. **Recommended slug** (best option)
2. **3 Alternative slugs** (variations)
3. **Category path** (correct Daily Star category structure)

**Output JSON:**
{
  "recommendedSlug": "primary-keyword-action-context",
  "alternatives": [
    "variant-1-slightly-different",
    "variant-2-different-focus",
    "variant-3-shorter-version"
  ],
  "category": "news",
  "subcategory": "bangladesh",
  "articleType": "news",
  "fullPath": "/news/bangladesh/news/recommended-slug"
}

Respond with ONLY the JSON object.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const aiResult = JSON.parse(response.text || '{}');

    const recommended = aiResult.recommendedSlug || createBasicSlug(headline);
    const alternatives = aiResult.alternatives || [];

    // Build analysis
    const keywordsInSlug = primaryKeywords.filter(k =>
      recommended.toLowerCase().includes(k.term.toLowerCase().split(' ')[0])
    );

    const analysis = {
      keywordPresence: keywordsInSlug.map(k => k.term),
      length: recommended.length,
      readabilityScore: calculateReadabilityScore(recommended),
      seoScore: calculateSlugSEOScore(recommended, primaryKeywords),
      dailyStarFormat: true,
    };

    const structure = {
      category: aiResult.category || 'news',
      subcategory: aiResult.subcategory,
      articleType: aiResult.articleType || 'news',
      slug: recommended,
      fullUrl: `https://www.thedailystar.net${aiResult.fullPath || `/news/news/${recommended}`}`,
    };

    // Bangla transliteration if needed
    let banglaTransliteration;
    if (detectedLanguage === 'bangla' || detectedLanguage === 'mixed') {
      banglaTransliteration = {
        original: headline,
        transliterated: recommended,
        romanized: transliterateBangla(headline),
      };
    }

    return {
      recommended,
      alternatives,
      analysis,
      structure,
      banglaTransliteration,
    };

  } catch (error) {
    console.error('Error generating slug:', error);

    // Fallback to basic slug generation
    return generateFallbackSlug(headline, primaryKeywords, contentType, detectedLanguage);
  }
};

/**
 * Creates a basic slug from headline
 */
const createBasicSlug = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD') // Decompose characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .trim()
    .split(/\s+/)
    .filter(word => !STOP_WORDS.has(word)) // Remove stop words
    .join('-')
    .replace(/-+/g, '-') // Remove multiple hyphens
    .substring(0, 80); // Limit length
};

/**
 * Transliterates Bangla text to English
 */
const transliterateBangla = (text: string): string => {
  return text
    .split('')
    .map(char => BANGLA_TRANSLITERATION[char] || char)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0 && !STOP_WORDS.has(word))
    .join('-')
    .substring(0, 80);
};

/**
 * Calculates readability score for slug (0-100)
 */
const calculateReadabilityScore = (slug: string): number => {
  let score = 100;

  // Penalize very long slugs
  if (slug.length > 80) score -= 20;
  if (slug.length > 100) score -= 30;

  // Penalize too many hyphens (hard to read)
  const hyphenCount = (slug.match(/-/g) || []).length;
  if (hyphenCount > 10) score -= 15;

  // Reward moderate length
  if (slug.length >= 40 && slug.length <= 70) score += 10;

  return Math.max(0, Math.min(100, score));
};

/**
 * Calculates SEO score for slug (0-100)
 */
const calculateSlugSEOScore = (slug: string, keywords: Keyword[]): number => {
  let score = 50;

  // Check keyword presence
  const slugLower = slug.toLowerCase();
  keywords.forEach((keyword, idx) => {
    const keywordParts = keyword.term.toLowerCase().split(' ');
    const matchCount = keywordParts.filter(part => slugLower.includes(part)).length;

    if (matchCount === keywordParts.length) {
      // Full keyword match
      score += (idx === 0 ? 30 : 15); // Primary keyword worth more
    } else if (matchCount > 0) {
      // Partial match
      score += (idx === 0 ? 15 : 5);
    }
  });

  // Reward clean, readable structure
  if (slug.length >= 30 && slug.length <= 70) score += 5;

  return Math.max(0, Math.min(100, score));
};

/**
 * Fallback slug generation if AI fails
 */
const generateFallbackSlug = (
  headline: string,
  primaryKeywords: Keyword[],
  contentType: string,
  detectedLanguage: 'english' | 'bangla' | 'mixed'
): SlugSuggestion => {

  const basic = createBasicSlug(headline);
  const keywordBased = primaryKeywords.length > 0
    ? createBasicSlug(primaryKeywords[0].term)
    : basic;

  const recommended = basic.length > 0 ? basic : keywordBased;

  const category = contentType.includes('Business') ? 'business' : 'news';

  return {
    recommended,
    alternatives: [
      keywordBased,
      recommended.substring(0, 50),
    ].filter((s, i, arr) => s && s.length > 10 && arr.indexOf(s) === i),
    analysis: {
      keywordPresence: primaryKeywords.filter(k =>
        recommended.includes(k.term.toLowerCase().split(' ')[0])
      ).map(k => k.term),
      length: recommended.length,
      readabilityScore: calculateReadabilityScore(recommended),
      seoScore: calculateSlugSEOScore(recommended, primaryKeywords),
      dailyStarFormat: true,
    },
    structure: {
      category,
      articleType: 'news',
      slug: recommended,
      fullUrl: `https://www.thedailystar.net/${category}/news/${recommended}`,
    },
    banglaTransliteration: (detectedLanguage === 'bangla' || detectedLanguage === 'mixed') ? {
      original: headline,
      transliterated: recommended,
      romanized: transliterateBangla(headline),
    } : undefined,
  };
};
