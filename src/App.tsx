import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { UrlInputForm } from './components/UrlInputForm';
import { ChapterHeader } from './components/ChapterHeader';
import { DownloadControls } from './components/DownloadControls';
import { ProgressOverlay } from './components/ProgressOverlay';
import { PageGrid } from './components/PageGrid';
import { ImageLightbox } from './components/ImageLightbox';
import { HistoryList } from './components/HistoryList';
import { HelpModal } from './components/HelpModal';
import { UnlockModal } from './components/UnlockModal';
import { LockedChapterBanner } from './components/LockedChapterBanner';
import {
  ChapterData,
  ChapterSummary,
  DownloadFormat,
  DownloadProgress,
  HistoryItem,
  MangaPage,
} from './types';
import { Language, translations } from './utils/translations';
import {
  downloadAsZip,
  downloadSequentiallyIndividual,
  downloadAsPdf,
  fetchPageBlob,
  triggerBlobDownload,
  formatPageFilename,
} from './utils/downloadHelpers';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const HISTORY_STORAGE_KEY = 'manga_downloader_history_v1';
const LANG_STORAGE_KEY = 'manga_downloader_lang_v1';
const AUTH_STORAGE_KEY = 'manga_downloader_auth_token_v1';

interface LockedInfo {
  chapterId: string;
  mangaTitle: string;
  chapterTitle: string;
  allChapters?: ChapterSummary[];
  error?: string;
}

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem(LANG_STORAGE_KEY) as Language) || 'my';
  });

  const [authToken, setAuthToken] = useState<string>(() => {
    return localStorage.getItem(AUTH_STORAGE_KEY) || '';
  });

  const [url, setUrl] = useState<string>(
    'https://allinonemanga.com/read/01a01ec2-930f-755f-b031-8b1740755b9a?page=1'
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockedInfo, setLockedInfo] = useState<LockedInfo | null>(null);

  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());

  const [format, setFormat] = useState<DownloadFormat>('zip');
  const [prefix, setPrefix] = useState<string>('');
  const [paddingDigits, setPaddingDigits] = useState<number>(3);

  const [progress, setProgress] = useState<DownloadProgress>({
    status: 'idle',
    current: 0,
    total: 0,
    percent: 0,
  });

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const t = translations[lang];

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSaveAuthToken = (newToken: string) => {
    setAuthToken(newToken);
    if (newToken) {
      localStorage.setItem(AUTH_STORAGE_KEY, newToken);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    // Refresh proxy URLs in loaded chapterData if already present
    if (chapterData && chapterData.pages) {
      const updatedPages = chapterData.pages.map((p) => {
        let baseProxy = p.proxyUrl ? p.proxyUrl.replace(/([?&])auth=[^&]*/g, '') : `/api/manga/proxy-image?id=${encodeURIComponent(p.id)}`;
        if (newToken) {
          const sep = baseProxy.includes('?') ? '&' : '?';
          baseProxy = `${baseProxy}${sep}auth=${encodeURIComponent(newToken)}`;
        }
        return {
          ...p,
          proxyUrl: baseProxy,
        };
      });
      setChapterData({
        ...chapterData,
        pages: updatedPages,
      });
    }
  };

  const saveHistoryItem = (data: ChapterData, originalUrl: string) => {
    try {
      const item: HistoryItem = {
        id: data.chapterId,
        url: originalUrl,
        mangaTitle: data.mangaTitle,
        chapterTitle: data.chapterTitle,
        totalPages: data.totalPages,
        coverUrl: data.mangaCoverUrl,
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        const filtered = prev.filter((h) => h.id !== item.id);
        const updated = [item, ...filtered].slice(0, 12);
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {
      // ignore
    }
  };

  const handleToggleLang = () => {
    const nextLang: Language = lang === 'my' ? 'en' : 'my';
    setLang(nextLang);
    localStorage.setItem(LANG_STORAGE_KEY, nextLang);
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

  // Fetch Chapter Details & Pages (with optional custom auth override)
  const fetchChapter = async (targetUrl: string, authOverride?: string) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;

    // Direct check if input is HTML or multi-image snippet
    if (trimmed.includes('<img') || trimmed.includes('<div') || trimmed.includes('src=') || trimmed.includes('class=')) {
      const srcRegex = /(?:src|data-src|data-lazy-src)=["']\s*(https?:\/\/[^"'\s<>]+)\s*["']/gi;
      const urls: string[] = [];
      let m;
      while ((m = srcRegex.exec(trimmed)) !== null) {
        if (m[1]) urls.push(m[1].trim());
      }

      const imgUrlRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|avif|gif)(?:\?[^\s"'<>]*)?)/gi;
      let imgM;
      while ((imgM = imgUrlRegex.exec(trimmed)) !== null) {
        if (imgM[1]) urls.push(imgM[1].trim());
      }

      const uniqueUrls = Array.from(new Set(urls.filter((u) => u.startsWith('http') && !u.includes('logo') && !u.includes('banner'))));
      if (uniqueUrls.length > 0) {
        const chapMatch = trimmed.match(/value=["']([^"']+)["']/i) || trimmed.match(/id=["']chapter-([^"']+)["']/i);
        const chapterTitle = chapMatch ? chapMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'Chapter';
        handleImportBatchImages('Manga', chapterTitle, uniqueUrls);
        return;
      }
    }

    setIsLoading(true);
    setErrorMsg(null);
    setLockedInfo(null);
    setProgress({ status: 'idle', current: 0, total: 0, percent: 0 });

    const activeAuth = authOverride !== undefined ? authOverride : authToken;

    try {
      const res = await fetch('/api/manga/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl.trim(),
          auth: activeAuth.trim() || undefined,
        }),
      });

      const responseText = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(responseText);
      } catch {
        if (!res.ok) {
          throw new Error(`Server error (${res.status}). Please check your connection or try again.`);
        }
        throw new Error('Received invalid server response. Please verify the URL.');
      }

      if (json && (json.locked || (json.error && String(json.error).toLowerCase().includes('lock')))) {
        setLockedInfo({
          chapterId: json.chapterId || targetUrl,
          mangaTitle: json.mangaTitle || 'Manga',
          chapterTitle: json.chapterTitle || 'Chapter',
          allChapters: json.allChapters || [],
          error: json.error,
        });
        setChapterData(null);
        return;
      }

      if (!res.ok || !json || !json.success) {
        throw new Error(json?.error || t.errorInvalidUrl);
      }

      const data: ChapterData = json.data;
      setChapterData(data);
      setLockedInfo(null);

      // Select all pages by default
      const allIds = new Set(data.pages.map((p) => p.id));
      setSelectedPageIds(allIds);

      // Auto-set prefix e.g. "Solo_Leveling_Ch47"
      const cleanTitle = (data.mangaTitle || 'Manga').replace(/\s+/g, '_');
      const cleanCh = (data.chapterTitle || 'Ch').replace(/\s+/g, '_');
      setPrefix(`${cleanTitle}_${cleanCh}`);

      // Save to history
      saveHistoryItem(data, targetUrl);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setErrorMsg(err.message || t.errorInvalidUrl);
      setChapterData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Import directly from pasted image URLs or HTML
  const handleImportBatchImages = (mangaTitle: string, chapterTitle: string, imageUrls: string[]) => {
    if (!imageUrls || imageUrls.length === 0) return;

    const pages: MangaPage[] = imageUrls.map((imgUrl, index) => {
      const pageNum = index + 1;
      const paddedNum = String(pageNum).padStart(paddingDigits, '0');
      const extMatch = imgUrl.match(/\.(jpg|jpeg|png|webp|avif|gif)(?:\?|$)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';

      return {
        id: `batch-page-${pageNum}`,
        pageNumber: pageNum,
        formattedIndex: paddedNum,
        rawUrl: imgUrl,
        proxyUrl: `/api/proxy/image?url=${encodeURIComponent(imgUrl)}`,
        format: ext,
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      };
    });

    const customChapter: ChapterData = {
      chapterId: `custom-batch-${Date.now()}`,
      mangaTitle: mangaTitle || 'Manga',
      mangaSlug: (mangaTitle || 'manga').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      mangaCoverUrl: pages[0]?.rawUrl || null,
      chapterTitle: chapterTitle || 'Chapter',
      chapterNumber: 1,
      totalPages: pages.length,
      pages,
      allChapters: [],
    };

    setChapterData(customChapter);
    setLockedInfo(null);
    setErrorMsg(null);

    const allIds = new Set(pages.map((p) => p.id));
    setSelectedPageIds(allIds);

    const cleanTitle = (mangaTitle || 'Manga').replace(/\s+/g, '_');
    const cleanCh = (chapterTitle || 'Chapter').replace(/\s+/g, '_');
    setPrefix(`${cleanTitle}_${cleanCh}`);
  };

  // Unlock and retry fetching
  const handleUnlockAndRetry = async (tokenToUse: string) => {
    handleSaveAuthToken(tokenToUse);
    setShowUnlockModal(false);
    await fetchChapter(url, tokenToUse);
  };

  // Switch to another chapter from the chapters list
  const handleSelectChapter = (chapter: ChapterSummary) => {
    const newUrl = `https://allinonemanga.com/read/${chapter.id}`;
    setUrl(newUrl);
    fetchChapter(newUrl);
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (!chapterData) return;
    setSelectedPageIds(new Set(chapterData.pages.map((p) => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedPageIds(new Set());
  };

  const handleInvertSelection = () => {
    if (!chapterData) return;
    const inverted = new Set<string>();
    for (const page of chapterData.pages) {
      if (!selectedPageIds.has(page.id)) {
        inverted.add(page.id);
      }
    }
    setSelectedPageIds(inverted);
  };

  const handleSelectRange = (start: number, end: number) => {
    if (!chapterData) return;
    const rangeIds = new Set<string>();
    for (const page of chapterData.pages) {
      if (page.pageNumber >= start && page.pageNumber <= end) {
        rangeIds.add(page.id);
      }
    }
    setSelectedPageIds(rangeIds);
  };

  const handleTogglePageSelect = (pageId: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  // Start Batch Download
  const handleStartDownload = async () => {
    if (!chapterData || selectedPageIds.size === 0) return;

    const selectedPages = chapterData.pages.filter((p) => selectedPageIds.has(p.id));
    if (selectedPages.length === 0) return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setErrorMsg(null);
    setProgress({
      status: 'downloading',
      current: 0,
      total: selectedPages.length,
      percent: 0,
      message: 'Starting sequential download...',
    });

    try {
      if (format === 'zip') {
        await downloadAsZip({
          pages: selectedPages,
          prefix: prefix || `${chapterData.mangaTitle}_Ch${chapterData.chapterNumber}`,
          paddingDigits,
          onProgress: setProgress,
          signal,
          authToken,
        });
      } else if (format === 'individual') {
        await downloadSequentiallyIndividual({
          pages: selectedPages,
          prefix: prefix || `${chapterData.mangaTitle}_Ch${chapterData.chapterNumber}`,
          paddingDigits,
          delayMs: 300,
          onProgress: setProgress,
          signal,
          authToken,
        });
      } else if (format === 'pdf') {
        await downloadAsPdf({
          pages: selectedPages,
          prefix: prefix || `${chapterData.mangaTitle}_Ch${chapterData.chapterNumber}`,
          paddingDigits,
          onProgress: setProgress,
          signal,
          authToken,
        });
      }
    } catch (err: any) {
      if (err.message === 'Download cancelled') {
        setProgress({
          status: 'idle',
          current: 0,
          total: 0,
          percent: 0,
        });
      } else {
        console.error('Download error:', err);
        setProgress({
          status: 'error',
          current: 0,
          total: selectedPages.length,
          percent: 0,
          message: err.message || 'Failed to download images',
        });
      }
    }
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setProgress({ status: 'idle', current: 0, total: 0, percent: 0 });
  };

  // Download a single page immediately
  const handleDownloadSinglePage = async (page: MangaPage) => {
    try {
      const { blob, ext } = await fetchPageBlob(page, undefined, 2, authToken);
      const filename = formatPageFilename(
        prefix || (chapterData?.mangaTitle || 'manga'),
        page.pageNumber,
        paddingDigits,
        ext
      );
      triggerBlobDownload(blob, filename);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        lang={lang}
        onToggleLang={handleToggleLang}
        onOpenHelp={() => setShowHelp(true)}
        onOpenUnlockModal={() => setShowUnlockModal(true)}
        hasAuthToken={Boolean(authToken)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* URL Input Form */}
        <UrlInputForm
          lang={lang}
          url={url}
          onChangeUrl={setUrl}
          onSubmit={fetchChapter}
          onImportBatchImages={handleImportBatchImages}
          isLoading={isLoading}
        />

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs sm:text-sm flex items-start gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Error loading manga link</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
            {errorMsg.toLowerCase().includes('lock') || errorMsg.includes('401') ? (
              <button
                type="button"
                onClick={() => setShowUnlockModal(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shrink-0 transition-colors"
              >
                Unlock
              </button>
            ) : null}
          </div>
        )}

        {/* Locked Chapter Banner */}
        {lockedInfo && !chapterData && (
          <LockedChapterBanner
            lang={lang}
            chapterId={lockedInfo.chapterId}
            mangaTitle={lockedInfo.mangaTitle}
            chapterTitle={lockedInfo.chapterTitle}
            allChapters={lockedInfo.allChapters}
            onOpenUnlockModal={() => setShowUnlockModal(true)}
            onSelectChapter={handleSelectChapter}
            onRetryUnlock={() => fetchChapter(url)}
            isRetrying={isLoading}
          />
        )}

        {/* Progress Overlay */}
        {progress.status !== 'idle' && (
          <ProgressOverlay
            lang={lang}
            progress={progress}
            onOpenUnlockModal={() => setShowUnlockModal(true)}
            onDismiss={() => setProgress({ status: 'idle', current: 0, total: 0, percent: 0 })}
          />
        )}

        {/* Chapter Details & Controls */}
        {chapterData && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <ChapterHeader
              lang={lang}
              chapterData={chapterData}
              onSelectChapter={handleSelectChapter}
            />

            <DownloadControls
              lang={lang}
              selectedCount={selectedPageIds.size}
              totalCount={chapterData.totalPages}
              format={format}
              onChangeFormat={setFormat}
              prefix={prefix}
              onChangePrefix={setPrefix}
              paddingDigits={paddingDigits}
              onChangePaddingDigits={setPaddingDigits}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onInvertSelection={handleInvertSelection}
              onSelectRange={handleSelectRange}
              onStartDownload={handleStartDownload}
              onCancelDownload={handleCancelDownload}
              isDownloading={
                progress.status === 'downloading' ||
                progress.status === 'zipping' ||
                progress.status === 'pdf'
              }
            />

            <PageGrid
              lang={lang}
              pages={chapterData.pages}
              selectedPageIds={selectedPageIds}
              onTogglePageSelect={handleTogglePageSelect}
              onOpenLightbox={(idx) => setLightboxIndex(idx)}
              onDownloadSinglePage={handleDownloadSinglePage}
            />
          </div>
        )}

        {/* History List */}
        {!chapterData && !lockedInfo && (
          <HistoryList
            lang={lang}
            history={history}
            onSelectHistory={(item) => {
              setUrl(item.url);
              fetchChapter(item.url);
            }}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && chapterData && (
        <ImageLightbox
          lang={lang}
          pages={chapterData.pages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDownloadPage={handleDownloadSinglePage}
        />
      )}

      {/* Unlock / Auth Token Modal */}
      <UnlockModal
        lang={lang}
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        authToken={authToken}
        onSaveAuthToken={handleSaveAuthToken}
        onUnlockAndRetry={handleUnlockAndRetry}
        isRetrying={isLoading}
      />

      {/* Help Modal */}
      {showHelp && (
        <HelpModal lang={lang} onClose={() => setShowHelp(false)} />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>
          Manga Sequential Image Downloader • High-speed ordered extraction & export
        </p>
      </footer>
    </div>
  );
}
