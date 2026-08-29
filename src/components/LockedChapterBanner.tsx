import React from 'react';
import { Lock, Key, RefreshCw, BookOpen, AlertTriangle } from 'lucide-react';
import { ChapterSummary } from '../types';
import { Language, translations } from '../utils/translations';

interface LockedChapterBannerProps {
  lang: Language;
  mangaTitle?: string;
  chapterTitle?: string;
  chapterId?: string;
  allChapters?: ChapterSummary[];
  onOpenUnlockModal: () => void;
  onSelectChapter?: (chapter: ChapterSummary) => void;
  onRetryUnlock?: () => void;
  isRetrying?: boolean;
}

export const LockedChapterBanner: React.FC<LockedChapterBannerProps> = ({
  lang,
  mangaTitle,
  chapterTitle,
  chapterId,
  allChapters = [],
  onOpenUnlockModal,
  onSelectChapter,
  onRetryUnlock,
  isRetrying = false,
}) => {
  const t = translations[lang];

  return (
    <div className="rounded-2xl bg-gradient-to-b from-amber-950/40 to-slate-900 border border-amber-500/40 p-6 shadow-xl space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold tracking-wide border border-amber-500/30 mb-1">
              <AlertTriangle className="w-3 h-3" />
              <span>{t.lockedBadge} (AllInOneManga)</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100">
              {mangaTitle ? `${mangaTitle} - ` : ''}
              {chapterTitle || 'Chapter'}
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {onRetryUnlock && (
            <button
              type="button"
              onClick={onRetryUnlock}
              disabled={isRetrying}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{t.unlockNowBtn}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenUnlockModal}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-bold shadow-lg shadow-amber-500/25 transition-all inline-flex items-center justify-center gap-2"
          >
            <Key className="w-4 h-4" />
            <span>{t.unlockModalTitle}</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-950/60 rounded-xl p-4 border border-amber-500/20 text-xs sm:text-sm text-slate-300 space-y-2 leading-relaxed">
        <p className="font-medium text-amber-200">{t.lockedTitle}</p>
        <p className="text-slate-400">{t.lockedDesc}</p>
      </div>

      {/* Other unlocked chapters in this manga if available */}
      {allChapters && allChapters.length > 0 && onSelectChapter && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              {t.allChapters} ({allChapters.length})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
            {allChapters.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => onSelectChapter(ch)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all flex items-center justify-between gap-1.5 ${
                  ch.id === chapterId
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                    : ch.isLocked
                    ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    : 'bg-slate-900 border-slate-700/80 text-slate-200 hover:border-indigo-500 hover:bg-slate-800'
                }`}
              >
                <span className="truncate">{ch.title || `Ch. ${ch.number}`}</span>
                {ch.isLocked && <Lock className="w-3 h-3 text-amber-400/80 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
