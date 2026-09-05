import React, { useState } from 'react';
import { Sparkles, X, CheckSquare, Square, Calendar, Plus, AlertCircle } from 'lucide-react';
import type { ActionSuggestion } from '../types';

interface NextStepModalProps {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  suggestions: ActionSuggestion[];
  onToggleSelect: (tempId: string) => void;
  onUpdateSuggestionText: (tempId: string, text: string) => void;
  onUpdateSuggestionDate: (tempId: string, date: string) => void;
  onSaveConfirmed: () => Promise<void>;
  onClose: () => void;
  onRetry: () => void;
}

export const NextStepModal: React.FC<NextStepModalProps> = ({
  isOpen,
  isLoading,
  error,
  suggestions,
  onToggleSelect,
  onUpdateSuggestionText,
  onUpdateSuggestionDate,
  onSaveConfirmed,
  onClose,
  onRetry,
}) => {
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const selectedCount = suggestions.filter((s) => s.selected).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveConfirmed();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border border-[#DCE5F0] rounded-[12px] shadow-lg max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#DCE5F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] bg-[#EAF1FF] text-[#2457D6] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#12243A]">Turn this into a next step</h3>
              <p className="text-xs text-[#52657A]">
                Gemini suggestions grounded in your conversation
              </p>
            </div>
          </div>
          <button
            id="modal-close-btn"
            onClick={onClose}
            className="p-1.5 text-[#52657A] hover:text-[#12243A] hover:bg-[#F5F8FC] rounded-[6px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-[#2457D6] border-t-transparent animate-spin mx-auto mb-3"></div>
              <p className="text-sm font-medium text-[#12243A]">Extracting next steps...</p>
              <p className="text-xs text-[#52657A] mt-1">Analyzing key reflections and decisions</p>
            </div>
          ) : error ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-sm text-rose-700 font-medium">{error}</p>
              <button
                id="modal-retry-btn"
                onClick={onRetry}
                className="px-4 py-2 bg-[#2457D6] text-white text-xs font-medium rounded-[8px] hover:bg-[#1D46AF]"
              >
                Retry generation
              </button>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#52657A]">
              No actionable next steps found in this conversation yet.
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#52657A]">
                Select and edit the steps you want to commit to. Nothing is saved without your explicit confirmation.
              </p>

              {suggestions.map((item) => (
                <div
                  key={item.tempId}
                  id={`suggestion-${item.tempId}`}
                  className={`p-3 rounded-[8px] border transition-all ${
                    item.selected
                      ? 'border-[#2457D6] bg-[#F8FAFD]'
                      : 'border-[#DCE5F0] bg-[#FFFFFF] opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      onClick={() => onToggleSelect(item.tempId)}
                      className="mt-1 text-[#2457D6] hover:text-[#1D46AF] flex-shrink-0"
                    >
                      {item.selected ? (
                        <CheckSquare className="w-4 h-4 text-[#2457D6]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#52657A]" />
                      )}
                    </button>

                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => onUpdateSuggestionText(item.tempId, e.target.value)}
                        placeholder="Action description..."
                        className="w-full text-sm font-medium text-[#12243A] bg-transparent border-0 border-b border-transparent focus:border-[#2457D6] focus:outline-none py-0.5"
                      />

                      <div className="flex items-center gap-2 text-xs text-[#52657A]">
                        <Calendar className="w-3.5 h-3.5 text-[#52657A]" />
                        <input
                          type="date"
                          value={item.targetDate || ''}
                          onChange={(e) => onUpdateSuggestionDate(item.tempId, e.target.value)}
                          className="bg-transparent border border-[#DCE5F0] rounded-[4px] px-1.5 py-0.5 text-xs text-[#12243A]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#DCE5F0] bg-[#F5F8FC] flex items-center justify-between">
          <span className="text-xs text-[#52657A]">
            {selectedCount} of {suggestions.length} selected
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-[#52657A] hover:text-[#12243A] rounded-[8px]"
            >
              Cancel
            </button>
            <button
              id="save-selected-actions-btn"
              onClick={handleSave}
              disabled={selectedCount === 0 || saving || isLoading}
              className="px-4 py-2 text-xs font-medium bg-[#2457D6] hover:bg-[#1D46AF] text-white rounded-[8px] transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-xs"
            >
              {saving ? 'Saving...' : `Save ${selectedCount} action${selectedCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
