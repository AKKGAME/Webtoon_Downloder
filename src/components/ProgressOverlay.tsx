import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Key, RefreshCw, XCircle } from 'lucide-react';
import { DownloadProgress } from '../types';
import { Language, translations } from '../utils/translations';

interface ProgressOverlayProps {
  lang: Language;
  progress: DownloadProgress;
  onOpenUnlockModal?: () => void;
  onDismiss?: () => void;
}

export const ProgressOverlay: React.FC<ProgressOverlayProps> = ({
  lang,
  progress,
  onOpenUnlockModal,
  onDismiss,
}) => {
  const t = translations[lang];

  if (progress.status === 'idle') return null;

  const isAuthError =
    progress.status === 'error' &&
    (progress.message?.includes('401') ||
      progress.message?.includes('403') ||
      progress.message?.toLowerCase().includes('unauthorized') ||
      progress.message?.toLowerCase().includes('forbidden') ||
      progress.message?.toLowerCase().includes('lock'));

  return (
    <div className="w-full bg-slate-900/95 border border-indigo-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-md relative overflow-hidden space-y-4">
      {/* Animated accent line */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          progress.status === 'error'
            ? 'bg-gradient-to-r from-red-500 via-amber-500 to-red-500'
            : progress.status === 'completed'
            ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500'
            : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
        }`}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {progress.status === 'completed' ? (
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
          ) : progress.status === 'error' ? (
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          )}

          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              {progress.status === 'downloading' && t.downloadingProgress}
              {progress.status === 'zipping' && t.generatingZip}
              {progress.status === 'pdf' && t.generatingPdf}
              {progress.status === 'completed' && t.downloadComplete}
              {progress.status === 'error' && (isAuthError ? 'Authentication / Unlock Required' : 'Download Error')}
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-sm sm:max-w-md">
              {progress.message || progress.currentFilename || `${progress.current} / ${progress.total}`}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3">
          {progress.status === 'error' && isAuthError && onOpenUnlockModal && (
            <button
              type="button"
              onClick={onOpenUnlockModal}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{t.unlockModalTitle}</span>
            </button>
          )}

          {progress.status === 'error' && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs transition-colors cursor-pointer"
              title="Dismiss error"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}

          {progress.status !== 'error' && (
            <div className="text-right">
              <span className="text-lg sm:text-2xl font-black text-indigo-400">
                {progress.percent}%
              </span>
              {progress.speed && (
                <p className="text-xs text-slate-400">{progress.speed}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-300 shadow-sm ${
            progress.status === 'error'
              ? 'bg-red-500'
              : progress.status === 'completed'
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
          }`}
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
  );
};
