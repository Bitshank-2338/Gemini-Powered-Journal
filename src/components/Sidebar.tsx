import React from 'react';
import { Plus, BookOpen, CheckSquare, Trash2, LogOut, X } from 'lucide-react';
import type { Conversation, UserProfile, ActiveTab } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRequestDeleteConversation: (conv: Conversation) => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  openActionsCount: number;
  user: UserProfile;
  onSignOut: () => void;
  onCloseMobileSidebar?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRequestDeleteConversation,
  activeTab,
  onSelectTab,
  openActionsCount,
  user,
  onSignOut,
  onCloseMobileSidebar,
}) => {
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch {
      return '';
    }
  };

  return (
    <aside className="w-72 h-full bg-[#FFFFFF] border-r border-[#DCE5F0] flex flex-col justify-between flex-shrink-0 select-none">
      {/* Top Header & Actions */}
      <div className="p-4 border-b border-[#DCE5F0]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#2457D6] flex items-center justify-center text-white font-semibold text-sm">
              D
            </div>
            <div>
              <h2 className="font-semibold text-sm tracking-tight text-[#12243A]">DAYNOTE</h2>
              <p className="text-[11px] text-[#52657A]">Personal Gemini Journal</p>
            </div>
          </div>
          {onCloseMobileSidebar && (
            <button
              id="sidebar-close-btn"
              onClick={onCloseMobileSidebar}
              className="lg:hidden p-1.5 text-[#52657A] hover:text-[#12243A] hover:bg-[#F5F8FC] rounded-[8px]"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Primary New Conversation CTA */}
        <button
          id="new-conversation-btn"
          onClick={() => {
            onNewConversation();
            if (onCloseMobileSidebar) onCloseMobileSidebar();
          }}
          className="w-full py-2.5 px-3.5 bg-[#2457D6] hover:bg-[#1D46AF] text-white font-medium text-sm rounded-[8px] transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New conversation</span>
        </button>

        {/* Navigation Tabs */}
        <div className="mt-3 flex gap-1 bg-[#F5F8FC] p-1 rounded-[8px] border border-[#DCE5F0]">
          <button
            id="tab-journal-btn"
            onClick={() => {
              onSelectTab('journal');
              if (onCloseMobileSidebar) onCloseMobileSidebar();
            }}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-[6px] transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'journal'
                ? 'bg-[#FFFFFF] text-[#2457D6] shadow-xs'
                : 'text-[#52657A] hover:text-[#12243A]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Journal</span>
          </button>
          <button
            id="tab-actions-btn"
            onClick={() => {
              onSelectTab('actions');
              if (onCloseMobileSidebar) onCloseMobileSidebar();
            }}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-[6px] transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'actions'
                ? 'bg-[#FFFFFF] text-[#2457D6] shadow-xs'
                : 'text-[#52657A] hover:text-[#12243A]'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Next steps</span>
            {openActionsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-[#2457D6] text-white text-[10px] rounded-full font-semibold">
                {openActionsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs font-medium text-[#52657A] uppercase tracking-wider">
            Conversations
          </span>
          <span className="text-[11px] text-[#52657A]">
            {conversations.length} {conversations.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {conversations.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#52657A] bg-[#F5F8FC] rounded-[8px] border border-[#DCE5F0]">
            No conversations yet. Start your first reflection above.
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((conv) => {
              const isActive = activeTab === 'journal' && activeConversationId === conv.id;
              return (
                <div
                  key={conv.id}
                  id={`conv-item-${conv.id}`}
                  onClick={() => {
                    onSelectTab('journal');
                    onSelectConversation(conv.id);
                    if (onCloseMobileSidebar) onCloseMobileSidebar();
                  }}
                  className={`group relative flex items-center justify-between w-full px-3 py-2.5 rounded-[8px] text-left text-sm cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-[#EAF1FF] text-[#2457D6] font-medium border border-[#DCE5F0]'
                      : 'text-[#12243A] hover:bg-[#F5F8FC]'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="truncate text-sm font-medium leading-tight">
                      {conv.title || 'Untitled reflection'}
                    </p>
                    <p className="text-[11px] text-[#52657A] truncate mt-0.5">
                      {formatTime(conv.updatedAt)}
                    </p>
                  </div>

                  <button
                    id={`delete-conv-btn-${conv.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestDeleteConversation(conv);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#52657A] hover:text-rose-600 hover:bg-white rounded transition-opacity"
                    aria-label={`Delete ${conv.title}`}
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Account Info & Sign Out Footer */}
      <div className="p-3 border-t border-[#DCE5F0] bg-[#FFFFFF]">
        <div className="flex items-center justify-between p-2 rounded-[8px] bg-[#F5F8FC] border border-[#DCE5F0]">
          <div className="flex items-center gap-2.5 min-w-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-[#DCE5F0] object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#EAF1FF] text-[#2457D6] flex items-center justify-center font-medium text-xs flex-shrink-0">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#12243A] truncate leading-tight">
                {user.displayName || 'Signed In'}
              </p>
              <p className="text-[11px] text-[#52657A] truncate leading-tight">
                {user.email}
              </p>
            </div>
          </div>
          <button
            id="signout-btn"
            onClick={onSignOut}
            className="p-1.5 text-[#52657A] hover:text-[#12243A] hover:bg-[#FFFFFF] rounded-[6px] transition-colors flex-shrink-0"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
