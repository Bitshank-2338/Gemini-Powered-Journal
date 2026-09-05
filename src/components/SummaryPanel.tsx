import React from 'react';
import { Sparkles, RefreshCw, X, AlertCircle, CheckCircle2, HelpCircle, CheckSquare } from 'lucide-react';
import type { Summary } from '../types';

interface SummaryPanelProps {
  summary: Summary | null;
  onRefresh: () => void;
  onClose: () => void;
  isRefreshing: boolean;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  summary,
  onRefresh,
  onClose,
  isRefreshing,
}) => {
  const status = summary?.status || (isRefreshing ? 'updating' : 'current');

  return (
    <aside className="w-80 h-full bg-[#FFFFFF] border-l border-[#DCE5F0] flex flex-col flex-shrink-0">
      {/* Panel Header */}
      <div className="p-4 border-b border-[#DCE5F0] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#2457D6]" />
          <h3 className="font-semibold text-sm text-[#12243A]">Summary</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            id="refresh-summary-btn"
            onClick={onRefresh}
            disabled={isRefreshing || status === 'updating'}
            className="p-1.5 text-[#52657A] hover:text-[#2457D6] hover:bg-[#F5F8FC] rounded-[6px] transition-colors disabled:opacity-40"
            title="Refresh summary"
            aria-label="Refresh summary"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || status === 'updating' ? 'animate-spin' : ''}`} />
          </button>
          <button
            id="close-summary-panel-btn"
            onClick={onClose}
            className="p-1.5 text-[#52657A] hover:text-[#12243A] hover:bg-[#F5F8FC] rounded-[6px] transition-colors"
            title="Collapse summary panel"
            aria-label="Collapse summary panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 bg-[#F5F8FC] border-b border-[#DCE5F0] flex items-center justify-between text-xs">
        {status === 'updating' || isRefreshing ? (
          <div className="flex items-center gap-1.5 text-[#2457D6]">
            <span className="w-2 h-2 rounded-full bg-[#2457D6] animate-pulse"></span>
            <span className="font-medium">Summary updating...</span>
          </div>
        ) : status === 'failed' ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 text-rose-600">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Summary failed</span>
            </div>
            <button
              onClick={onRefresh}
              className="text-[#2457D6] hover:underline font-medium ml-2"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[#52657A]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Summary current</span>
          </div>
        )}
      </div>

      {/* Summary Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
        {!summary || (!summary.summary && summary.themes?.length === 0) ? (
          <div className="text-center py-8 text-xs text-[#52657A]">
            <p className="mb-2 font-medium text-[#12243A]">No summary yet</p>
            <p>Exchange a few messages with Gemini to automatically generate a concise synthesis of themes and decisions.</p>
          </div>
        ) : (
          <>
            {/* Overview */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#52657A] mb-2">
                Overview
              </h4>
              <p className="text-[#12243A] leading-relaxed text-sm bg-[#F5F8FC] p-3 rounded-[8px] border border-[#DCE5F0]">
                {summary.summary}
              </p>
            </div>

            {/* Key Themes */}
            {summary.themes && summary.themes.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#52657A] mb-2">
                  Key themes
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {summary.themes.map((theme, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-[#EAF1FF] text-[#2457D6] rounded-[6px] text-xs font-medium border border-[#DCE5F0]"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Decisions */}
            {summary.decisions && summary.decisions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#52657A] mb-2 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-[#2457D6]" />
                  <span>Decisions &amp; Directions</span>
                </h4>
                <ul className="space-y-1.5">
                  {summary.decisions.map((decision, i) => (
                    <li
                      key={i}
                      className="text-xs text-[#12243A] bg-[#FFFFFF] p-2 rounded-[6px] border border-[#DCE5F0] leading-normal"
                    >
                      {decision}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Unresolved Questions */}
            {summary.unresolvedQuestions && summary.unresolvedQuestions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#52657A] mb-2 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-[#52657A]" />
                  <span>Open questions</span>
                </h4>
                <ul className="space-y-1.5">
                  {summary.unresolvedQuestions.map((q, i) => (
                    <li
                      key={i}
                      className="text-xs text-[#52657A] bg-[#F5F8FC] p-2 rounded-[6px] border border-[#DCE5F0] leading-normal"
                    >
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
