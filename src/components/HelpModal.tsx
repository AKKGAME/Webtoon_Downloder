import React from 'react';
import { X, CheckCircle2, Download, Zap, Layers, Sparkles } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface HelpModalProps {
  lang: Language;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ lang, onClose }) => {
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              {lang === 'my' ? 'အသုံးပြုနည်း လမ်းညွှန်' : 'How to Use'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-slate-300">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold shrink-0">
              1
            </div>
            <div>
              <p className="font-semibold text-white">
                {lang === 'my' ? 'မန်ဂါလင့်ခ် ထည့်သွင်းပါ' : 'Paste Manga Link'}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                {lang === 'my'
                  ? 'AllInOneManga read လင့်ခ် (ဥပမာ: https://allinonemanga.com/read/... ) ကို ထည့်ပြီး "စာမျက်နှာများ ယူရန်" ကို နှိပ်ပါ။'
                  : 'Paste your chapter link or UUID and click "Fetch Pages".'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold shrink-0">
              2
            </div>
            <div>
              <p className="font-semibold text-white">
                {lang === 'my' ? 'ဒေါင်းလုဒ် ပုံစံ ရွေးချယ်ပါ' : 'Select Download Format'}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                {lang === 'my'
                  ? 'ZIP Archive (အားလုံး ဖိုင်တစ်ခုတည်း အစဥ်လိုက်), ပုံတစ်ပုံချင်း သို့မဟုတ် PDF စာအုပ်အဖြစ် ရွေးချယ်နိုင်ပါသည်။'
                  : 'Choose between ZIP archive (001.jpg, 002.jpg...), sequential single downloads, or PDF booklet.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold shrink-0">
              3
            </div>
            <div>
              <p className="font-semibold text-white">
                {lang === 'my' ? 'အစဥ်လိုက် ဒေါင်းလုဒ်ဆွဲပါ' : 'Sequential Order Guaranteed'}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                {lang === 'my'
                  ? 'ပုံများကို 001, 002, 003 စသည့် အစဥ်လိုက်အတိုင်း အတိအကျ သပ်ရပ်စွာ အမည်ပေး၍ ဒေါင်းလုဒ်ဆွဲပေးပါသည်။'
                  : 'All images are numbered sequentially with configurable zero-padding (001, 002...).'}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
        >
          {t.close}
        </button>
      </div>
    </div>
  );
};
