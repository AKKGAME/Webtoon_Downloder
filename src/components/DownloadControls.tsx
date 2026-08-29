import React, { useState } from 'react';
import {
  Archive,
  Download,
  FileText,
  Files,
  Settings2,
  CheckSquare,
  Square,
  Sliders,
  Check,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { DownloadFormat } from '../types';
import { Language, translations } from '../utils/translations';

interface DownloadControlsProps {
  lang: Language;
  selectedCount: number;
  totalCount: number;
  format: DownloadFormat;
  onChangeFormat: (f: DownloadFormat) => void;
  prefix: string;
  onChangePrefix: (p: string) => void;
  paddingDigits: number;
  onChangePaddingDigits: (digits: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onInvertSelection: () => void;
  onSelectRange: (start: number, end: number) => void;
  onStartDownload: () => void;
  onCancelDownload: () => void;
  isDownloading: boolean;
}

export const DownloadControls: React.FC<DownloadControlsProps> = ({
  lang,
  selectedCount,
  totalCount,
  format,
  onChangeFormat,
  prefix,
  onChangePrefix,
  paddingDigits,
  onChangePaddingDigits,
  onSelectAll,
  onDeselectAll,
  onInvertSelection,
  onSelectRange,
  onStartDownload,
  onCancelDownload,
  isDownloading,
}) => {
  const t = translations[lang];
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState(String(totalCount));

  const handleApplyRange = (e: React.FormEvent) => {
    e.preventDefault();
    const start = Math.max(1, parseInt(rangeStart, 10) || 1);
    const end = Math.min(totalCount, Math.max(start, parseInt(rangeEnd, 10) || totalCount));
    onSelectRange(start, end);
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm space-y-5">
      {/* Top Bar: Selection counts & action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">
            {t.selectedPages}:
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {selectedCount} / {totalCount}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            id="select-all-btn"
            onClick={onSelectAll}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t.selectAll}</span>
          </button>

          <button
            type="button"
            id="deselect-all-btn"
            onClick={onDeselectAll}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 text-slate-400" />
            <span>{t.deselectAll}</span>
          </button>

          <button
            type="button"
            id="invert-select-btn"
            onClick={onInvertSelection}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>{t.invertSelection}</span>
          </button>

          <button
            type="button"
            id="toggle-advanced-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${
              showAdvanced
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Options</span>
          </button>
        </div>
      </div>

      {/* Advanced Settings Drawer */}
      {showAdvanced && (
        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Custom Range */}
            <form onSubmit={handleApplyRange} className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                {t.customRange}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={totalCount}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  placeholder="From"
                  className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-center text-white outline-none focus:border-indigo-500"
                />
                <span className="text-slate-500 text-xs">-</span>
                <input
                  type="number"
                  min="1"
                  max={totalCount}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  placeholder="To"
                  className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-center text-white outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-indigo-300 border border-indigo-500/30 rounded-lg transition-colors cursor-pointer"
                >
                  {t.applyRange}
                </button>
              </div>
            </form>

            {/* Prefix */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                {t.namingPrefix}
              </label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => onChangePrefix(e.target.value)}
                placeholder="e.g. Solo_Leveling_Ch47"
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-indigo-500"
              />
            </div>

            {/* Zero padding */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                {t.paddingDigits}
              </label>
              <div className="flex items-center gap-2">
                {[2, 3, 4].map((digits) => (
                  <button
                    key={digits}
                    type="button"
                    onClick={() => onChangePaddingDigits(digits)}
                    className={`flex-1 py-1.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                      paddingDigits === digits
                        ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500 font-semibold'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {String(1).padStart(digits, '0')} ({digits})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Format Selection Cards */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 block">
          {t.saveAs}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* ZIP */}
          <button
            type="button"
            id="format-zip-btn"
            onClick={() => onChangeFormat('zip')}
            className={`flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
              format === 'zip'
                ? 'bg-indigo-600/15 border-indigo-500/80 shadow-md shadow-indigo-500/10'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${format === 'zip' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Archive className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-white">{t.downloadZip}</span>
              </div>
              {format === 'zip' && <Check className="w-4 h-4 text-indigo-400" />}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t.formatZipDesc}
            </p>
          </button>

          {/* Individual files */}
          <button
            type="button"
            id="format-single-btn"
            onClick={() => onChangeFormat('individual')}
            className={`flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
              format === 'individual'
                ? 'bg-indigo-600/15 border-indigo-500/80 shadow-md shadow-indigo-500/10'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${format === 'individual' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Files className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-white">{t.downloadSingle}</span>
              </div>
              {format === 'individual' && <Check className="w-4 h-4 text-indigo-400" />}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t.formatIndividualDesc}
            </p>
          </button>

          {/* PDF Book */}
          <button
            type="button"
            id="format-pdf-btn"
            onClick={() => onChangeFormat('pdf')}
            className={`flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
              format === 'pdf'
                ? 'bg-indigo-600/15 border-indigo-500/80 shadow-md shadow-indigo-500/10'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${format === 'pdf' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-white">{t.downloadPdf}</span>
              </div>
              {format === 'pdf' && <Check className="w-4 h-4 text-indigo-400" />}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t.formatPdfDesc}
            </p>
          </button>
        </div>
      </div>

      {/* Main Download Button */}
      <div className="pt-2">
        {isDownloading ? (
          <button
            type="button"
            id="cancel-download-btn"
            onClick={onCancelDownload}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 font-bold rounded-xl transition-all cursor-pointer shadow-lg"
          >
            <XCircle className="w-5 h-5 text-red-400" />
            <span>{t.cancelDownload}</span>
          </button>
        ) : (
          <button
            type="button"
            id="start-download-action-btn"
            disabled={selectedCount === 0}
            onClick={onStartDownload}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl transition-all shadow-xl shadow-indigo-600/25 cursor-pointer"
          >
            <Download className="w-5 h-5 text-indigo-200" />
            <span>
              {format === 'zip' && `${t.downloadZip} (${selectedCount} ${t.page}s)`}
              {format === 'individual' && `${t.downloadSingle} (${selectedCount} ${t.page}s)`}
              {format === 'pdf' && `${t.downloadPdf} (${selectedCount} ${t.page}s)`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
