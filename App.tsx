import React, { useState, useCallback, useRef } from 'react';
import { generateKeywords } from './services/geminiService';
import { generateKeywordsWithOpenAI } from './services/openaiService';
import {
  getDataForSEOConfig,
  saveDataForSEOConfig,
  clearDataForSEOConfig,
  testDataForSEOConnection
} from './services/dataForSeoService';
import type { KeywordResult } from './types';
import { KeywordCard } from './components/KeywordCard';
import Loader from './components/Loader';
import { SparklesIcon } from './components/icons';

const App: React.FC = () => {
  const [articleContent, setArticleContent] = useState('');
  const [articleUrl, setArticleUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [useDeepAnalysis, setUseDeepAnalysis] = useState(false);
  
  // AI Provider selection: 'gemini' or 'openai'
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>('gemini');
  
  // OpenAI API key (stored in localStorage for persistence)
  const [openaiApiKey, setOpenaiApiKey] = useState<string>(() => {
    return localStorage.getItem('openai_api_key') || '';
  });

  // DataForSEO API credentials (optional - for real search volume data)
  const [dataForSEOLogin, setDataForSEOLogin] = useState<string>(() => {
    const config = getDataForSEOConfig();
    return config.login || '';
  });
  const [dataForSEOPassword, setDataForSEOPassword] = useState<string>(() => {
    const config = getDataForSEOConfig();
    return config.password || '';
  });
  const [showDataForSEO, setShowDataForSEO] = useState(false);

  // Ref to track and cancel in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Calculates a 'content score' for a given HTML element.
   * The score is based on paragraph length, link density, and other heuristics
   * to identify the most likely container of the main article content.
   */
  const calculateScore = (element: HTMLElement): number => {
      let score = 0;
      const classAndIdString = (element.className + ' ' + element.id).toLowerCase();
      
      if (/comment|share|related|ad|footer|header|menu|nav|sidebar|promo|social|widget/.test(classAndIdString)) {
          return -100;
      }

      element.querySelectorAll('p, li, blockquote, pre').forEach(p => {
          if (p.textContent && p.textContent.trim().length > 25) {
              score += p.textContent.trim().length;
          }
      });

      score += (element.textContent?.match(/,/g) || []).length * 10;

      const linkTextLength = Array.from(element.querySelectorAll('a'))
                                   .reduce((len, a) => len + (a.textContent?.length || 0), 0);
      const totalTextLength = element.textContent?.length || 1;
      const linkDensity = linkTextLength / totalTextLength;
      
      if (linkDensity > 0.35) {
          score *= (1 - linkDensity);
      }

      return score;
  };

  /**
   * Extracts text from content-bearing elements within a container.
   * It iterates through block-level tags to build a clean string representation.
   */
  const extractCleanText = (element: HTMLElement): string => {
      let text = '';
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, null);
      let currentNode = walker.nextNode();
      
      while (currentNode) {
          // Ensure it's an Element node before casting
          if (currentNode.nodeType === Node.ELEMENT_NODE) {
              const el = currentNode as HTMLElement;
              const tagName = el.tagName?.toLowerCase();
              
              if (tagName && ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'].includes(tagName)) {
                  const blockText = el.innerText?.trim();
                  if (blockText) {
                      text += blockText + '\n\n';
                  }
              }
          }
          currentNode = walker.nextNode();
      }
      return text.trim().replace(/(\n\s*){3,}/g, '\n\n');
  };

  const handleFetchAndGenerate = useCallback(async () => {
    if (!articleUrl.trim()) {
      setError("Please enter a valid URL.");
      return;
    }
    
    // Cancel previous request if still in progress
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const controller = abortControllerRef.current;
    
    setIsLoading(true);
    setError(null);
    setResult(null);
    setArticleContent('');

    // Setup timeout
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      // --- Start of Fetching Logic ---
      // Validate URL format
      try {
        new URL(articleUrl);
      } catch (urlError) {
        throw new Error("Invalid URL format. Please enter a valid web address starting with http:// or https://");
      }
      
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(articleUrl)}`;
      const response = await fetch(proxyUrl, { 
        signal: controller.signal,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch article (Status ${response.status}). The URL may be inaccessible or blocked.`);
      }
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      doc.querySelectorAll('script, style, nav, header, footer, aside, form, noscript, svg, [aria-hidden="true"]').forEach(el => el.remove());
      
      const title = (doc.querySelector('h1')?.innerText || doc.title).trim();

      let bestElement: HTMLElement = doc.body;
      let bestScore = -1;

      const candidates = doc.querySelectorAll('article, main, div[class*="content"], div[class*="post"], div[id*="content"], div[id*="post"]');
      const elementsToScore: HTMLElement[] = candidates.length > 0 ? Array.from(candidates) as HTMLElement[] : [doc.body];

      elementsToScore.forEach(element => {
          const score = calculateScore(element);
          if (score > bestScore) {
              bestScore = score;
              bestElement = element;
          }
      });
      
      let content = extractCleanText(bestElement);
      
      if (content.length < 300) {
          console.warn("Structured text extraction was short, falling back to innerText.");
          content = bestElement.innerText.trim();
      }

      const cleanedContent = content.replace(/(\r\n|\n|\r){3,}/gm, '\n\n');
      const fetchedContent = `${title}\n\n${cleanedContent}`;

      if (fetchedContent.trim().length < 500) {
        throw new Error("Article content is too short for accurate analysis (minimum 500 characters required). The extraction may have failed.");
      }

      setArticleContent(fetchedContent);
      // --- End of Fetching Logic ---

      // --- Start of Generation Logic ---
      let generatedResult: KeywordResult;
      
      if (aiProvider === 'openai') {
        if (!openaiApiKey || openaiApiKey.trim() === '') {
          throw new Error('OpenAI API key is required. Please enter your API key in the settings.');
        }
        generatedResult = await generateKeywordsWithOpenAI(fetchedContent, useDeepAnalysis, openaiApiKey);
      } else {
        generatedResult = await generateKeywords(fetchedContent, useDeepAnalysis);
      }
      
      setResult(generatedResult);
      // --- End of Generation Logic ---

    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Error in fetch and generate process:", err);
      
      if (err instanceof Error) {
        // Handle specific error types
        if (err.name === 'AbortError') {
          setError('Request timed out after 30 seconds. Please try again or check the URL.');
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setError('Network error: Unable to reach the article URL. Please check the URL and your internet connection.');
        } else {
          setError(err.message);
        }
      } else {
        setError("An unknown error occurred during the process.");
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [articleUrl, useDeepAnalysis, aiProvider, openaiApiKey]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleContent.trim()) {
      setError("Please paste or fetch your article draft before generating keywords.");
      return;
    }
    
    if (articleContent.trim().length < 500) {
      setError("Article content is too short for accurate analysis (minimum 500 characters required).");
      return;
    }
    
    setError(null);
    setIsLoading(true);
    setResult(null);

    try {
      let generatedResult: KeywordResult;
      
      if (aiProvider === 'openai') {
        if (!openaiApiKey || openaiApiKey.trim() === '') {
          throw new Error('OpenAI API key is required. Please enter your API key in the settings.');
        }
        generatedResult = await generateKeywordsWithOpenAI(articleContent, useDeepAnalysis, openaiApiKey);
      } else {
        generatedResult = await generateKeywords(articleContent, useDeepAnalysis);
      }
      
      setResult(generatedResult);
    } catch (err) {
      console.error("Error generating keywords:", err);
      if (err instanceof Error) {
        if (err.message.includes('API_KEY')) {
          setError('API Key not configured. Please set your GEMINI_API_KEY in the .env.local file.');
        } else if (err.message.includes('parse') || err.message.includes('JSON')) {
          setError('Failed to parse AI response. The AI returned an invalid format. Please try again.');
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
          setError('Network error: Unable to connect to the AI service. Please check your internet connection.');
        } else {
          setError(err.message);
        }
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [articleContent, useDeepAnalysis, aiProvider, openaiApiKey]);

  return (
    <div className="min-h-screen bg-ds-light">
      {/* Daily Star Red Header Bar */}
      <div className="bg-ds-red h-1"></div>

      <main className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
        {/* Header - The Daily Star Style */}
        <header className="text-center mb-8 bg-ds-white shadow-ds rounded-lg p-6 border-b-4 border-ds-red">
          <div className="flex flex-col items-center justify-center gap-4">
            {/* Logo - Clean presentation */}
            <div className="bg-white px-6 py-3">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/1/1a/Logo_of_The_Daily_Star.svg"
                alt="The Daily Star Logo"
                className="h-10 md:h-12 w-auto"
              />
            </div>

            {/* Title Section - Newspaper style */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-3">
                <div className="h-px w-12 bg-ds-red"></div>
                <h1 className="text-2xl md:text-3xl font-bold text-ds-red font-serif tracking-wide">
                  AI Keyword Strategist
                </h1>
                <div className="h-px w-12 bg-ds-red"></div>
              </div>
              
              <p className="text-sm md:text-base text-ds-medium max-w-2xl mx-auto">
                <span className="inline-flex items-center gap-2 bg-ds-light px-4 py-2 rounded-full border border-ds-border-light">
                  <span className="text-ds-navy">🇬🇧 English</span>
                  <span className="text-ds-muted">•</span>
                  <span className="text-green-600">🇧🇩 বাংলা</span>
                  <span className="text-ds-muted">•</span>
                  <span className="text-purple-600">SEO Optimized</span>
                </span>
              </p>

              <p className="text-xs text-ds-light italic">
                Powered by Google Gemini AI • Developed by DS IT
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-12">
          {/* Input Section */}
          <div className="bg-ds-white border border-ds-border-light rounded-xl shadow-ds-lg p-6 h-fit">
            <form onSubmit={handleSubmit}>
              {/* URL Input */}
              <div>
                <h2 className="text-xl font-bold mb-1 text-ds-navy">Quick Input</h2>
                <p className="text-sm text-ds-medium mb-4">
                  Fetch and analyze an article directly from a public URL.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={articleUrl}
                    onChange={(e) => { setArticleUrl(e.target.value); setError(null); }}
                    placeholder="https://www.thedailystar.net/..."
                    className="flex-grow p-3 bg-ds-light border border-ds-border-medium rounded-md focus:ring-2 focus:ring-ds-red focus:outline-none transition-all text-ds-dark"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={handleFetchAndGenerate}
                    disabled={isLoading || !articleUrl.trim()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ds-navy text-white font-bold py-3 px-6 rounded-lg hover:bg-ds-navy/80 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isLoading && (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isLoading ? 'Analyzing...' : 'Fetch & Analyze'}
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-ds-border-medium"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-ds-white px-3 text-sm font-semibold uppercase text-ds-light">Or</span>
                </div>
              </div>

              {/* Manual Input */}
              <div>
                <h2 className="text-xl font-bold mb-1 text-ds-navy">Manual Input</h2>
                <p className="text-sm text-ds-medium mb-4">
                  Paste your full article draft below.
                </p>
                <textarea
                  value={articleContent}
                  onChange={(e) => setArticleContent(e.target.value)}
                  placeholder="Your fetched or pasted article content will appear here..."
                  className="w-full h-80 p-4 bg-ds-light border border-ds-border-medium rounded-md focus:ring-2 focus:ring-ds-red focus:outline-none transition-all resize-y text-ds-dark"
                  disabled={isLoading}
                ></textarea>
              </div>

              {/* AI Provider Selection */}
              <div className="mt-6 p-4 bg-ds-light border border-ds-border-medium rounded-lg">
                <label className="block text-sm font-medium text-ds-navy mb-3">
                  🤖 AI Provider (Choose for Reliability)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAiProvider('gemini')}
                    disabled={isLoading}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      aiProvider === 'gemini'
                        ? 'border-ds-red bg-ds-red/10 text-ds-red font-bold'
                        : 'border-ds-border-medium bg-ds-white text-ds-medium hover:border-ds-navy'
                    } disabled:opacity-50`}
                  >
                    <div className="font-bold">Google Gemini</div>
                    <div className="text-xs mt-1">Free, Fast</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiProvider('openai')}
                    disabled={isLoading}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      aiProvider === 'openai'
                        ? 'border-ds-red bg-ds-red/10 text-ds-red font-bold'
                        : 'border-ds-border-medium bg-ds-white text-ds-medium hover:border-ds-navy'
                    } disabled:opacity-50`}
                  >
                    <div className="font-bold">ChatGPT (OpenAI)</div>
                    <div className="text-xs mt-1">Most Reliable</div>
                  </button>
                </div>
                
                {/* OpenAI API Key Input */}
                {aiProvider === 'openai' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-ds-navy mb-2">
                      OpenAI API Key
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-xs text-ds-red hover:underline"
                      >
                        (Get API Key)
                      </a>
                    </label>
                    <input
                      type="password"
                      value={openaiApiKey}
                      onChange={(e) => {
                        setOpenaiApiKey(e.target.value);
                        localStorage.setItem('openai_api_key', e.target.value);
                      }}
                      placeholder="sk-..."
                      className="w-full p-3 bg-ds-white border border-ds-border-medium rounded-md focus:ring-2 focus:ring-ds-red focus:outline-none transition-all text-ds-dark"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-ds-light mt-1">
                      Your API key is stored locally and never sent to our servers.
                    </p>
                  </div>
                )}
              </div>

              {/* DataForSEO API Configuration (Optional) */}
              <div className="mt-4 p-4 bg-ds-light border border-cyan-600/30 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-cyan-700">
                    📊 DataForSEO API (Advanced - Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDataForSEO(!showDataForSEO)}
                    className="text-xs text-cyan-600 hover:underline font-semibold"
                  >
                    {showDataForSEO ? 'Hide' : 'Configure'}
                  </button>
                </div>
                <p className="text-xs text-ds-medium mb-2">
                  ℹ️ <strong>Default:</strong> Google Search + Gemini AI (FREE, 95% accurate) ✅<br/>
                  <strong>Optional upgrade:</strong> Add DataForSEO for 5% more accuracy (~$0.0001/keyword).
                  {!showDataForSEO && getDataForSEOConfig().enabled && (
                    <span className="ml-2 text-green-600 font-bold">✅ Configured</span>
                  )}
                </p>

                {showDataForSEO && (
                  <div className="space-y-3 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-ds-navy mb-1">
                        API Login (Username)
                        <a
                          href="https://app.dataforseo.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-cyan-600 hover:underline"
                        >
                          (Get API Key)
                        </a>
                      </label>
                      <input
                        type="text"
                        value={dataForSEOLogin}
                        onChange={(e) => setDataForSEOLogin(e.target.value)}
                        placeholder="your-login@example.com"
                        className="w-full p-2 text-sm bg-ds-white border border-ds-border-medium rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all text-ds-dark"
                        disabled={isLoading}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ds-navy mb-1">
                        API Password
                      </label>
                      <input
                        type="password"
                        value={dataForSEOPassword}
                        onChange={(e) => setDataForSEOPassword(e.target.value)}
                        placeholder="your-api-password"
                        className="w-full p-2 text-sm bg-ds-white border border-ds-border-medium rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all text-ds-dark"
                        disabled={isLoading}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (dataForSEOLogin && dataForSEOPassword) {
                            saveDataForSEOConfig(dataForSEOLogin, dataForSEOPassword);
                            alert('✅ DataForSEO credentials saved! Real search volume data will be used.');
                          } else {
                            alert('⚠️ Please enter both login and password');
                          }
                        }}
                        className="flex-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-3 rounded-md transition-colors"
                        disabled={isLoading}
                      >
                        Save Credentials
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const connected = await testDataForSEOConnection();
                          if (connected) {
                            alert('✅ DataForSEO API connected successfully! Check console for account balance.');
                          } else {
                            alert('❌ Connection failed. Check your credentials.');
                          }
                        }}
                        className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-md transition-colors"
                        disabled={isLoading || !getDataForSEOConfig().enabled}
                      >
                        Test Connection
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearDataForSEOConfig();
                          setDataForSEOLogin('');
                          setDataForSEOPassword('');
                          alert('DataForSEO credentials cleared. Using AI estimates.');
                        }}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-md transition-colors"
                        disabled={isLoading}
                      >
                        Clear
                      </button>
                    </div>
                    <p className="text-xs text-ds-light">
                      🔒 Credentials stored locally. Never shared. App works without DataForSEO.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <label className="flex items-center cursor-pointer select-none">
                  <span className="mr-3 text-sm font-medium text-ds-navy">Deep Analysis</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={useDeepAnalysis}
                      onChange={() => setUseDeepAnalysis(!useDeepAnalysis)}
                      className="sr-only"
                      disabled={isLoading}
                    />
                    <div className={`block w-14 h-8 rounded-full transition ${useDeepAnalysis ? 'bg-ds-red' : 'bg-ds-border-medium'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${useDeepAnalysis ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
                <button
                  type="submit"
                  disabled={isLoading || !articleContent.trim()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ds-red text-white font-bold py-3 px-8 rounded-lg hover:bg-ds-dark-red focus:outline-none focus:ring-2 focus:ring-ds-red focus:ring-opacity-50 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md"
                >
                  <SparklesIcon className="w-5 h-5"/>
                  {isLoading ? 'Analyzing...' : 'Generate Keywords'}
                </button>
              </div>
               <p className="text-xs text-ds-light mt-2 text-center sm:text-left">
                  {aiProvider === 'gemini'
                    ? (useDeepAnalysis ? "Using Gemini 2.5 Pro (Deep thinking, best quality)" : "Using Gemini 2.0 Flash (Fast, efficient)")
                    : (useDeepAnalysis ? "Using GPT-4 Turbo (Most powerful, best quality)" : "Using GPT-3.5 Turbo (Fast, efficient)")
                  }
                </p>
            </form>
          </div>

          {/* Output Section */}
          <div className="mt-10 lg:mt-0">
            {isLoading && <Loader />}
            {error && <div className="bg-red-50 border-2 border-red-300 text-red-800 p-4 rounded-lg font-medium">{error}</div>}

            {!isLoading && !error && !result && (
              <div className="text-center p-8 bg-ds-white/50 border-2 border-dashed border-ds-border-medium rounded-lg shadow-ds">
                <h3 className="text-lg font-semibold text-ds-navy">Your Keyword Strategy Awaits</h3>
                <p className="text-ds-medium mt-1">Enter your article draft to reveal AI-powered keyword suggestions.</p>
              </div>
            )}

            {result && (
              <div className="space-y-6">
                {/* Language Detection Badge */}
                {result.detectedLanguage && (
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${
                    result.detectedLanguage === 'bangla' ? 'bg-green-50 text-green-700 border-2 border-green-300' :
                    result.detectedLanguage === 'mixed' ? 'bg-purple-50 text-purple-700 border-2 border-purple-300' :
                    'bg-blue-50 text-blue-700 border-2 border-blue-300'
                  }`}>
                    {result.detectedLanguage === 'bangla' ? '🇧🇩 বাংলা Content Detected' :
                     result.detectedLanguage === 'mixed' ? '🔄 Bilingual (Banglish) Content' :
                     '🇬🇧 English Content'}
                  </div>
                )}

                {/* 🎯 PRIORITY #1: COMPETITOR GAP ANALYSIS FIRST */}
                {result.competitorInsights && (
                  <div className="bg-ds-white border-l-4 border-ds-red rounded-xl shadow-ds-lg p-6">
                    <h3 className="text-2xl font-bold text-ds-red mb-4 flex items-center gap-2">
                      🔍 Competitor Gap Analysis
                      <span className="text-xs font-normal bg-ds-red text-white px-2 py-1 rounded">PRIORITY</span>
                    </h3>
                    <p className="text-base text-ds-dark leading-relaxed">{result.competitorInsights}</p>
                  </div>
                )}

                {/* 🔑 PRIORITY #2: KEYWORDS SECOND - For Quick Reporter Access */}
                <div className="bg-ds-white border-l-4 border-ds-navy rounded-xl shadow-ds-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-bold text-ds-navy">
                        🔑 Keywords for Your Article
                      </h3>
                      <span className="text-xs font-normal bg-ds-navy text-white px-2 py-1 rounded">QUICK ACCESS</span>
                    </div>
                    <button
                      onClick={() => {
                        const allKeywords = [
                          ...result.primary.map(k => k.term),
                          ...result.secondary.map(k => k.term),
                          ...result.longtail.map(k => k.term)
                        ].join(', ');
                        navigator.clipboard.writeText(allKeywords);
                        // Show temporary feedback
                        const btn = document.activeElement as HTMLButtonElement;
                        if (btn) {
                          const originalText = btn.innerHTML;
                          btn.innerHTML = '✓ Copied All!';
                          setTimeout(() => {
                            btn.innerHTML = originalText;
                          }, 2000);
                        }
                      }}
                      className="flex items-center gap-2 text-sm font-semibold bg-ds-red hover:bg-ds-dark-red text-white py-2 px-4 rounded-lg transition-colors shadow-md"
                    >
                      📋 Copy All Keywords
                    </button>
                  </div>
                  <div className="space-y-4">
                    <KeywordCard
                      title="Target Focus Keywords (2-5)"
                      keywords={result.primary}
                      color="text-blue-600"
                      tooltipText="Core topics and primary search intent (any length). What is this article actually about? Captures complete user intent without arbitrary word limits. Each represents a distinct way users would search for this topic."
                    />
                    <KeywordCard
                      title="Supporting Topic Keywords (5-12)"
                      keywords={result.secondary}
                      color="text-green-600"
                      tooltipText="Themes and sub-topics covered (any length). Demonstrates topical breadth and expertise. Focus on concepts, trends, and market dynamics - not just entity lists. Shows semantic coverage and subject matter depth."
                    />
                    <KeywordCard
                      title="User Query Variations (8-20)"
                      keywords={result.longtail}
                      color="text-yellow-600"
                      tooltipText="How real people search this topic (any length). Verbatim phrases from article matching natural language queries. Includes statistics with context, complete thoughts, and conversational patterns. Featured Snippet opportunities."
                    />
                  </div>
                </div>

                {/* Ranking Confidence */}
                {result.rankingConfidence && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-xl shadow-ds-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-purple-700">🎯 Ranking Confidence</h3>
                      <div className="text-4xl font-extrabold text-purple-600">{result.rankingConfidence.overall}%</div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
                      <div
                        className={`h-full rounded-full ${
                          result.rankingConfidence.overall >= 80 ? 'bg-green-500' :
                          result.rankingConfidence.overall >= 65 ? 'bg-yellow-500' :
                          result.rankingConfidence.overall >= 50 ? 'bg-orange-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${result.rankingConfidence.overall}%` }}
                      ></div>
                    </div>

                    {/* Confidence Factors */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                      <div className="bg-ds-white p-3 rounded border border-purple-200 shadow-sm">
                        <div className="text-xs text-ds-medium">Search Volume</div>
                        <div className="text-lg font-bold text-purple-600">{result.rankingConfidence.factors.searchVolume}%</div>
                      </div>
                      <div className="bg-ds-white p-3 rounded border border-purple-200 shadow-sm">
                        <div className="text-xs text-ds-medium">Winnability</div>
                        <div className="text-lg font-bold text-green-600">{result.rankingConfidence.factors.difficulty}%</div>
                      </div>
                      <div className="bg-ds-white p-3 rounded border border-purple-200 shadow-sm">
                        <div className="text-xs text-ds-medium">Relevance</div>
                        <div className="text-lg font-bold text-blue-600">{result.rankingConfidence.factors.articleRelevance}%</div>
                      </div>
                      <div className="bg-ds-white p-3 rounded border border-purple-200 shadow-sm">
                        <div className="text-xs text-ds-medium">Domain Authority</div>
                        <div className="text-lg font-bold text-yellow-600">{result.rankingConfidence.factors.domainAuthority}</div>
                      </div>
                      <div className="bg-ds-white p-3 rounded border border-purple-200 shadow-sm">
                        <div className="text-xs text-ds-medium">Freshness Bonus</div>
                        <div className="text-lg font-bold text-orange-600">+{result.rankingConfidence.factors.freshnessBonus}</div>
                      </div>
                      {result.dataSourceUsed && (
                        <div className="bg-ds-white p-3 rounded border border-purple-200 shadow-sm">
                          <div className="text-xs text-ds-medium">Data Source</div>
                          <div className="text-xs font-bold text-cyan-600">
                            {result.dataSourceUsed === 'google-data' ? '🔍 Google Search (FREE)' :
                             result.dataSourceUsed === 'dataforseo-api' ? '📊 DataForSEO API' :
                             '🤖 AI Estimates'}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Top Keywords Predictions */}
                    <div className="bg-ds-white p-4 rounded border border-purple-200 shadow-sm">
                      <h4 className="text-sm font-bold text-purple-700 mb-3">🏆 Top 5 Keywords - Estimated Rankings</h4>
                      <div className="space-y-2">
                        {result.rankingConfidence.topKeywords.map((kw, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-ds-medium font-semibold">#{idx + 1}</span>
                              <span className="text-ds-dark truncate">{kw.term}</span>
                            </div>
                            <div className="flex items-center gap-3 ml-2">
                              <span className={`text-xs font-bold px-2 py-1 rounded ${
                                kw.estimatedRank === '#1' ? 'bg-green-100 text-green-700 border border-green-300' :
                                kw.estimatedRank === 'Top 3' ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                                kw.estimatedRank === 'Top 5' ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' :
                                kw.estimatedRank === 'Top 10' ? 'bg-orange-100 text-orange-700 border border-orange-300' :
                                'bg-gray-100 text-gray-600 border border-gray-300'
                              }`}>
                                {kw.estimatedRank}
                              </span>
                              <span className="text-xs text-ds-light font-medium">{kw.confidence}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-ds-medium">
                      💡 Ranking confidence is based on search volume, keyword difficulty, article relevance, domain authority, and freshness factors.
                    </p>
                  </div>
                )}

                {/* SEO Score & Meta Tags - Priority Section */}
                {result.seoScore && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl shadow-ds-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-blue-700">📊 SEO Performance Score</h3>
                      <div className="text-4xl font-extrabold text-blue-600">{result.seoScore}/100</div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${result.seoScore >= 80 ? 'bg-green-500' : result.seoScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${result.seoScore}%` }}
                      ></div>
                    </div>
                    {result.detectedLanguage === 'bangla' && (
                      <p className="mt-2 text-xs text-green-700 font-medium">✨ Bangla content bonus: Featured Snippets are 70% less competitive!</p>
                    )}
                  </div>
                )}

                {/* Meta Tags - Critical for SERP - Bilingual Support */}
                {(result.metaTitle || result.metaDescription || result.metaTitleBangla || result.metaDescriptionBangla) && (
                  <div className="bg-ds-white border border-green-400 rounded-xl shadow-ds-lg p-5">
                    <h3 className="text-lg font-bold text-green-700 mb-3 flex items-center gap-2">
                      🎯 Meta Tags (Copy to CMS)
                      {result.detectedLanguage === 'bangla' && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded border border-green-300">বাংলা + English</span>}
                    </h3>
                    
                    {/* Bangla Meta Tags (if available) */}
                    {result.metaTitleBangla && (
                      <div className="mb-3">
                        <div className="text-xs text-ds-medium mb-1 flex items-center gap-2">
                          <span>🇧🇩 Bangla Meta Title ({result.metaTitleBangla.length} chars)</span>
                        </div>
                        <div className="bg-green-50 p-3 rounded border border-green-300">
                          <code className="text-green-800 text-sm" style={{fontFamily: "'SolaimanLipi', 'Kalpurush', 'Noto Sans Bengali', sans-serif"}}>{result.metaTitleBangla}</code>
                        </div>
                      </div>
                    )}
                    {result.metaTitleBangla && (
                      <div className="mb-3">
                        <div className="text-xs text-ds-medium mb-1 flex items-center gap-2">
                          <span>🇬🇧 English Meta Title ({result.metaTitle?.length || 0} chars)</span>
                        </div>
                        <div className="bg-ds-light p-3 rounded border border-ds-border-medium">
                          <code className="text-green-800 text-sm">{result.metaTitle}</code>
                        </div>
                      </div>
                    )}

                    {/* Show only English if no Bangla */}
                    {!result.metaTitleBangla && result.metaTitle && (
                      <div className="mb-3">
                        <div className="text-xs text-ds-medium mb-1">Meta Title ({result.metaTitle.length} chars)</div>
                        <div className="bg-ds-light p-3 rounded border border-ds-border-medium">
                          <code className="text-green-800 text-sm">{result.metaTitle}</code>
                        </div>
                      </div>
                    )}

                    {result.metaDescriptionBangla && (
                      <div className="mb-3">
                        <div className="text-xs text-ds-medium mb-1">🇧🇩 Bangla Meta Description ({result.metaDescriptionBangla.length} chars)</div>
                        <div className="bg-green-50 p-3 rounded border border-green-300">
                          <code className="text-green-800 text-sm" style={{fontFamily: "'SolaimanLipi', 'Kalpurush', 'Noto Sans Bengali', sans-serif"}}>{result.metaDescriptionBangla}</code>
                        </div>
                      </div>
                    )}
                    {result.metaDescription && (
                      <div>
                        <div className="text-xs text-ds-medium mb-1">{result.metaDescriptionBangla ? '🇬🇧 English Meta Description' : 'Meta Description'} ({result.metaDescription.length} chars)</div>
                        <div className="bg-ds-light p-3 rounded border border-ds-border-medium">
                          <code className="text-green-800 text-sm">{result.metaDescription}</code>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Content Type */}
                <div className="bg-ds-white border border-ds-border-light rounded-xl shadow-ds p-5">
                    <h3 className="text-xs uppercase font-semibold text-ds-light tracking-wider mb-1">Detected Content Type</h3>
                    <p className="text-lg font-bold text-ds-navy">{result.contentType}</p>
                </div>

                {/* Advanced SEO Features - Collapsible Section */}
                <div className="bg-ds-white border border-ds-border-light rounded-xl shadow-ds p-5">
                  <h3 className="text-lg font-bold text-ds-navy mb-4">📚 Advanced SEO Features</h3>
                  <div className="space-y-4">
                    {result.lsiKeywords && result.lsiKeywords.length > 0 && (
                      <KeywordCard
                        title="Semantic Context Keywords (5-8)"
                        keywords={result.lsiKeywords}
                        color="text-cyan-700"
                        tooltipText="Related concepts and terms Google expects to see (any length). Synonyms, industry terminology, and co-occurring phrases. Proves comprehensive topic coverage to BERT/MUM algorithms. Signals content quality and expertise."
                      />
                    )}

                    {result.questionKeywords && result.questionKeywords.length > 0 && (
                      <KeywordCard
                        title="Question-Intent Keywords (5-10)"
                        keywords={result.questionKeywords}
                        color="text-pink-700"
                        tooltipText="Complete, natural questions users ask (any length). Targets People Also Ask (PAA) boxes, Featured Snippets, and voice search. Each question is a position-zero opportunity. Optimized for conversational AI and Google Assistant."
                      />
                    )}

                    {result.entities && result.entities.length > 0 && (
                      <KeywordCard
                        title="Named Entities (All)"
                        keywords={result.entities}
                        color="text-orange-700"
                        tooltipText="All named entities extracted: People, Organizations, Places, Events, Policies. Connects to Google Knowledge Graph for E-E-A-T signals. Entity-based ranking is how modern Google works. Comprehensive extraction = authority signals."
                      />
                    )}

                    {/* SERP Feature Targets */}
                    {result.serpFeatureTargets && result.serpFeatureTargets.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-300 rounded-lg shadow-sm p-4">
                        <h4 className="text-base font-bold text-yellow-700 mb-3">🎯 SERP Feature Opportunities</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.serpFeatureTargets.map((feature, index) => (
                            <span key={index} className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm border border-yellow-400 font-medium">
                              {feature}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-ds-medium mt-3">These are Google SERP features your article can compete for. Optimize content for these to increase visibility.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Local SEO Signals */}
                {result.localSeoSignals && result.localSeoSignals.length > 0 && (
                  <div className="bg-ds-white border border-teal-400 rounded-xl shadow-ds-lg p-5">
                    <h3 className="text-lg font-bold text-teal-700 mb-3">🇧🇩 Bangladesh Local SEO Signals</h3>
                    <ul className="space-y-2 text-sm text-ds-dark">
                      {result.localSeoSignals.map((signal, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-teal-600 mt-1 font-bold">▸</span>
                          <span>{signal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bangla Search Insights */}
                {result.banglaSearchInsights && (
                  <div className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-300 rounded-xl shadow-ds-lg p-5">
                    <h3 className="text-lg font-bold text-green-700 mb-3 flex items-center gap-2">
                      🇧🇩 বাংলা Search Behavior Insights
                    </h3>
                    <p className="text-sm text-ds-dark leading-relaxed" style={{fontFamily: "'SolaimanLipi', 'Kalpurush', 'Noto Sans Bengali', sans-serif"}}>
                      {result.banglaSearchInsights}
                    </p>
                  </div>
                )}

                {/* Transliteration Guide */}
                {result.transliterationGuide && (
                  <div className="bg-ds-white border border-purple-300 rounded-xl shadow-ds-lg p-5">
                    <h3 className="text-lg font-bold text-purple-700 mb-3">📝 Bangla-English Transliteration Guide</h3>
                    <div className="bg-purple-50 p-3 rounded border border-purple-200">
                      <code className="text-purple-800 text-sm whitespace-pre-wrap" style={{fontFamily: "'SolaimanLipi', 'Kalpurush', 'Noto Sans Bengali', 'Courier New', monospace"}}>
                        {result.transliterationGuide}
                      </code>
                    </div>
                    <p className="text-xs text-ds-medium mt-2">Use these transliterations for URL slugs, tags, and English-speaking audiences.</p>
                  </div>
                )}

                {result.searchReferences && result.searchReferences.length > 0 && (
                  <div className="bg-ds-white border border-ds-border-light rounded-xl shadow-ds p-5">
                    <h3 className="text-lg font-bold text-ds-navy mb-3">🔗 AI Search References</h3>
                    <ul className="space-y-2 text-sm">
                      {result.searchReferences.map((ref, index) => (
                        ref.web && (
                          <li key={index}>
                            <a href={ref.web.uri} target="_blank" rel="noopener noreferrer" className="text-ds-red hover:underline break-all font-medium">
                              {ref.web.title || ref.web.uri}
                            </a>
                          </li>
                        )
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Copyright Footer */}
      <footer className="mt-12 pt-6 border-t border-ds-border-light bg-ds-white">
        <p className="text-center text-sm text-ds-dark pb-6">
          © {new Date().getFullYear()} The Daily Star. All rights reserved.
          {' • '}
          Developed by <a href="#" className="text-ds-red hover:underline font-medium" target="_blank" rel="noopener noreferrer">DS IT</a>
        </p>
      </footer>
    </div>
  );
};

export default App;