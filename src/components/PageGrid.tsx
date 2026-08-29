import React, { useState } from 'react';
import { Download, Maximize2, Check, Image as ImageIcon, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { MangaPage } from '../types';
import { Language, translations } from '../utils/translations';

interface PageGridProps {
  lang: Language;
  pages: MangaPage[];
  selectedPageIds: Set<string>;
  onTogglePageSelect: (pageId: string) => void;
  onOpenLightbox: (pageIndex: number) => void;
  onDownloadSinglePage: (page: MangaPage) => void;
}

interface SinglePageCardProps {
  page: MangaPage;
  index: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpenLightbox: () => void;
  onDownloadSingle: () => void;
  lang: Language;
}

const SinglePageCard: React.FC<SinglePageCardProps> = ({
  page,
  index,
  isSelected,
  onToggleSelect,
  onOpenLightbox,
  onDownloadSingle,
  lang,
}) => {
  const t = translations[lang];
  const [errorCount, setErrorCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [useRawDirect, setUseRawDirect] = useState(false);

  // Fallback URL strategy: proxy -> direct raw URL -> proxy with timestamp
  const getImageSource = () => {
    if (useRawDirect && page.rawUrl) {
      return page.rawUrl;
    }
    const baseProxy = page.proxyUrl || `/api/proxy/image?url=${encodeURIComponent(page.rawUrl || '')}`;
    if (errorCount > 0) {
      return `${baseProxy}&t=${Date.now()}`;
    }
    return baseProxy;
  };

  const handleImageError = () => {
    if (!useRawDirect && page.rawUrl) {
      // First try switching to direct raw URL
      setUseRawDirect(true);
    } else {
      setErrorCount((prev) => prev + 1);
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setErrorCount(0);
    setUseRawDirect(false);
    setIsLoaded(false);
  };

  return (
    <div
      className={`group relative rounded-xl overflow-hidden border bg-slate-900/90 transition-all flex flex-col ${
        isSelected
          ? 'border-indigo-500/80 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Image Container */}
      <div
        className="relative aspect-[3/4] bg-slate-950 overflow-hidden cursor-pointer flex items-center justify-center"
        onClick={onOpenLightbox}
      >
        {/* Loading Skeleton */}
        {!isLoaded && errorCount < 2 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-slate-500 space-y-2 z-0">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            <span className="text-[10px] font-mono text-slate-400">Loading {page.formattedIndex}...</span>
          </div>
        )}

        {errorCount >= 2 ? (
          <div className="p-3 flex flex-col items-center justify-center text-center space-y-2 z-10">
            <AlertCircle className="w-6 h-6 text-amber-400" />
            <span className="text-[11px] text-slate-400">Failed to load</span>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-indigo-300 transition-colors border border-slate-700"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        ) : (
          <img
            key={`${page.id}-${useRawDirect}-${errorCount}`}
            src={getImageSource()}
            alt={`Page ${page.pageNumber}`}
            onLoad={() => setIsLoaded(true)}
            onError={handleImageError}
            className={`w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            referrerPolicy="no-referrer"
          />
        )}

        {/* Hover overlay with Action Buttons */}
        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px] z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLightbox();
            }}
            className="p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 transition-colors shadow-lg cursor-pointer"
            title={t.viewFull}
          >
            <Maximize2 className="w-4 h-4 text-indigo-300" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDownloadSingle();
            }}
            className="p-2 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white transition-colors shadow-lg cursor-pointer"
            title={t.downloadThisPage}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {/* Top Badge: Page index number */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/85 backdrop-blur-md border border-slate-700/80 text-[11px] font-mono font-bold text-white shadow-md z-10">
          #{page.formattedIndex}
        </div>

        {/* Top Right: Selection Checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className={`absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer shadow-md z-10 ${
            isSelected
              ? 'bg-indigo-600 text-white border border-indigo-400'
              : 'bg-slate-950/80 border border-slate-600 text-transparent hover:border-indigo-400'
          }`}
          title={isSelected ? 'Deselect page' : 'Select page'}
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </button>
      </div>

      {/* Bottom bar */}
      <div className="p-2 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">
          {t.page} {page.pageNumber}
        </span>
        <button
          type="button"
          onClick={onDownloadSingle}
          className="text-slate-400 hover:text-indigo-400 transition-colors p-1 cursor-pointer"
          title={t.downloadThisPage}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const PageGrid: React.FC<PageGridProps> = ({
  lang,
  pages,
  selectedPageIds,
  onTogglePageSelect,
  onOpenLightbox,
  onDownloadSinglePage,
}) => {
  const t = translations[lang];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-indigo-400" />
          <span>{t.sequentialOrder}</span>
        </h3>
        <span className="text-xs text-slate-400">
          {pages.length} {t.page}s
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {pages.map((page, index) => (
          <SinglePageCard
            key={page.id}
            page={page}
            index={index}
            isSelected={selectedPageIds.has(page.id)}
            onToggleSelect={() => onTogglePageSelect(page.id)}
            onOpenLightbox={() => onOpenLightbox(index)}
            onDownloadSingle={() => onDownloadSinglePage(page)}
            lang={lang}
          />
        ))}
      </div>
    </div>
  );
};
