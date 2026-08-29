import React, { useState } from 'react';
import {
  Search,
  Clipboard,
  Sparkles,
  X,
  Loader2,
  ArrowRight,
  Layers,
  Code2,
  FileImage,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface UrlInputFormProps {
  lang: Language;
  url: string;
  onChangeUrl: (val: string) => void;
  onSubmit: (url: string) => void;
  onImportBatchImages?: (mangaTitle: string, chapterTitle: string, imageUrls: string[]) => void;
  isLoading: boolean;
}

const SAMPLE_URL = 'https://allinonemanga.com/read/01a01ec2-930f-755f-b031-8b1740755b9a?page=1';
const SAMPLE_MANGAMANGO_URL = 'https://mangamangomyanmar.com/manga/the-reincarnated-assassin-is-a-genius-swordsman/episode-11/';

export const UrlInputForm: React.FC<UrlInputFormProps> = ({
  lang,
  url,
  onChangeUrl,
  onSubmit,
  onImportBatchImages,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'batch' | 'script'>('url');
  const [batchText, setBatchText] = useState('');
  const [batchMangaTitle, setBatchMangaTitle] = useState('The Reincarnated Assassin');
  const [batchChapterTitle, setBatchChapterTitle] = useState('Episode 11');
  const [copiedScript, setCopiedScript] = useState(false);

  const t = translations[lang];

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChangeUrl(text.trim());
      }
    } catch {
      // ignore
    }
  };

  const handlePasteBatch = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setBatchText(text.trim());
      }
    } catch {
      // ignore
    }
  };

  const handleUseSample = (sample: string) => {
    onChangeUrl(sample);
    onSubmit(sample);
  };

  const extractImagesFromHtmlOrText = (raw: string): { urls: string[]; mangaTitle?: string; chapterTitle?: string } => {
    const urls: string[] = [];

    // 1. Look for src, data-src, data-lazy-src attributes (supports quotes with leading/trailing spaces)
    const srcRegex = /(?:src|data-src|data-lazy-src)=["']\s*(https?:\/\/[^"'\s<>]+)\s*["']/gi;
    let m;
    while ((m = srcRegex.exec(raw)) !== null) {
      if (m[1]) urls.push(m[1].trim());
    }

    // 2. Look for standard http / https image URLs
    const imgUrlRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|avif|gif)(?:\?[^\s"'<>]*)?)/gi;
    let imgM;
    while ((imgM = imgUrlRegex.exec(raw)) !== null) {
      if (imgM[1]) urls.push(imgM[1].trim());
    }

    // 3. Fallback general http regex if still empty
    if (urls.length === 0) {
      const generalRegex = /(https?:\/\/[^\s"'<>\n\r]+)/gi;
      let g;
      while ((g = generalRegex.exec(raw)) !== null) {
        if (g[1]) urls.push(g[1].trim());
      }
    }

    // Deduplicate & clean
    const cleanedUrls = Array.from(
      new Set(
        urls
          .map((u) => u.replace(/[",;)>\]]+$/, '').trim())
          .filter(
            (u) =>
              u.startsWith('http') &&
              !u.includes('favicon') &&
              !u.includes('gravatar') &&
              !u.includes('logo') &&
              !u.includes('banner')
          )
      )
    );

    // Extract chapter title from value="episode-11" or similar
    const chapMatch = raw.match(/value=["']([^"']+)["']/i) || raw.match(/id=["']chapter-([^"']+)["']/i);
    const chapterTitle = chapMatch ? chapMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : undefined;

    return { urls: cleanedUrls, chapterTitle };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    // Check if user pasted HTML snippet into the main input
    if (trimmed.includes('<img') || trimmed.includes('<div') || trimmed.includes('class=') || trimmed.includes('\n')) {
      const { urls, chapterTitle } = extractImagesFromHtmlOrText(trimmed);
      if (urls.length > 0 && onImportBatchImages) {
        onImportBatchImages(batchMangaTitle || 'Manga', chapterTitle || 'Chapter', urls);
        return;
      }
    }

    onSubmit(trimmed);
  };

  // Parse direct image URLs or HTML
  const handleParseBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchText.trim() || !onImportBatchImages) return;

    const { urls, chapterTitle } = extractImagesFromHtmlOrText(batchText);

    if (urls.length === 0) {
      alert(lang === 'my' ? 'မှန်ကန်သော ပုံ Link (Image URLs) မတွေ့ရှိပါ။' : 'No valid image URLs found in the text.');
      return;
    }

    onImportBatchImages(
      batchMangaTitle.trim() || 'Manga',
      chapterTitle || batchChapterTitle.trim() || 'Chapter',
      urls
    );
  };

  const browserHelperScript = `// 1-Click AllInOneManga / Manga Image Extractor
(function() {
  const imgs = Array.from(document.querySelectorAll('img')).map(i => i.src || i.dataset.src || i.getAttribute('data-src')).filter(s => s && s.startsWith('http') && (s.includes('/manga/') || s.includes('.jpg') || s.includes('.webp') || s.includes('.png') || s.includes('/chapter/')));
  const unique = [...new Set(imgs)];
  if (!unique.length) {
    alert("No manga images found on this page!");
  } else {
    prompt("Found " + unique.length + " pages! Copy these URLs and paste into the Manga Downloader App:", unique.join('\\n'));
  }
})();`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(browserHelperScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm space-y-4">
      {/* Mode Navigation Tabs */}
      <div className="flex p-1 bg-slate-950 border border-slate-800/80 rounded-xl overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'url'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>{t.tabUrlInput}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('batch')}
          className={`flex-1 min-w-[150px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'batch'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileImage className="w-3.5 h-3.5" />
          <span>{t.tabBatchImages}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('script')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'script'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>{t.tabBrowserScript}</span>
        </button>
      </div>

      {/* Tab 1: Standard URL Input */}
      {activeTab === 'url' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="manga-url-input"
                type="text"
                value={url}
                onChange={(e) => onChangeUrl(e.target.value)}
                placeholder={t.enterUrlPlaceholder}
                disabled={isLoading}
                className="w-full pl-10 pr-10 py-3 bg-slate-950/90 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-sm text-slate-100 placeholder-slate-500 transition-all outline-none font-mono"
              />
              {url && !isLoading && (
                <button
                  type="button"
                  id="clear-url-btn"
                  onClick={() => onChangeUrl('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              id="fetch-pages-btn"
              disabled={isLoading || !url.trim()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25 cursor-pointer whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
                  <span>{t.fetching}</span>
                </>
              ) : (
                <>
                  <span>{t.fetchBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="paste-clipboard-btn"
                onClick={handlePaste}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
                <span>{t.pasteBtn}</span>
              </button>

              <button
                type="button"
                id="sample-url-btn"
                onClick={() => handleUseSample(SAMPLE_URL)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>AllInOne Sample</span>
              </button>

              <button
                type="button"
                id="sample-mangamango-btn"
                onClick={() => handleUseSample(SAMPLE_MANGAMANGO_URL)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-colors cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                <span>MangaMango Sample</span>
              </button>
            </div>

            <div className="text-slate-500 text-xs text-right">
              Supports MangaMango Myanmar & AllInOneManga links
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: Batch Image URLs / HTML Parser */}
      {activeTab === 'batch' && (
        <form onSubmit={handleParseBatch} className="space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={batchMangaTitle}
              onChange={(e) => setBatchMangaTitle(e.target.value)}
              placeholder={t.batchTitle}
              className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              value={batchChapterTitle}
              onChange={(e) => setBatchChapterTitle(e.target.value)}
              placeholder={t.batchChapter}
              className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="relative">
            <textarea
              rows={4}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={t.batchPlaceholder}
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono resize-y"
            />
            <button
              type="button"
              onClick={handlePasteBatch}
              className="absolute right-3 bottom-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700"
            >
              <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
              <span>Paste</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-slate-400">
              HTML ကုဒ် သို့မဟုတ် Image Link များကို ထည့်သွင်းပေးနိုင်ပါသည်
            </span>
            <button
              type="submit"
              disabled={!batchText.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileImage className="w-4 h-4" />
              <span>{t.loadBatchBtn}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Browser 1-Click Script Helper */}
      {activeTab === 'script' && (
        <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-xs sm:text-sm text-slate-300 animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-amber-400" />
              {t.scriptHelpTitle}
            </span>
            <button
              type="button"
              onClick={handleCopyScript}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors cursor-pointer text-xs"
            >
              {copiedScript ? (
                <>
                  <Check className="w-3.5 h-3.5 text-slate-950" />
                  <span>{t.scriptCopied}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t.copyScriptBtn}</span>
                </>
              )}
            </button>
          </div>

          <p className="text-slate-400 text-xs leading-relaxed">
            AllInOneManga တွင် အခန်းကို ဖွင့်ထားပြီး ကီးဘုတ်မှ <b>F12</b> နှိပ်ကာ <b>Console</b> တွင် အောက်ပါ Script ကို Paste ချလိုက်ပါက ပုံ Link များအားလုံးကို ချက်ချင်း Copy ယူပေးမည် ဖြစ်ပါသည်။
          </p>

          <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-amber-300/90 overflow-x-auto whitespace-pre-wrap select-all">
            {browserHelperScript}
          </pre>
        </div>
      )}
    </div>
  );
};
