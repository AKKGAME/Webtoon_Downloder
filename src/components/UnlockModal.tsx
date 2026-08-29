import React, { useState, useEffect } from 'react';
import {
  Key,
  X,
  Check,
  HelpCircle,
  Lock,
  LogIn,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface UnlockModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  authToken: string;
  onSaveAuthToken: (token: string) => void;
  onUnlockAndRetry?: (token: string) => void;
  isRetrying?: boolean;
}

export const UnlockModal: React.FC<UnlockModalProps> = ({
  lang,
  isOpen,
  onClose,
  authToken,
  onSaveAuthToken,
  onUnlockAndRetry,
  isRetrying = false,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'cookie'>('login');
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tokenInput, setTokenInput] = useState(authToken);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccessMsg, setLoginSuccessMsg] = useState<string | null>(null);
  const [showSavedNotice, setShowSavedNotice] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    setTokenInput(authToken);
  }, [authToken, isOpen]);

  if (!isOpen) return null;

  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim() || !password) {
      setLoginError('Email / Username နှင့် Password ထည့်သွင်းပေးပါ။');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);
    setLoginSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrUsername: emailOrUsername.trim(),
          password,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Login failed. Please check credentials.');
      }

      const newAuth = json.authString || json.token || '';
      onSaveAuthToken(newAuth);
      setTokenInput(newAuth);
      setLoginSuccessMsg(t.loginSuccess);

      setTimeout(() => {
        if (onUnlockAndRetry) {
          onUnlockAndRetry(newAuth);
        } else {
          onClose();
        }
      }, 900);
    } catch (err: any) {
      setLoginError(err.message || 'Login error occurred');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSaveCookie = () => {
    onSaveAuthToken(tokenInput.trim());
    setShowSavedNotice(true);
    setTimeout(() => {
      setShowSavedNotice(false);
      onClose();
    }, 1000);
  };

  const handleClear = () => {
    setTokenInput('');
    setEmailOrUsername('');
    setPassword('');
    setLoginError(null);
    setLoginSuccessMsg(null);
    onSaveAuthToken('');
  };

  const handleUnlockNow = () => {
    onSaveAuthToken(tokenInput.trim());
    if (onUnlockAndRetry) {
      onUnlockAndRetry(tokenInput.trim());
    }
  };

  const hasActiveSession = Boolean(authToken && authToken.trim().length > 0);

  return (
    <div
      id="unlock-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="unlock-modal-card"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                {t.unlockModalTitle}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                AllInOneManga Account Session & Chapter Unlock
              </p>
            </div>
          </div>
          <button
            id="unlock-modal-close-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Session Status if logged in */}
        {hasActiveSession && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{t.loggedInStatus}</span>
            </div>
            <button
              id="logout-session-btn"
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1 rounded-lg transition-colors text-xs font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.clearAuthBtn}</span>
            </button>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-xl">
          <button
            id="tab-direct-login-btn"
            type="button"
            onClick={() => setActiveTab('login')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'login'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{t.tabDirectLogin}</span>
          </button>
          <button
            id="tab-cookie-token-btn"
            type="button"
            onClick={() => setActiveTab('cookie')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'cookie'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>{t.tabCookieToken}</span>
          </button>
        </div>

        {/* Tab 1: Direct Account Login */}
        {activeTab === 'login' && (
          <form onSubmit={handleDirectLogin} className="space-y-4">
            <div className="text-xs sm:text-sm text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
              <p className="leading-relaxed">
                AllInOneManga တွင် အသုံးပြုထားသော Email (သို့မဟုတ် Username) နှင့် Password ဖြင့် ဤနေရာမှ တိုက်ရိုက် Login ဝင်နိုင်ပါသည်။
              </p>
              <div className="flex items-center gap-1.5 text-xs text-amber-400/90 font-medium pt-1">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>စကားဝှက်များကို ဆာဗာတွင် သိမ်းဆည်းခြင်းမရှိဘဲ AllInOneManga နှင့် တိုက်ရိုက်ချိတ်ဆက်ပါသည်။</span>
              </div>
            </div>

            {loginError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {loginSuccessMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{loginSuccessMsg}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  {t.emailOrUsernameLabel}
                </label>
                <input
                  id="login-email-input"
                  type="text"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="example@gmail.com သို့မဟုတ် username"
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  {t.passwordLabel}
                </label>
                <div className="relative">
                  <input
                    id="login-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="submit-direct-login-btn"
                type="submit"
                disabled={isLoggingIn || !emailOrUsername.trim() || !password}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t.loggingIn}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{t.loginBtn}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Manual Cookie / Token Paste */}
        {activeTab === 'cookie' && (
          <div className="space-y-4">
            <div className="text-xs sm:text-sm text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
              <p className="leading-relaxed">{t.unlockModalDesc}</p>
              <div className="flex items-center gap-1.5 text-xs text-amber-400/90 font-medium">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Token/Cookie သည် သင့် Browser localStorage တွင်သာ လုံခြုံစွာသိမ်းဆည်းပါမည်။</span>
              </div>
            </div>

            {/* Input Form */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Session Cookie / Bearer Token
              </label>
              <textarea
                id="manual-token-textarea"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                rows={3}
                placeholder={t.cookiePlaceholder}
                className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                id="clear-token-btn"
                type="button"
                onClick={handleClear}
                disabled={!tokenInput}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.clearAuthBtn}
              </button>

              <div className="flex items-center gap-2">
                <button
                  id="save-cookie-token-btn"
                  type="button"
                  onClick={handleSaveCookie}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors inline-flex items-center gap-1.5"
                >
                  {showSavedNotice ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">{t.authSavedSuccess}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{t.saveAuthBtn}</span>
                    </>
                  )}
                </button>

                <button
                  id="unlock-and-retry-btn"
                  type="button"
                  onClick={handleUnlockNow}
                  disabled={isRetrying || !tokenInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20 transition-all inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRetrying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Unlocking...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{t.unlockNowBtn}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step-by-step Guide */}
            <div className="border-t border-slate-800/80 pt-4 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                {t.howToGetCookie}
              </h4>
              <div className="space-y-1.5 text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 font-sans leading-relaxed">
                <p>{t.step1}</p>
                <p>{t.step2}</p>
                <p>{t.step3}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
