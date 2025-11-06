/**
 * Headline Suggestion Service - The Daily Star Style
 * Generates multiple headline variants matching The Daily Star's editorial guidelines
 * Based on analysis of thedailystar.net headline patterns
 */

import { GoogleGenAI } from "@google/genai";
import type { HeadlineSuggestion, Keyword } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * The Daily Star Headline Style Guidelines (from website analysis)
 */
const DAILY_STAR_GUIDELINES = {
  lengthRange: { min: 50, max: 80 },
  idealLength: 65,

  patterns: {
    statement: 'Direct, declarative structure: "Trading of five banks\' shares suspended as merger process begins"',
    quote: 'Attribution with colon: "Referendum must be held on election day: Fakhrul"',
    question: 'Rare, but direct: "What impact will rate cut have?"',
    number: 'Specific data: "Customs seizes Tk 6.5cr worth banned poppy seeds"',
    location: 'Location + event: "Dhaka traffic congestion worsens during monsoon"',
    urgency: 'Breaking news format: "NCP starts selling nomination forms"',
  },

  characteristics: [
    'Factual, news-driven tone',
    'Minimal punctuation (avoid em-dashes)',
    'Colons separate main claim from source/context',
    'Active voice preferred',
    'Present tense for immediacy',
    'Numbers and specifics emphasized',
    'Attribution for quotes',
  ],

  avoid: [
    'Sensationalism',
    'Clickbait phrases',
    'Excessive punctuation',
    'Passive voice',
    'Vague language',
  ],
};

/**
 * Power words for news headlines (contextual, not clickbait)
 */
const POWER_WORDS = {
  urgency: ['Breaking', 'Now', 'Latest', 'Today', 'Emergency'],
  impact: ['Major', 'Key', 'Critical', 'Significant', 'Important'],
  action: ['Announces', 'Launches', 'Reveals', 'Suspends', 'Begins', 'Cuts', 'Increases'],
  authority: ['Government', 'Official', 'Report', 'Study', 'Expert'],
  scale: ['Massive', 'Record', 'Historic', 'Unprecedented'],
};

/**
 * Generates headline suggestions optimized for The Daily Star style and SEO
 */
export const generateHeadlineSuggestions = async (
  articleContent: string,
  currentHeadline: string,
  primaryKeywords: Keyword[],
  detectedLanguage: 'english' | 'bangla' | 'mixed'
): Promise<HeadlineSuggestion> => {

  const keywordTerms = primaryKeywords.map(k => k.term).join(', ');

  // Determine if this is Bangla content
  const isBangla = detectedLanguage === 'bangla' || detectedLanguage === 'mixed';
  const banglaCharRegex = /[\u0980-\u09FF]/;
  const hasBanglaChars = banglaCharRegex.test(currentHeadline) || banglaCharRegex.test(articleContent);
  const shouldGenerateBangla = isBangla || hasBanglaChars;

  console.log('📰 Headline Generation Config:', {
    detectedLanguage,
    hasBanglaChars,
    shouldGenerateBangla,
    currentHeadline: currentHeadline.substring(0, 50) + '...',
  });

  // Build language-specific prompt
  const languageInstruction = shouldGenerateBangla
    ? `**CRITICAL: THIS IS A BANGLA (বাংলা) ARTICLE**
- Generate ALL headlines in BENGALI/BANGLA script (বাংলা ভাষা)
- Use proper Bangla grammar, syntax, and news headline style
- Follow The Daily Star Bangla section editorial guidelines
- Do NOT transliterate - write in actual Bengali script
- Ensure natural, fluent Bangla that sounds native
- Use appropriate Bangla news terminology`
    : `**Language: English**
- Generate all headlines in English
- Follow The Daily Star English edition style`;

  const prompt = `You are The Daily Star Bangladesh's senior headline editor with 15+ years experience.

**Your Mission:** Generate 8-10 headline variants for this article that match The Daily Star's exact editorial style.

${languageInstruction}

**Current Headline:** ${currentHeadline}

**Article Content (first 800 chars):**
${articleContent.substring(0, 800)}

**Primary SEO Keywords:** ${keywordTerms}

**Detected Language:** ${detectedLanguage}

**THE DAILY STAR HEADLINE STYLE RULES:**

**Observed Patterns from thedailystar.net:**

${shouldGenerateBangla ? `
**FOR BANGLA (বাংলা) HEADLINES:**

1. **STATEMENT Style** (সাধারণ বিবৃতি):
   - সরাসরি, ঘোষণামূলক গঠন
   - Example: "পাঁচ ব্যাংকের শেয়ার লেনদেন স্থগিত, একীভূতকরণ প্রক্রিয়া শুরু"
   - Format: [কর্ম] + [বিষয়] + [প্রসঙ্গ/কারণ]

2. **QUOTE/ATTRIBUTION Style** (উদ্ধৃতি):
   - কোলন দিয়ে বক্তব্য এবং সূত্র আলাদা করুন
   - Example: "নির্বাচনের দিনেই গণভোট হতে হবে: ফখরুল"
   - Format: "[মূল বক্তব্য]: [সূত্রের নাম]"

3. **NUMBER/DATA Style** (সংখ্যা/তথ্য):
   - নির্দিষ্ট সংখ্যা বা পরিসংখ্যান দিয়ে শুরু
   - Example: "কাস্টমস ৬.৫ করোড় টাকার নিষিদ্ধ পোস্ত বীজ জব্দ"
   - Format: [সংস্থা] + [কর্ম] + [নির্দিষ্ট পরিমাণ] + [প্রসঙ্গ]

4. **LOCATION + EVENT Style** (স্থান ও ঘটনা):
   - স্থানীয় সংবাদের জন্য ভৌগোলিক ফোকাস
   - Example: "ঢাকায় যানজট বৃদ্ধি, জনভোগান্তি চরমে"
   - Format: [কে] + [কর্ম] + [কী] + [কোথায়/কেন]

5. **URGENT/BREAKING Style** (জরুরি):
   - সংক্ষিপ্ত, তাৎক্ষণিক, কর্ম-কেন্দ্রিক
   - Example: "জাতীয় পার্টি মনোনয়নপত্র বিক্রয় শুরু"
   - Format: [সংগঠন] + [কর্ম] + [বিষয়]

6. **QUESTION Style** (প্রশ্ন - বিরল):
   - সংযতভাবে ব্যবহার করুন
   - Example: "সুদের হার কমলে কি মূল্যস্ফীতি কমবে?"

**BANGLA HEADLINE REQUIREMENTS:**
- Must be in proper Bengali script (বাংলা)
- Use native Bangla news terminology
- Follow সংবাদপত্র শিরোনাম conventions
- Natural flow - avoid word-by-word translation
- Appropriate verb forms and postpositions
- Cultural context awareness
` : `
1. **STATEMENT Style** (Most Common):
   - Direct, declarative structure
   - Example: "Trading of five banks' shares suspended as merger process begins"
   - Format: [Action] + [Subject] + [Context/Reason]

2. **QUOTE/ATTRIBUTION Style**:
   - Use colon to separate claim from source
   - Example: "Referendum must be held on election day: Fakhrul"
   - Format: "[Main Claim]: [Source Name]"

3. **NUMBER/DATA Style**:
   - Lead with specific numbers or statistics
   - Example: "Customs seizes Tk 6.5cr worth banned poppy seeds at Ctg port"
   - Format: [Agency] + [Action] + [Specific Amount/Number] + [Context]

4. **LOCATION + EVENT Style**:
   - Geographic focus for local news
   - Example: "University teachers, students protest govt move to drop music, PE posts at primary schools"
   - Format: [Who] + [Action] + [What] + [Where/Why]

5. **URGENT/BREAKING Style**:
   - Short, immediate, action-focused
   - Example: "NCP starts selling nomination forms"
   - Format: [Organization] + [Action] + [Object]

6. **QUESTION Style** (Rare):
   - Use sparingly, only when truly appropriate
   - Must be answerable by article
   - Example: "Will interest rate cut reduce inflation in Bangladesh?"
`}

**MANDATORY STYLE REQUIREMENTS:**

${shouldGenerateBangla ? `
✅ Length: 50-120 characters (Bangla chars counted, ideal: 80)
✅ Language: 100% Bengali script - NO English words unless proper nouns
✅ Tone: তথ্যভিত্তিক, সাংবাদিক, কর্তৃত্বপূর্ণ (Factual, journalistic, authoritative)
✅ Voice: সক্রিয় কণ্ঠস্বর (Active voice)
✅ Tense: বর্তমান কাল for immediacy
✅ Natural Bangla: Must sound like native Bangla news headlines
✅ Numbers: Use Bengali numerals (০১২৩৪৫৬৭৮৯) or English (0-9) based on Daily Star Bangla convention
✅ Keywords: Naturally incorporate Bangla keywords
✅ No clickbait: Avoid সাংবাদিক নৈতিকতা লঙ্ঘন
` : `
✅ Length: 50-80 characters (ideal: 65)
✅ Tone: Factual, journalistic, authoritative
✅ Voice: Active voice only
✅ Tense: Present tense for immediacy
✅ Punctuation: Minimal (colons OK, avoid em-dashes, limit commas)
✅ Attribution: Use colons for quoted statements
✅ Specifics: Include numbers, names, locations when available
✅ Keywords: Incorporate primary keyword naturally
✅ No clickbait: Avoid "You won't believe," "Shocking," etc.
`}

**SCORING CRITERIA:**

1. **Emotional Score** (0-100): Engagement without sensationalism
2. **Clickability Score** (0-100): Likelihood of clicks from search/social
3. **SEO Score** (0-100): Keyword placement and optimization
4. **Daily Star Compliance** (0-100): How well it matches DS editorial style

**POWER WORDS (Use Contextually):**
- Urgency: Breaking, Latest, Now, Today
- Action: Announces, Launches, Cuts, Increases, Suspends
- Authority: Government, Official, Expert, Report
- Scale: Major, Record, Significant, Key

**Generate 8-10 variants covering different styles:**
- 2-3 Statement style
- 2 Quote/Attribution style (if applicable)
- 1-2 Number/Data style (if data available)
- 1-2 Location + Event style
- 1 Urgent/Breaking style
- 1 Question style (optional)

${shouldGenerateBangla ? `
**🚨 CRITICAL FOR BANGLA CONTENT:**
- ALL headline text MUST be in Bengali script (বাংলা)
- Read the article content carefully to understand context
- Generate headlines that a native Bangla speaker would write
- Do NOT write English headlines
- Do NOT transliterate (e.g., "Bangladesh Bank" should be "বাংলাদেশ ব্যাংক")
- Proper nouns in English are acceptable only if commonly used (e.g., "ডিএমপি", "র‍্যাব")
- Example GOOD Bangla headline: "বাংলাদেশ ব্যাংকের নতুন সুদহার ঘোষণা"
- Example BAD headline: "Bangladesh Bank announces new interest rate"
` : ''}

**Output JSON Format:**

{
  "variants": [
    {
      "headline": "Exact headline text (50-80 chars)",
      "style": "statement" | "quote" | "question" | "number" | "location" | "urgency",
      "length": 65,
      "powerWords": ["word1", "word2"],
      "emotionalScore": 75,
      "clickabilityScore": 82,
      "seoScore": 90,
      "dailyStarCompliance": 95,
      "explanation": "Why this headline works: matches DS statement pattern, includes primary keyword, active voice, specific data"
    }
  ],
  "currentHeadlineAnalysis": {
    "strengths": ["Lists 2-3 strengths"],
    "weaknesses": ["Lists 2-3 areas for improvement"],
    "overallScore": 70
  },
  "recommendations": {
    "bestOverall": "headline with highest combined scores",
    "bestForSEO": "headline with highest SEO score",
    "bestForEngagement": "headline with highest clickability",
    "bestForDailyStarStyle": "headline with highest DS compliance"
  },
  "guidelines": {
    "idealLength": "60-70 characters for optimal display",
    "toneAdvice": "Maintain factual, authoritative tone. This is news, not entertainment.",
    "keywordPlacement": "Primary keyword should appear in first 5 words"
  }
}

Respond with ONLY the JSON object. No markdown, no wrapper text.`;

  try {
    // Use more capable model for Bangla content
    const model = shouldGenerateBangla ? 'gemini-2.5-pro-latest' : 'gemini-2.0-flash-exp';

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        temperature: shouldGenerateBangla ? 0.5 : 0.7, // Lower temp for Bangla accuracy
        topP: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response.text || '{}');

    return {
      variants: result.variants || [],
      currentHeadline: {
        text: currentHeadline,
        analysis: {
          strengths: result.currentHeadlineAnalysis?.strengths || [],
          weaknesses: result.currentHeadlineAnalysis?.weaknesses || [],
          score: result.currentHeadlineAnalysis?.overallScore || 50,
        },
      },
      recommendations: result.recommendations || {
        bestOverall: currentHeadline,
        bestForSEO: currentHeadline,
        bestForEngagement: currentHeadline,
        bestForDailyStarStyle: currentHeadline,
      },
      guidelines: result.guidelines || {
        idealLength: '60-70 characters',
        toneAdvice: 'Maintain factual, authoritative tone',
        keywordPlacement: 'Include primary keyword in first 5 words',
      },
    };

  } catch (error) {
    console.error('Error generating headline suggestions:', error);

    // Return fallback with current headline analysis
    return generateFallbackHeadlines(currentHeadline, primaryKeywords);
  }
};

/**
 * Analyzes current headline without generating new variants
 */
export const analyzeCurrentHeadline = (
  headline: string,
  primaryKeywords: Keyword[]
): { score: number; strengths: string[]; weaknesses: string[] } => {

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 50;

  // Length analysis
  const length = headline.length;
  if (length >= 50 && length <= 80) {
    strengths.push('Optimal length for SEO and display');
    score += 10;
  } else if (length < 50) {
    weaknesses.push('Too short - consider adding context');
    score -= 5;
  } else {
    weaknesses.push('Too long - may be truncated in search results');
    score -= 10;
  }

  // Keyword presence
  const headlineLower = headline.toLowerCase();
  const hasKeyword = primaryKeywords.some(k => headlineLower.includes(k.term.toLowerCase()));
  if (hasKeyword) {
    strengths.push('Includes primary keyword');
    score += 15;
  } else {
    weaknesses.push('Missing primary keyword');
    score -= 15;
  }

  // Active voice detection (simple heuristic)
  const passiveIndicators = ['was', 'were', 'been', 'being', 'by'];
  const hasPassive = passiveIndicators.some(word => headlineLower.split(' ').includes(word));
  if (!hasPassive) {
    strengths.push('Uses active voice');
    score += 5;
  } else {
    weaknesses.push('Consider using active voice');
    score -= 5;
  }

  // Numbers/specifics
  if (/\d+/.test(headline)) {
    strengths.push('Includes specific numbers/data');
    score += 5;
  }

  // Power words
  const hasPowerWord = Object.values(POWER_WORDS).flat().some(word =>
    headlineLower.includes(word.toLowerCase())
  );
  if (hasPowerWord) {
    strengths.push('Uses impactful action words');
    score += 5;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    strengths,
    weaknesses,
  };
};

/**
 * Fallback headline suggestions if AI fails
 */
const generateFallbackHeadlines = (
  currentHeadline: string,
  primaryKeywords: Keyword[]
): HeadlineSuggestion => {

  const analysis = analyzeCurrentHeadline(currentHeadline, primaryKeywords);
  const primaryKeyword = primaryKeywords[0]?.term || '';

  // Generate basic variants
  const variants = [
    {
      headline: currentHeadline,
      style: 'statement' as const,
      length: currentHeadline.length,
      powerWords: [],
      emotionalScore: 60,
      clickabilityScore: 65,
      seoScore: 70,
      dailyStarCompliance: 75,
      explanation: 'Original headline',
    },
  ];

  return {
    variants,
    currentHeadline: {
      text: currentHeadline,
      analysis,
    },
    recommendations: {
      bestOverall: currentHeadline,
      bestForSEO: currentHeadline,
      bestForEngagement: currentHeadline,
      bestForDailyStarStyle: currentHeadline,
    },
    guidelines: {
      idealLength: '60-70 characters',
      toneAdvice: 'Maintain factual, authoritative tone',
      keywordPlacement: 'Include primary keyword in first 5 words',
    },
  };
};
