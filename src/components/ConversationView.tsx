import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Sparkles, 
  PanelRight, 
  Menu, 
  Check, 
  Edit3, 
  AlertCircle, 
  RefreshCw, 
  Clock, 
  ArrowRight,
  ListTodo
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Conversation, Message } from '../types';

interface ConversationViewProps {
  conversation: Conversation;
  messages: Message[];
  persistenceStatus: 'saved' | 'saving' | 'error';
  persistenceError?: string;
  onSendMessage: (content: string) => Promise<void>;
  onRetryMessage: (message: Message) => Promise<void>;
  onRenameConversation: (newTitle: string) => Promise<void>;
  onOpenNextStepModal: () => void;
  onToggleSummary: () => void;
  isSummaryOpen: boolean;
  onOpenMobileSidebar: () => void;
  isGenerating: boolean;
  draftText?: string;
  onClearDraft?: () => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  conversation,
  messages,
  persistenceStatus,
  persistenceError,
  onSendMessage,
  onRetryMessage,
  onRenameConversation,
  onOpenNextStepModal,
  onToggleSummary,
  isSummaryOpen,
  onOpenMobileSidebar,
  isGenerating,
  draftText,
  onClearDraft,
}) => {
  const [inputText, setInputText] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(conversation.title);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft text if provided (e.g., from "Reflect on this")
  useEffect(() => {
    if (draftText) {
      setInputText(draftText);
      if (onClearDraft) onClearDraft();
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [draftText, onClearDraft]);

  // Sync title input with conversation
  useEffect(() => {
    setTitleInput(conversation.title);
  }, [conversation.title]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleTitleSubmit = async () => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput.trim() !== conversation.title) {
      await onRenameConversation(titleInput.trim());
    } else {
      setTitleInput(conversation.title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isGenerating) return;
    
    setInputText('');
    try {
      await onSendMessage(text);
    } catch (err) {
      // Restore input on failure so user does not lose thoughts
      setInputText(text);
    }
  };

  const handleStarterPrompt = (promptText: string) => {
    if (promptText === 'Start a blank conversation.') {
      if (textareaRef.current) textareaRef.current.focus();
      return;
    }
    setInputText(promptText);
    if (textareaRef.current) textareaRef.current.focus();
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#F5F8FC] overflow-hidden">
      {/* Top Conversation Header */}
      <header className="h-16 px-4 md:px-6 bg-[#FFFFFF] border-b border-[#DCE5F0] flex items-center justify-between gap-3 flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            id="mobile-menu-btn"
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 text-[#52657A] hover:text-[#12243A] hover:bg-[#F5F8FC] rounded-[8px]"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Editable Title */}
          <div className="min-w-0 max-w-md">
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  id="conversation-title-input"
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSubmit();
                    if (e.key === 'Escape') {
                      setTitleInput(conversation.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  maxLength={100}
                  className="px-2 py-1 text-sm font-semibold text-[#12243A] bg-[#F5F8FC] border border-[#2457D6] rounded-[6px] focus:outline-none w-full"
                />
                <button
                  onClick={handleTitleSubmit}
                  className="p-1 text-[#2457D6] hover:bg-[#EAF1FF] rounded-[6px]"
                  title="Save title"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingTitle(true)}
                className="group flex items-center gap-2 cursor-pointer py-1 px-1.5 rounded-[6px] hover:bg-[#F5F8FC]"
                title="Click to rename"
              >
                <h1 className="font-semibold text-sm md:text-base text-[#12243A] truncate">
                  {conversation.title || 'Untitled reflection'}
                </h1>
                <Edit3 className="w-3.5 h-3.5 text-[#52657A] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            )}
          </div>

          {/* Persistence status indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#52657A] border-l border-[#DCE5F0] pl-3">
            {persistenceStatus === 'saving' ? (
              <span className="text-[#2457D6] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2457D6] animate-pulse"></span>
                Saving...
              </span>
            ) : persistenceStatus === 'error' ? (
              <span className="text-rose-600 flex items-center gap-1" title={persistenceError}>
                <AlertCircle className="w-3.5 h-3.5" />
                Save error
              </span>
            ) : (
              <span className="text-emerald-700 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" />
                Saved
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Turn into next step */}
          <button
            id="turn-into-next-step-btn"
            onClick={onOpenNextStepModal}
            disabled={messages.length === 0 || isGenerating}
            className="px-3 py-1.5 bg-[#EAF1FF] hover:bg-[#DCE5F0] text-[#2457D6] font-medium text-xs rounded-[8px] transition-colors flex items-center gap-1.5 disabled:opacity-40"
            title="Extract actionable next steps with Gemini"
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Turn this into a next step</span>
            <span className="sm:hidden">Next step</span>
          </button>

          {/* Summary toggle */}
          <button
            id="toggle-summary-btn"
            onClick={onToggleSummary}
            className={`p-2 rounded-[8px] border transition-colors ${
              isSummaryOpen
                ? 'bg-[#EAF1FF] border-[#2457D6] text-[#2457D6]'
                : 'bg-[#FFFFFF] border-[#DCE5F0] text-[#52657A] hover:text-[#12243A]'
            }`}
            title="Toggle summary panel"
            aria-label="Toggle summary panel"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Messages Stream Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        <div className="max-w-3xl mx-auto w-full space-y-5">
          {messages.length === 0 ? (
            /* First Sign-in Empty State */
            <div className="py-12 md:py-16 text-center max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-[12px] bg-[#EAF1FF] text-[#2457D6] flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-[#12243A] mb-2">
                Your first conversation starts here.
              </h2>
              <p className="text-sm text-[#52657A] mb-8 leading-relaxed">
                Choose a reflection prompt below or write what is on your mind. Everything is kept strictly private.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {[
                  { title: 'Reflect on my day.', desc: 'Review key moments, gratitudes, and energy shifts.' },
                  { title: 'Explore an idea.', desc: 'Flesh out a creative thought or project concept.' },
                  { title: 'Think through a decision.', desc: 'Weigh tradeoffs and clarify personal priorities.' },
                  { title: 'Start a blank conversation.', desc: 'Write freely about whatever is on your mind.' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    id={`starter-prompt-${idx}`}
                    onClick={() => handleStarterPrompt(item.title)}
                    className="p-4 bg-[#FFFFFF] hover:bg-[#EAF1FF] border border-[#DCE5F0] hover:border-[#2457D6] rounded-[12px] transition-all group cursor-pointer text-left shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-[#12243A] group-hover:text-[#2457D6]">
                        {item.title}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#52657A] group-hover:text-[#2457D6] transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <p className="text-xs text-[#52657A]">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message turns */
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  id={`message-${msg.id}`}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[82%] rounded-[12px] p-4 shadow-xs text-sm ${
                      isUser
                        ? 'bg-[#FFFFFF] border border-[#DCE5F0] text-[#12243A]'
                        : 'bg-[#FFFFFF] border border-[#DCE5F0] text-[#12243A]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-[#F0F4F8] text-[11px] text-[#52657A]">
                      <span className="font-semibold uppercase tracking-wider">
                        {isUser ? 'You' : 'Journal Companion'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {isUser ? (
                      <div className="whitespace-pre-wrap leading-relaxed text-[#12243A]">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="markdown-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}

                    {/* Status / Error display */}
                    {msg.status === 'error' && (
                      <div className="mt-2 pt-2 border-t border-rose-100 flex items-center justify-between text-xs text-rose-600">
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {msg.errorDetails || 'Failed to generate assistant response'}
                        </span>
                        <button
                          onClick={() => onRetryMessage(msg)}
                          className="font-medium underline hover:text-rose-800 ml-2"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Assistant Generation State */}
          {isGenerating && (
            <div className="flex flex-col items-start">
              <div className="bg-[#FFFFFF] border border-[#DCE5F0] rounded-[12px] p-4 shadow-xs text-sm max-w-[82%]">
                <div className="flex items-center gap-2 text-xs text-[#2457D6] font-medium mb-1">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Reflecting...</span>
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <div className="w-2 h-2 rounded-full bg-[#2457D6] animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-[#2457D6] animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 rounded-full bg-[#2457D6] animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Composer Section */}
      <div className="p-3 md:p-4 bg-[#FFFFFF] border-t border-[#DCE5F0] flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 bg-[#F5F8FC] border border-[#DCE5F0] focus-within:border-[#2457D6] rounded-[12px] p-2 transition-colors">
            <textarea
              id="message-composer-textarea"
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a reflection or brainstorm an idea..."
              disabled={isGenerating}
              className="flex-1 bg-transparent border-0 resize-none text-sm text-[#12243A] placeholder-[#52657A] focus:outline-none p-1.5 max-h-36 disabled:opacity-50"
            />
            <button
              id="send-message-btn"
              onClick={handleSend}
              disabled={!inputText.trim() || isGenerating}
              className="w-9 h-9 flex items-center justify-center bg-[#2457D6] hover:bg-[#1D46AF] text-white rounded-[8px] transition-colors disabled:opacity-40 flex-shrink-0"
              aria-label="Send message"
              title="Send message (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-1.5 px-1 flex items-center justify-between text-[11px] text-[#52657A]">
            <span>Press Enter to send, Shift+Enter for newline</span>
            <span>Private &bull; Gemini-assisted</span>
          </div>
        </div>
      </div>
    </div>
  );
};
