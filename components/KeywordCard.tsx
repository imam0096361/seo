import React, { useState, useCallback } from 'react';
import type { Keyword } from '../types';
import { CopyIcon, CheckIcon, InfoIcon } from './icons';

interface KeywordCardProps {
  title: string;
  keywords: Keyword[];
  color: string;
  tooltipText?: string;
}

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="group relative flex items-center">
      <InfoIcon className="w-4 h-4 text-ds-medium group-hover:text-ds-navy transition-colors" />
      <div className="absolute bottom-full mb-2 w-72 left-1/2 -translate-x-1/2 bg-ds-navy p-3 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-10 border border-ds-border-light">
        <p className="font-sans">{text}</p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-ds-navy"></div>
      </div>
    </div>
  );
};

const KeywordPill: React.FC<{ keyword: Keyword }> = ({ keyword }) => {
  const [copied, setCopied] = useState(false);
  const MAX_LENGTH = 50;
  const isBilingual = keyword.termBangla && keyword.termEnglish;
  const displayTerm = keyword.term;
  const isTruncated = displayTerm.length > MAX_LENGTH;
  const displayText = isTruncated ? `${displayTerm.substring(0, MAX_LENGTH)}...` : displayTerm;

  const handleCopy = useCallback(() => {
    // Copy both Bangla and English if available
    const textToCopy = isBilingual 
      ? `${keyword.termBangla}\n${keyword.termEnglish}` 
      : keyword.term;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [keyword.term, keyword.termBangla, keyword.termEnglish, isBilingual]);

  return (
    <div className={`group relative flex items-center bg-ds-light border ${isBilingual ? 'border-green-400' : 'border-ds-border-medium'} rounded-full py-1.5 px-4 text-sm hover:border-ds-red hover:shadow-sm transition-all duration-200 text-ds-dark`}>
      <span style={isBilingual ? {fontFamily: "'SolaimanLipi', 'Kalpurush', 'Noto Sans Bengali', sans-serif"} : {}}>{displayText}</span>
      {isBilingual && <span className="ml-1 text-xs text-green-600">🇧🇩</span>}
      <button onClick={handleCopy} className="ml-2 opacity-50 group-hover:opacity-100 transition-opacity">
        {copied ? <CheckIcon className="w-4 h-4 text-green-600" /> : <CopyIcon className="w-4 h-4 text-ds-medium" />}
      </button>
      <div className="absolute bottom-full mb-2 w-80 left-1/2 -translate-x-1/2 bg-ds-navy p-3 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-10 border border-ds-border-light">
        {isBilingual && (
          <div className="mb-2 border-b border-green-300 pb-2">
            <p className="font-bold text-green-300 mb-1">🇧🇩 বাংলা (Bangla):</p>
            <p className="font-mono break-all text-white" style={{fontFamily: "'SolaimanLipi', 'Kalpurush', 'Noto Sans Bengali', 'Courier New'"}}>{keyword.termBangla}</p>
            <p className="font-bold text-blue-300 mt-2 mb-1">🇬🇧 English/Transliteration:</p>
            <p className="font-mono break-all text-white">{keyword.termEnglish}</p>
          </div>
        )}
        {!isBilingual && isTruncated && (
            <div className="mb-2 border-b border-gray-400 pb-2">
                <p className="font-bold text-white">Full Keyword:</p>
                <p className="font-mono break-all text-gray-100">{keyword.term}</p>
            </div>
        )}
        <strong className="font-bold text-white block mb-1">Rationale:</strong>
        <p className="text-gray-100" style={isBilingual ? {fontFamily: "'SolaimanLipi', 'Kalpurush', 'Noto Sans Bengali', sans-serif"} : {}}>{keyword.rationale}</p>
        <div className="mt-2 space-y-1 text-gray-200">
          {keyword.searchIntent && (
            <p className="text-xs"><strong>Search Intent:</strong> {keyword.searchIntent}</p>
          )}
          {keyword.searchVolumeNumeric && (
            <p className="text-xs"><strong>Search Volume:</strong> {keyword.searchVolumeNumeric.toLocaleString()}/month (Real Data 📊)</p>
          )}
          {!keyword.searchVolumeNumeric && keyword.searchVolume && (
            <p className="text-xs"><strong>Search Volume:</strong> {keyword.searchVolume} (Estimated)</p>
          )}
          {keyword.difficultyScore !== undefined && (
            <p className="text-xs">
              <strong>Difficulty:</strong> {keyword.difficultyScore}/100
              {keyword.winnability && (
                <span className={`ml-2 font-semibold ${
                  keyword.winnability === 'Easy' ? 'text-green-300' :
                  keyword.winnability === 'Medium' ? 'text-yellow-300' :
                  keyword.winnability === 'Hard' ? 'text-orange-300' :
                  'text-red-300'
                }`}>
                  {keyword.winnability === 'Easy' ? '✅ Easy to Rank' :
                   keyword.winnability === 'Medium' ? '⚠️ Medium' :
                   keyword.winnability === 'Hard' ? '🔥 Competitive' :
                   '⛔ Very Hard'}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-ds-navy"></div>
      </div>
    </div>
  );
};

export const KeywordCard: React.FC<KeywordCardProps> = ({ title, keywords, color, tooltipText }) => {
  const [allCopied, setAllCopied] = useState(false);
  
  const handleCopyAll = useCallback(() => {
    const allTerms = keywords.map(k => k.term).join(', ');
    navigator.clipboard.writeText(allTerms);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  }, [keywords]);

  if (!keywords || keywords.length === 0) {
    return null;
  }

  return (
    <div className="bg-ds-white border border-ds-border-medium rounded-xl shadow-ds">
      <div className={`p-4 border-b border-ds-border-light flex justify-between items-center bg-ds-light`}>
        <div className="flex items-center gap-2">
          <h3 className={`text-lg font-bold ${color}`}>{title}</h3>
          {tooltipText && <InfoTooltip text={tooltipText} />}
        </div>
        <button
            onClick={handleCopyAll}
            className="flex items-center gap-2 text-xs font-semibold bg-ds-navy hover:bg-ds-dark-red text-white py-1 px-3 rounded-md transition-colors shadow-sm"
        >
          {allCopied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
          {allCopied ? 'Copied' : 'Copy All'}
        </button>
      </div>
      <div className="p-4 bg-ds-white">
        <div className="flex flex-wrap gap-3">
          {keywords.map((keyword, index) => (
            <KeywordPill key={index} keyword={keyword} />
          ))}
        </div>
      </div>
    </div>
  );
};