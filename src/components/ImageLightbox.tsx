import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { MangaPage } from '../types';
import { Language, translations } from '../utils/translations';

interface ImageLightboxProps {
  lang: Language;
  pages: MangaPage[];
  initialIndex: number;
  onClose: () => void;
  onDownloadPage: (page: MangaPage) => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  lang,
  pages,
  initialIndex,
  onClose,
  onDownloadPage,
}) => {
  const t = translations[lang];
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [useDirect, setUseDirect] = useState(false);

  const currentPage = pages[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < pages.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setZoom(1);
      setRotation(0);
      setIsLoading(true);
      setUseDirect(false);
    }
  }, [currentIndex, pages.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setZoom(1);
      setRotation(0);
      setIsLoading(true);
      setUseDirect(false);
    }
  }, [currentIndex]);

  const handleZoomIn = () => setZoom((z) => Math.min(3, z + 0.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.25));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === '+') handleZoomIn();
      else if (e.key === '-') handleZoomOut();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleNext, handlePrev]);

  if (!currentPage) return null;

  const currentImageSrc = useDirect && currentPage.rawUrl
    ? currentPage.rawUrl
    : (currentPage.proxyUrl || `/api/proxy/image?url=${encodeURIComponent(currentPage.rawUrl || '')}`);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between select-none">
      {/* Top Bar */}
      <div className="w-full max-w-7xl px-4 py-3 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {t.page} {currentPage.pageNumber} / {pages.length}
          </span>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            #{currentPage.formattedIndex}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title={t.zoomIn}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title={t.zoomOut}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRotate}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer hidden sm:block"
          >
            {t.resetZoom}
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={() => onDownloadPage(currentPage)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer shadow-md"
            title={t.downloadThisPage}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.downloadThisPage}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-900 hover:bg-red-600/80 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer ml-2"
            title={t.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative flex-1 w-full flex items-center justify-center p-4 overflow-hidden">
        {/* Previous Button */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white border border-slate-700/80 transition-all cursor-pointer shadow-xl"
            title="Previous Page (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        )}

        {/* Current Image */}
        <div
          className="max-w-full max-h-full flex items-center justify-center transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        >
          <img
            key={currentImageSrc}
            src={currentImageSrc}
            alt={`Page ${currentPage.pageNumber}`}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              if (!useDirect && currentPage.rawUrl) {
                setUseDirect(true);
              } else {
                setIsLoading(false);
              }
            }}
            className={`max-h-[82vh] max-w-[90vw] object-contain rounded-lg shadow-2xl transition-opacity duration-200 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Next Button */}
        {currentIndex < pages.length - 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white border border-slate-700/80 transition-all cursor-pointer shadow-xl"
            title="Next Page (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Bar */}
      <div className="w-full max-w-5xl px-4 py-2 flex items-center gap-2 overflow-x-auto border-t border-slate-800/80 bg-slate-950/60">
        {pages.map((p, idx) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setCurrentIndex(idx);
              setZoom(1);
              setRotation(0);
              setIsLoading(true);
              setUseDirect(false);
            }}
            className={`relative flex-shrink-0 w-12 h-16 rounded border overflow-hidden transition-all cursor-pointer ${
              idx === currentIndex
                ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-105'
                : 'border-slate-800 opacity-60 hover:opacity-100'
            }`}
          >
            <img
              src={p.proxyUrl}
              alt={`Thumb ${p.pageNumber}`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-0 right-0 px-1 text-[9px] font-mono bg-slate-950/80 text-slate-300">
              {p.pageNumber}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
