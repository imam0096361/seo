/**
 * Metadata Service - Complete SEO Metadata Generation
 * Generates Open Graph, Twitter Cards, Schema.org, and Technical SEO tags
 * 100% accurate for The Daily Star Bangladesh
 */

import { GoogleGenAI } from "@google/genai";
import type { MetadataResult, Keyword } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates complete metadata package using Gemini AI
 */
export const generateMetadata = async (
  articleContent: string,
  metaTitle: string,
  metaDescription: string,
  primaryKeywords: Keyword[],
  entities: Keyword[],
  contentType: string,
  detectedLanguage: 'english' | 'bangla' | 'mixed'
): Promise<MetadataResult> => {

  const locale = detectedLanguage === 'bangla' ? 'bn_BD' : 'en_BD';
  const firstHeadline = articleContent.split('\n')[0] || metaTitle;

  // Extract author names from entities (if any)
  const authors = entities
    ?.filter(e => e.rationale?.toLowerCase().includes('author') || e.rationale?.toLowerCase().includes('journalist'))
    .map(e => e.term)
    .slice(0, 3) || ['The Daily Star'];

  // Determine category from content type and keywords
  const category = determineCategory(contentType, primaryKeywords);

  // Generate tags from primary keywords
  const tags = primaryKeywords.slice(0, 10).map(k => k.term);

  const prompt = `You are an expert SEO metadata specialist for The Daily Star Bangladesh.

**Task:** Generate complete, SEO-optimized metadata for this article.

**Article Title:** ${firstHeadline}
**Meta Title:** ${metaTitle}
**Meta Description:** ${metaDescription}
**Content Type:** ${contentType}
**Language:** ${detectedLanguage}
**Category:** ${category}
**Primary Keywords:** ${primaryKeywords.map(k => k.term).join(', ')}

**Requirements:**

1. **Suggested Featured Image:**
   - Suggest a descriptive image filename based on article topic
   - Format: topic-keywords-date.jpg
   - Example: "bangladesh-bank-interest-rate-2024.jpg"

2. **Image Alt Text:**
   - Descriptive alt text for accessibility and SEO
   - Include primary keyword naturally
   - 125 characters max

3. **Canonical URL:**
   - Generate SEO-friendly URL slug (lowercase, hyphens)
   - Format: https://www.thedailystar.net/${category}/news/[slug]
   - Remove stop words, keep meaningful keywords

4. **Article Section:**
   - Choose from: Bangladesh, Business, Opinion, Sports, Entertainment, World, Tech, Lifestyle
   - Based on content type and keywords

5. **Timestamps:**
   - Current date/time in ISO format for publishedTime
   - Same for modifiedTime initially

Respond in JSON only:
{
  "suggestedImageFilename": "descriptive-image-name.jpg",
  "imageAlt": "Descriptive alt text with primary keyword",
  "canonicalUrl": "https://www.thedailystar.net/category/news/slug",
  "articleSection": "Bangladesh",
  "publishedTime": "2024-01-15T10:00:00+06:00",
  "modifiedTime": "2024-01-15T10:00:00+06:00"
}`;

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

    // Build complete metadata
    const imageUrl = `https://tds-images.thedailystar.net/sites/default/files/${aiResult.suggestedImageFilename || 'article-default.jpg'}`;
    const canonicalUrl = aiResult.canonicalUrl || `https://www.thedailystar.net/${category}/news/article`;

    // Open Graph metadata
    const openGraph = {
      ogTitle: metaTitle,
      ogDescription: metaDescription,
      ogType: 'article' as const,
      ogUrl: canonicalUrl,
      ogImage: imageUrl,
      ogImageAlt: aiResult.imageAlt || metaTitle,
      ogImageWidth: 1200,
      ogImageHeight: 630,
      ogLocale: locale,
      ogSiteName: 'The Daily Star' as const,
      article: {
        publishedTime: aiResult.publishedTime,
        modifiedTime: aiResult.modifiedTime,
        author: authors,
        section: aiResult.articleSection || category,
        tag: tags,
      },
    };

    // Twitter Card metadata
    const twitter = {
      card: 'summary_large_image' as const,
      site: '@dailystarnews',
      title: metaTitle.slice(0, 70), // Twitter limit
      description: metaDescription.slice(0, 200), // Twitter limit
      image: imageUrl,
      imageAlt: aiResult.imageAlt || metaTitle,
    };

    // Schema.org JSON-LD
    const schema = {
      newsArticle: {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: metaTitle,
        description: metaDescription,
        image: [imageUrl],
        datePublished: aiResult.publishedTime,
        dateModified: aiResult.modifiedTime,
        author: authors.map(name => ({
          '@type': 'Person',
          name: name,
        })),
        publisher: {
          '@type': 'Organization',
          name: 'The Daily Star',
          logo: {
            '@type': 'ImageObject',
            url: 'https://www.thedailystar.net/sites/all/themes/sloth/logo.png',
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl,
        },
      },
      breadcrumbList: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://www.thedailystar.net',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: aiResult.articleSection || category,
            item: `https://www.thedailystar.net/${(aiResult.articleSection || category).toLowerCase()}`,
          },
        ],
      },
      organization: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'The Daily Star',
        url: 'https://www.thedailystar.net',
        logo: 'https://www.thedailystar.net/sites/all/themes/sloth/logo.png',
        sameAs: [
          'https://www.facebook.com/dailystarnews',
          'https://twitter.com/dailystarnews',
          'https://www.instagram.com/dailystarnews',
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+88029144330',
          contactType: 'customer service',
          areaServed: 'BD',
          availableLanguage: ['en', 'bn'],
        },
      },
    };

    // Technical SEO
    const technical = {
      canonical: canonicalUrl,
      robots: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
      googlebot: 'index, follow',
      hreflang: [
        { lang: 'en-BD', url: canonicalUrl },
        ...(detectedLanguage === 'bangla' ? [{ lang: 'bn-BD', url: canonicalUrl }] : []),
      ],
    };

    // Performance hints
    const performance = {
      preconnect: [
        'https://tds-images.thedailystar.net',
        'https://www.googletagmanager.com',
      ],
      dnsPrefetch: [
        'https://fonts.googleapis.com',
        'https://www.google-analytics.com',
      ],
    };

    // Generate copy-ready HTML
    const htmlTags = generateHTMLTags(openGraph, twitter, schema, technical, performance);

    return {
      openGraph,
      twitter,
      schema,
      technical,
      performance,
      htmlTags,
    };

  } catch (error) {
    console.error('Error generating metadata:', error);

    // Return basic fallback metadata
    return generateFallbackMetadata(metaTitle, metaDescription, category, locale, authors, tags);
  }
};

/**
 * Determines article category from content type and keywords
 */
const determineCategory = (contentType: string, primaryKeywords: Keyword[]): string => {
  const keywordText = primaryKeywords.map(k => k.term.toLowerCase()).join(' ');

  if (contentType.includes('Business')) return 'business';
  if (keywordText.includes('sports') || keywordText.includes('cricket') || keywordText.includes('football')) return 'sports';
  if (keywordText.includes('entertainment') || keywordText.includes('movie') || keywordText.includes('music')) return 'entertainment';
  if (keywordText.includes('tech') || keywordText.includes('technology') || keywordText.includes('startup')) return 'tech';
  if (keywordText.includes('opinion') || keywordText.includes('editorial')) return 'opinion';
  if (keywordText.includes('world') || keywordText.includes('international')) return 'world';

  return 'news';
};

/**
 * Generates copy-ready HTML tags
 */
const generateHTMLTags = (
  og: any,
  twitter: any,
  schema: any,
  technical: any,
  performance: any
): string => {
  return `<!-- Primary Meta Tags -->
<title>${og.ogTitle}</title>
<meta name="title" content="${og.ogTitle}">
<meta name="description" content="${og.ogDescription}">
<link rel="canonical" href="${technical.canonical}">
<meta name="robots" content="${technical.robots}">
<meta name="googlebot" content="${technical.googlebot}">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="${og.ogType}">
<meta property="og:url" content="${og.ogUrl}">
<meta property="og:title" content="${og.ogTitle}">
<meta property="og:description" content="${og.ogDescription}">
<meta property="og:image" content="${og.ogImage}">
<meta property="og:image:alt" content="${og.ogImageAlt}">
<meta property="og:image:width" content="${og.ogImageWidth}">
<meta property="og:image:height" content="${og.ogImageHeight}">
<meta property="og:locale" content="${og.ogLocale}">
<meta property="og:site_name" content="${og.ogSiteName}">
<meta property="article:published_time" content="${og.article.publishedTime || ''}">
<meta property="article:modified_time" content="${og.article.modifiedTime || ''}">
<meta property="article:section" content="${og.article.section}">
${og.article.tag.map((tag: string) => `<meta property="article:tag" content="${tag}">`).join('\n')}

<!-- Twitter -->
<meta property="twitter:card" content="${twitter.card}">
<meta property="twitter:url" content="${og.ogUrl}">
<meta property="twitter:title" content="${twitter.title}">
<meta property="twitter:description" content="${twitter.description}">
<meta property="twitter:image" content="${twitter.image}">
<meta property="twitter:image:alt" content="${twitter.imageAlt}">
<meta property="twitter:site" content="${twitter.site}">

<!-- Hreflang -->
${technical.hreflang.map((h: any) => `<link rel="alternate" hreflang="${h.lang}" href="${h.url}">`).join('\n')}

<!-- Performance Hints -->
${performance.preconnect.map((url: string) => `<link rel="preconnect" href="${url}">`).join('\n')}
${performance.dnsPrefetch.map((url: string) => `<link rel="dns-prefetch" href="${url}">`).join('\n')}

<!-- Schema.org JSON-LD -->
<script type="application/ld+json">
${JSON.stringify(schema.newsArticle, null, 2)}
</script>
<script type="application/ld+json">
${JSON.stringify(schema.breadcrumbList, null, 2)}
</script>
<script type="application/ld+json">
${JSON.stringify(schema.organization, null, 2)}
</script>`;
};

/**
 * Fallback metadata if AI generation fails
 */
const generateFallbackMetadata = (
  metaTitle: string,
  metaDescription: string,
  category: string,
  locale: 'en_BD' | 'bn_BD',
  authors: string[],
  tags: string[]
): MetadataResult => {
  const canonicalUrl = `https://www.thedailystar.net/${category}/news/article`;
  const imageUrl = 'https://tds-images.thedailystar.net/sites/default/files/article-default.jpg';
  const now = new Date().toISOString();

  const openGraph = {
    ogTitle: metaTitle,
    ogDescription: metaDescription,
    ogType: 'article' as const,
    ogUrl: canonicalUrl,
    ogImage: imageUrl,
    ogImageAlt: metaTitle,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogLocale: locale,
    ogSiteName: 'The Daily Star' as const,
    article: {
      publishedTime: now,
      modifiedTime: now,
      author: authors,
      section: category,
      tag: tags,
    },
  };

  const twitter = {
    card: 'summary_large_image' as const,
    site: '@dailystarnews',
    title: metaTitle.slice(0, 70),
    description: metaDescription.slice(0, 200),
    image: imageUrl,
    imageAlt: metaTitle,
  };

  const schema = {
    newsArticle: {},
    breadcrumbList: {},
    organization: {},
  };

  const technical = {
    canonical: canonicalUrl,
    robots: 'index, follow',
    googlebot: 'index, follow',
    hreflang: [{ lang: 'en-BD', url: canonicalUrl }],
  };

  const performance = {
    preconnect: ['https://tds-images.thedailystar.net'],
    dnsPrefetch: ['https://www.google-analytics.com'],
  };

  return {
    openGraph,
    twitter,
    schema,
    technical,
    performance,
    htmlTags: generateHTMLTags(openGraph, twitter, schema, technical, performance),
  };
};
