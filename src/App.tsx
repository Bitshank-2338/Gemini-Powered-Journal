import React, { useState, useEffect, useCallback } from 'react';
import { onAuthChange, signOutUser } from './firebase';
import type { 
  UserProfile, 
  Conversation, 
  Message, 
  Summary, 
  ActionStep, 
  ActionSuggestion, 
  ActiveTab 
} from './types';
import { 
  fetchConversations, 
  createConversation, 
  getConversation, 
  renameConversation, 
  deleteConversation, 
  sendMessage, 
  refreshSummary, 
  requestNextStepSuggestions, 
  fetchActions, 
  saveAction, 
  updateAction, 
  deleteAction 
} from './services/api';
import { LandingPage } from './components/LandingPage';
import { Sidebar } from './components/Sidebar';
import { ConversationView } from './components/ConversationView';
import { SummaryPanel } from './components/SummaryPanel';
import { NextStepsView } from './components/NextStepsView';
import { NextStepModal } from './components/NextStepModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';

export default function App() {
  // Auth state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App navigation state
  const [activeTab, setActiveTab] = useState<ActiveTab>('journal');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);

  // Journal state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Status & loading states
  const [persistenceStatus, setPersistenceStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [persistenceError, setPersistenceError] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshingSummary, setIsRefreshingSummary] = useState(false);

  // Next steps state
  const [actions, setActions] = useState<ActionStep[]>([]);
  const [draftPrompt, setDraftPrompt] = useState<string | undefined>();

  // Modals state
  const [nextStepModalOpen, setNextStepModalOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ActionSuggestion[]>([]);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [convToDelete, setConvToDelete] = useState<Conversation | null>(null);
  const [isDeletingConv, setIsDeletingConv] = useState(false);

  // 1. Auth Subscription & State Cleansing
  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        // Clear all sensitive data and active conversational context on sign-out
        setUser(null);
        setConversations([]);
        setActiveConversation(null);
        setMessages([]);
        setSummary(null);
        setActions([]);
        setDraftPrompt(undefined);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Load User Data when Signed In
  const loadUserData = useCallback(async () => {
    if (!user) return;
    try {
      const [loadedConvs, loadedActions] = await Promise.all([
        fetchConversations(),
        fetchActions(),
      ]);
      setConversations(loadedConvs);
      setActions(loadedActions);

      if (loadedConvs.length > 0) {
        // Load the most recently updated conversation
        loadConversationDetails(loadedConvs[0].id);
      } else {
        // Fresh sign-in: create initial empty conversation
        createNewConversation();
      }
    } catch (err: any) {
      console.error('Error loading initial user data:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user, loadUserData]);

  // 3. Load Conversation Details
  const loadConversationDetails = async (convId: string) => {
    try {
      setPersistenceStatus('saved');
      setPersistenceError(undefined);
      const data = await getConversation(convId);
      setActiveConversation(data.conversation);
      setMessages(data.messages);
      setSummary(data.summary);
    } catch (err: any) {
      console.error('Error loading conversation:', err);
      setPersistenceStatus('error');
      setPersistenceError(err.message);
    }
  };

  // 4. Create New Conversation
  const createNewConversation = async (starterPrompt?: string) => {
    const newId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const title = starterPrompt ? starterPrompt.slice(0, 40) : 'Untitled reflection';

    try {
      setPersistenceStatus('saving');
      const newConv = await createConversation(newId, title, starterPrompt);
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversation(newConv);

      if (starterPrompt) {
        setMessages([]);
        setSummary(null);
        // Trigger initial message and assistant reply
        handleSendMessageToConv(newConv.id, starterPrompt);
      } else {
        setMessages([]);
        setSummary(null);
        setPersistenceStatus('saved');
      }
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
      setPersistenceStatus('error');
      setPersistenceError(err.message);
    }
  };

  // 5. Send Message to Conversation
  const handleSendMessageToConv = async (convId: string, content: string, retryMsgId?: string) => {
    const msgId = retryMsgId || `msg_user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // If not a retry, optimistically add to messages
    if (!retryMsgId) {
      const pendingMsg: Message = {
        id: msgId,
        conversationId: convId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
        status: 'saved',
      };
      setMessages((prev) => [...prev, pendingMsg]);
    }

    setPersistenceStatus('saving');
    setIsGenerating(true);

    try {
      const result = await sendMessage(convId, msgId, content, !!retryMsgId);
      
      // Append assistant message
      setMessages((prev) => {
        const updated = prev.map((m) => (m.id === msgId ? result.userMessage : m));
        return [...updated, result.assistantMessage];
      });

      setPersistenceStatus('saved');

      // Update conversation in sidebar
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, updatedAt: new Date().toISOString(), revision: result.revision, lastMessageSnippet: content.slice(0, 80) }
            : c
        ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );

      // Trigger summary refresh
      handleRefreshSummary(convId);
    } catch (err: any) {
      console.error('Send message failed:', err);
      setPersistenceStatus('error');
      setPersistenceError(err.message);

      // Mark the message with honest error status
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, status: 'error', errorDetails: err.message || 'Gemini service error' }
            : m
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!activeConversation) return;
    await handleSendMessageToConv(activeConversation.id, content);
  };

  const handleRetryMessage = async (message: Message) => {
    if (!activeConversation) return;
    await handleSendMessageToConv(activeConversation.id, message.content, message.id);
  };

  // 6. Rename Conversation
  const handleRenameConversation = async (newTitle: string) => {
    if (!activeConversation) return;
    try {
      await renameConversation(activeConversation.id, newTitle);
      setActiveConversation((prev) => (prev ? { ...prev, title: newTitle } : null));
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, title: newTitle } : c))
      );
    } catch (err: any) {
      console.error('Rename conversation failed:', err);
    }
  };

  // 7. Delete Conversation & Cascade
  const handleRequestDeleteConversation = (conv: Conversation) => {
    setConvToDelete(conv);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!convToDelete) return;
    setIsDeletingConv(true);
    try {
      await deleteConversation(convToDelete.id);
      
      const remaining = conversations.filter((c) => c.id !== convToDelete.id);
      setConversations(remaining);

      // Also remove local actions linked to deleted conversation
      setActions((prev) => prev.filter((a) => a.sourceConversationId !== convToDelete.id));

      if (activeConversation?.id === convToDelete.id) {
        if (remaining.length > 0) {
          loadConversationDetails(remaining[0].id);
        } else {
          createNewConversation();
        }
      }

      setDeleteModalOpen(false);
      setConvToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete conversation:', err);
    } finally {
      setIsDeletingConv(false);
    }
  };

  // 8. Refresh Summary
  const handleRefreshSummary = async (convId?: string) => {
    const targetId = convId || activeConversation?.id;
    if (!targetId) return;

    setIsRefreshingSummary(true);
    try {
      const updatedSummary = await refreshSummary(targetId);
      if (activeConversation?.id === targetId) {
        setSummary(updatedSummary);
      }
    } catch (err: any) {
      console.warn('Summary refresh error:', err);
      if (activeConversation?.id === targetId) {
        setSummary((prev) =>
          prev
            ? { ...prev, status: 'failed', error: err.message }
            : {
                conversationId: targetId,
                revision: 1,
                summary: '',
                themes: [],
                decisions: [],
                unresolvedQuestions: [],
                updatedAt: new Date().toISOString(),
                status: 'failed',
                error: err.message,
              }
        );
      }
    } finally {
      setIsRefreshingSummary(false);
    }
  };

  // 9. "Turn this into a next step" flow
  const handleOpenNextStepModal = async () => {
    if (!activeConversation || messages.length === 0) return;
    setNextStepModalOpen(true);
    setSuggestionsLoading(true);
    setSuggestionsError(null);

    try {
      const rawSuggestions = await requestNextStepSuggestions(activeConversation.id);
      setSuggestions(
        rawSuggestions.map((s, idx) => ({
          tempId: `sug_${idx}_${Date.now()}`,
          text: s.text,
          targetDate: s.targetDate,
          supportingMessageId: s.supportingMessageId,
          selected: true, // Default to selected for review
        }))
      );
    } catch (err: any) {
      setSuggestionsError(err.message || 'Failed to extract next steps.');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleSaveConfirmedActions = async () => {
    if (!activeConversation) return;
    const selected = suggestions.filter((s) => s.selected && s.text.trim());
    if (selected.length === 0) return;

    try {
      const savedSteps: ActionStep[] = [];
      for (const item of selected) {
        const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const saved = await saveAction({
          id: actionId,
          text: item.text.trim(),
          targetDate: item.targetDate,
          status: 'open',
          sourceConversationId: activeConversation.id,
          supportingMessageId: item.supportingMessageId,
        });
        savedSteps.push(saved);
      }

      setActions((prev) => [...savedSteps, ...prev]);
      setNextStepModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save actions:', err);
      setSuggestionsError(`Failed to save action: ${err.message}`);
    }
  };

  // 10. Next Steps View Handlers
  const handleToggleActionComplete = async (action: ActionStep) => {
    const newStatus = action.status === 'completed' ? 'open' : 'completed';
    try {
      const updated = await updateAction(action.id, { status: newStatus });
      setActions((prev) => prev.map((a) => (a.id === action.id ? updated : a)));
    } catch (err) {
      console.error('Failed to update action status:', err);
    }
  };

  const handleDismissAction = async (action: ActionStep) => {
    try {
      const updated = await updateAction(action.id, { status: 'dismissed' });
      setActions((prev) => prev.map((a) => (a.id === action.id ? updated : a)));
    } catch (err) {
      console.error('Failed to dismiss action:', err);
    }
  };

  const handleDeleteAction = async (id: string) => {
    try {
      await deleteAction(id);
      setActions((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to delete action:', err);
    }
  };

  const handleUpdateActionText = async (id: string, newText: string, newDate?: string) => {
    try {
      const updated = await updateAction(id, { text: newText, targetDate: newDate });
      setActions((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      console.error('Failed to update action text:', err);
    }
  };

  const handleNavigateToConversation = (convId: string, draft?: string) => {
    setActiveTab('journal');
    loadConversationDetails(convId);
    if (draft) {
      setDraftPrompt(draft);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    await signOutUser();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F8FC]">
        <div className="w-8 h-8 rounded-full border-2 border-[#2457D6] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onSignInSuccess={() => {}} />;
  }

  const openActionsCount = actions.filter((a) => a.status === 'open').length;

  return (
    <div className="flex h-screen w-screen bg-[#F5F8FC] text-[#12243A] overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-full">
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversation?.id || null}
          onSelectConversation={(id) => loadConversationDetails(id)}
          onNewConversation={() => createNewConversation()}
          onRequestDeleteConversation={handleRequestDeleteConversation}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          openActionsCount={openActionsCount}
          user={user}
          onSignOut={handleSignOut}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 h-full bg-white shadow-xl">
            <Sidebar
              conversations={conversations}
              activeConversationId={activeConversation?.id || null}
              onSelectConversation={(id) => loadConversationDetails(id)}
              onNewConversation={() => createNewConversation()}
              onRequestDeleteConversation={handleRequestDeleteConversation}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              openActionsCount={openActionsCount}
              user={user}
              onSignOut={handleSignOut}
              onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 h-full flex overflow-hidden">
        {activeTab === 'journal' ? (
          activeConversation ? (
            <>
              <ConversationView
                conversation={activeConversation}
                messages={messages}
                persistenceStatus={persistenceStatus}
                persistenceError={persistenceError}
                onSendMessage={handleSendMessage}
                onRetryMessage={handleRetryMessage}
                onRenameConversation={handleRenameConversation}
                onOpenNextStepModal={handleOpenNextStepModal}
                onToggleSummary={() => setIsSummaryOpen((prev) => !prev)}
                isSummaryOpen={isSummaryOpen}
                onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
                isGenerating={isGenerating}
                draftText={draftPrompt}
                onClearDraft={() => setDraftPrompt(undefined)}
              />

              {/* Desktop Collapsible Summary Panel */}
              {isSummaryOpen && (
                <div className="hidden xl:block h-full">
                  <SummaryPanel
                    summary={summary}
                    onRefresh={() => handleRefreshSummary()}
                    onClose={() => setIsSummaryOpen(false)}
                    isRefreshing={isRefreshingSummary}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[#52657A]">
              Select or create a conversation to begin.
            </div>
          )
        ) : (
          <NextStepsView
            actions={actions}
            conversations={conversations}
            onToggleComplete={handleToggleActionComplete}
            onDismissAction={handleDismissAction}
            onDeleteAction={handleDeleteAction}
            onUpdateActionText={handleUpdateActionText}
            onNavigateToConversation={handleNavigateToConversation}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          />
        )}
      </div>

      {/* Modals */}
      <NextStepModal
        isOpen={nextStepModalOpen}
        isLoading={suggestionsLoading}
        error={suggestionsError}
        suggestions={suggestions}
        onToggleSelect={(tempId) =>
          setSuggestions((prev) =>
            prev.map((s) => (s.tempId === tempId ? { ...s, selected: !s.selected } : s))
          )
        }
        onUpdateSuggestionText={(tempId, text) =>
          setSuggestions((prev) =>
            prev.map((s) => (s.tempId === tempId ? { ...s, text } : s))
          )
        }
        onUpdateSuggestionDate={(tempId, date) =>
          setSuggestions((prev) =>
            prev.map((s) => (s.tempId === tempId ? { ...s, targetDate: date } : s))
          )
        }
        onSaveConfirmed={handleSaveConfirmedActions}
        onClose={() => setNextStepModalOpen(false)}
        onRetry={handleOpenNextStepModal}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        conversation={convToDelete}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setDeleteModalOpen(false);
          setConvToDelete(null);
        }}
        isDeleting={isDeletingConv}
      />
    </div>
  );
}
