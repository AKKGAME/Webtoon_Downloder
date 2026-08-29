import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Archive, FileText, Download } from 'lucide-react';
import { DownloadProgress } from '../types';
import { Language, translations } from '../utils/translations';

interface ProgressOverlayProps {
  lang: Language;
  progress: DownloadProgress;
}

export const ProgressOverlay: React.FC<ProgressOverlayProps> = ({ lang, progress }) => {
  const t = translations[lang];

  if (progress.status === 'idle') return null;

  return (
    <div className="w-full bg-slate-900/95 border border-indigo-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-md relative overflow-hidden">
      {/* Animated accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {progress.status === 'completed' ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
            ) : progress.status === 'error' ? (
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            )}

            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                {progress.status === 'downloading' && t.downloadingProgress}
                {progress.status === 'zipping' && t.generatingZip}
                {progress.status === 'pdf' && t.generatingPdf}
                {progress.status === 'completed' && t.downloadComplete}
                {progress.status === 'error' && (progress.message || 'Error occurred')}
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-sm sm:max-w-md">
                {progress.currentFilename || progress.message || `${progress.current} / ${progress.total}`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-lg sm:text-2xl font-black text-indigo-400">
              {progress.percent}%
            </span>
            {progress.speed && (
              <p className="text-xs text-slate-400">{progress.speed}</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300 shadow-sm"
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            {progress.current} / {progress.total} {t.page}s
          </span>
          <span className="text-indigo-300 font-mono">
            {progress.currentFilename}
          </span>
        </div>
      </div>
    </div>
  );
};
