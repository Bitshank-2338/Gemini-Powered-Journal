import React, { useState } from 'react';
import { 
  CheckSquare, 
  Square, 
  Calendar, 
  ArrowUpRight, 
  MessageSquare, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Menu,
  Clock,
  Sparkles
} from 'lucide-react';
import type { ActionStep, Conversation } from '../types';

interface NextStepsViewProps {
  actions: ActionStep[];
  conversations: Conversation[];
  onToggleComplete: (action: ActionStep) => Promise<void>;
  onDismissAction: (action: ActionStep) => Promise<void>;
  onDeleteAction: (id: string) => Promise<void>;
  onUpdateActionText: (id: string, newText: string, newDate?: string) => Promise<void>;
  onNavigateToConversation: (conversationId: string, draftPrompt?: string) => void;
  onOpenMobileSidebar: () => void;
}

export const NextStepsView: React.FC<NextStepsViewProps> = ({
  actions,
  conversations,
  onToggleComplete,
  onDismissAction,
  onDeleteAction,
  onUpdateActionText,
  onNavigateToConversation,
  onOpenMobileSidebar,
}) => {
  const [filter, setFilter] = useState<'open' | 'completed' | 'all'>('open');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState('');

  const filteredActions = actions.filter((act) => {
    if (filter === 'open') return act.status === 'open';
    if (filter === 'completed') return act.status === 'completed' || act.status === 'dismissed';
    return true;
  });

  const getConversationTitle = (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    return conv ? conv.title : 'Original reflection';
  };

  const startEdit = (action: ActionStep) => {
    setEditingId(action.id);
    setEditText(action.text);
    setEditDate(action.targetDate || '');
  };

  const saveEdit = async (action: ActionStep) => {
    if (!editText.trim()) return;
    await onUpdateActionText(action.id, editText.trim(), editDate || undefined);
    setEditingId(null);
  };

  const handleReflectOnThis = (action: ActionStep) => {
    const draftPrompt = `Reflecting on my next step: "${action.text}". What should I consider to make progress on this?`;
    onNavigateToConversation(action.sourceConversationId, draftPrompt);
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#F5F8FC] overflow-hidden">
      {/* Header */}
      <header className="h-16 px-4 md:px-6 bg-[#FFFFFF] border-b border-[#DCE5F0] flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            id="mobile-menu-btn-actions"
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 text-[#52657A] hover:text-[#12243A] hover:bg-[#F5F8FC] rounded-[8px]"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-base text-[#12243A]">Next steps</h1>
            <p className="text-xs text-[#52657A]">Grounding reflections into tangible progress</p>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center bg-[#F5F8FC] p-1 rounded-[8px] border border-[#DCE5F0]">
          <button
            id="filter-open-btn"
            onClick={() => setFilter('open')}
            className={`px-3 py-1 text-xs font-medium rounded-[6px] transition-colors ${
              filter === 'open'
                ? 'bg-[#FFFFFF] text-[#2457D6] shadow-xs'
                : 'text-[#52657A] hover:text-[#12243A]'
            }`}
          >
            Open ({actions.filter((a) => a.status === 'open').length})
          </button>
          <button
            id="filter-completed-btn"
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 text-xs font-medium rounded-[6px] transition-colors ${
              filter === 'completed'
                ? 'bg-[#FFFFFF] text-[#2457D6] shadow-xs'
                : 'text-[#52657A] hover:text-[#12243A]'
            }`}
          >
            Completed / Dismissed
          </button>
        </div>
      </header>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {filteredActions.length === 0 ? (
            <div className="text-center py-16 px-4 bg-[#FFFFFF] rounded-[12px] border border-[#DCE5F0]">
              <div className="w-12 h-12 rounded-[12px] bg-[#EAF1FF] text-[#2457D6] flex items-center justify-center mx-auto mb-3">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-medium text-[#12243A] mb-1">
                {filter === 'open' ? 'No open next steps' : 'No completed actions'}
              </h2>
              <p className="text-xs text-[#52657A] max-w-sm mx-auto">
                {filter === 'open'
                  ? 'Turn any conversation into concrete next steps using "Turn this into a next step" in your journal entries.'
                  : 'Actions you complete or dismiss will appear here for reference.'}
              </p>
            </div>
          ) : (
            filteredActions.map((action) => {
              const isCompleted = action.status === 'completed';
              const isDismissed = action.status === 'dismissed';
              const isEditing = editingId === action.id;

              return (
                <div
                  key={action.id}
                  id={`action-item-${action.id}`}
                  className={`bg-[#FFFFFF] border rounded-[12px] p-4 transition-all shadow-xs ${
                    isCompleted
                      ? 'border-[#DCE5F0] opacity-80'
                      : isDismissed
                      ? 'border-[#DCE5F0] opacity-60 bg-gray-50'
                      : 'border-[#DCE5F0] hover:border-[#2457D6]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Completion Toggle */}
                    <button
                      id={`toggle-action-${action.id}`}
                      onClick={() => onToggleComplete(action)}
                      className="mt-0.5 text-[#2457D6] hover:text-[#1D46AF] transition-colors flex-shrink-0"
                      title={isCompleted ? 'Mark as open' : 'Mark as completed'}
                    >
                      {isCompleted ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Square className="w-5 h-5 text-[#52657A] hover:text-[#2457D6]" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm bg-[#F5F8FC] border border-[#2457D6] rounded-[6px] text-[#12243A] focus:outline-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="px-2 py-1 text-xs bg-[#F5F8FC] border border-[#DCE5F0] rounded-[6px] text-[#12243A]"
                            />
                            <button
                              onClick={() => saveEdit(action)}
                              className="px-3 py-1 bg-[#2457D6] text-white text-xs font-medium rounded-[6px] flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2.5 py-1 text-xs text-[#52657A] hover:text-[#12243A]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p
                            className={`text-sm leading-snug ${
                              isCompleted
                                ? 'line-through text-[#52657A]'
                                : 'text-[#12243A] font-medium'
                            }`}
                          >
                            {action.text}
                          </p>

                          {/* Metadata row */}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#52657A]">
                            {action.targetDate && (
                              <span className="flex items-center gap-1 text-[#2457D6] bg-[#EAF1FF] px-2 py-0.5 rounded-[4px] font-medium">
                                <Calendar className="w-3 h-3" />
                                {action.targetDate}
                              </span>
                            )}

                            {/* Originating conversation link */}
                            <button
                              id={`origin-conv-link-${action.id}`}
                              onClick={() => onNavigateToConversation(action.sourceConversationId)}
                              className="hover:text-[#2457D6] hover:underline flex items-center gap-1 transition-colors"
                              title="Go to source conversation"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[180px]">
                                {getConversationTitle(action.sourceConversationId)}
                              </span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Action button menu */}
                    {!isEditing && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Reflect on this */}
                        <button
                          id={`reflect-on-action-${action.id}`}
                          onClick={() => handleReflectOnThis(action)}
                          className="px-2 py-1 text-xs font-medium text-[#2457D6] bg-[#EAF1FF] hover:bg-[#DCE5F0] rounded-[6px] transition-colors flex items-center gap-1"
                          title="Open reflection on this next step in source conversation"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Reflect on this</span>
                        </button>

                        <button
                          onClick={() => startEdit(action)}
                          className="p-1.5 text-[#52657A] hover:text-[#12243A] hover:bg-[#F5F8FC] rounded-[6px]"
                          title="Edit action"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {!isCompleted && !isDismissed && (
                          <button
                            onClick={() => onDismissAction(action)}
                            className="p-1.5 text-[#52657A] hover:text-amber-600 hover:bg-[#F5F8FC] rounded-[6px]"
                            title="Dismiss action"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => onDeleteAction(action.id)}
                          className="p-1.5 text-[#52657A] hover:text-rose-600 hover:bg-[#F5F8FC] rounded-[6px]"
                          title="Delete action permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
