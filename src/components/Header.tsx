import React from 'react';
import { BookOpen, Languages, Sparkles, HelpCircle, Key } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface HeaderProps {
  lang: Language;
  onToggleLang: () => void;
  onOpenHelp: () => void;
  onOpenUnlockModal: () => void;
  hasAuthToken: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onToggleLang,
  onOpenHelp,
  onOpenUnlockModal,
  hasAuthToken,
}) => {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-slate-100 tracking-tight">
                {t.appTitle}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="auth-unlock-header-btn"
            onClick={onOpenUnlockModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer shadow-sm ${
              hasAuthToken
                ? 'border-amber-500/50 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50'
                : 'border-slate-700 hover:border-slate-600 bg-slate-900/80 hover:bg-slate-800 text-slate-200'
            }`}
            title="Unlock / Auth Cookie Session"
          >
            <Key className={`w-3.5 h-3.5 ${hasAuthToken ? 'text-amber-400' : 'text-slate-400'}`} />
            <span className="hidden xs:inline">{t.authSettings}</span>
            {hasAuthToken && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20"></span>
            )}
          </button>

          <button
            id="lang-toggle-btn"
            onClick={onToggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-900/80 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-all cursor-pointer shadow-sm"
            title="Change language"
          >
            <Languages className="w-3.5 h-3.5 text-indigo-400" />
            <span>{lang === 'my' ? 'မြန်မာ' : 'English'}</span>
          </button>

          <button
            id="help-modal-btn"
            onClick={onOpenHelp}
            className="p-2 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            title="Help & Info"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
