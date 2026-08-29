import React, { useState } from 'react';
import { BookOpen, Layers, ChevronDown, Check, ExternalLink, Calendar, Hash, Lock } from 'lucide-react';
import { ChapterData, ChapterSummary } from '../types';
import { Language, translations } from '../utils/translations';

interface ChapterHeaderProps {
  lang: Language;
  chapterData: ChapterData;
  onSelectChapter: (chapter: ChapterSummary) => void;
}

export const ChapterHeader: React.FC<ChapterHeaderProps> = ({
  lang,
  chapterData,
  onSelectChapter,
}) => {
  const t = translations[lang];
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const currentChapterId = chapterData.chapterId;
  const filteredChapters = chapterData.allChapters.filter((c) =>
    (c.title || `Chapter ${c.number}`).toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
        <div className="flex items-start sm:items-center gap-4">
          {chapterData.mangaCoverUrl ? (
            <div className="w-16 h-22 sm:w-20 sm:h-28 rounded-xl overflow-hidden shadow-lg border border-slate-700/60 shrink-0 bg-slate-950">
              <img
                src={chapterData.mangaCoverUrl}
                alt={chapterData.mangaTitle}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-16 h-22 sm:w-20 sm:h-28 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 flex items-center justify-center shrink-0">
              <BookOpen className="w-8 h-8 text-slate-500" />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Manga Chapter
              </span>
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {chapterData.totalPages} {t.page}s
              </span>
            </div>

            <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
              {chapterData.mangaTitle}
            </h2>

            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-400">
              <span className="font-semibold text-indigo-400">
                {chapterData.chapterTitle}
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                Chapter {chapterData.chapterNumber}
              </span>
            </div>
          </div>
        </div>

        {/* Chapter Switcher Dropdown */}
        {chapterData.allChapters && chapterData.allChapters.length > 1 && (
          <div className="relative w-full md:w-auto">
            <button
              id="chapter-dropdown-toggle"
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full md:w-auto flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-200 transition-all cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>{t.switchChapter} ({chapterData.allChapters.length})</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  showDropdown ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-full md:w-72 max-h-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
                  <div className="p-2 border-b border-slate-800 bg-slate-950/60">
                    <input
                      type="text"
                      placeholder="Filter chapter number..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="overflow-y-auto p-1.5 space-y-0.5 max-h-60 custom-scrollbar">
                    {filteredChapters.map((ch) => {
                      const isCurrent = ch.id === currentChapterId;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => {
                            setShowDropdown(false);
                            onSelectChapter(ch);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                            isCurrent
                              ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                              : ch.isLocked
                              ? 'text-slate-400 hover:bg-slate-800'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate">{ch.title || `Chapter ${ch.number}`}</span>
                          <div className="flex items-center gap-1.5 shrink-0 ml-1">
                            {ch.isLocked && <Lock className="w-3 h-3 text-amber-400/90" />}
                            {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
