import React from 'react';
import { History, ArrowRight, Trash2, BookOpen } from 'lucide-react';
import { HistoryItem } from '../types';
import { Language, translations } from '../utils/translations';

interface HistoryListProps {
  lang: Language;
  history: HistoryItem[];
  onSelectHistory: (item: HistoryItem) => void;
  onClearHistory: () => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  lang,
  history,
  onSelectHistory,
  onClearHistory,
}) => {
  const t = translations[lang];

  if (history.length === 0) return null;

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs sm:text-sm font-bold text-slate-300">
            {t.recentHistory}
          </h3>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t.clearBtn}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {history.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectHistory(item)}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-12 rounded-md bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt={item.mangaTitle}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <BookOpen className="w-4 h-4 text-slate-600" />
                )}
              </div>

              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                  {item.mangaTitle}
                </p>
                <p className="text-[11px] text-indigo-400 truncate font-medium">
                  {item.chapterTitle}
                </p>
                <p className="text-[10px] text-slate-500">
                  {item.totalPages} {t.page}s
                </p>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>
        ))}
      </div>
    </div>
  );
};
