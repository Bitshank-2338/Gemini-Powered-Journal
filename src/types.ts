export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  lastMessageSnippet?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  status?: 'sending' | 'saved' | 'error';
  errorDetails?: string;
}

export interface Summary {
  conversationId: string;
  revision: number;
  summary: string;
  themes: string[];
  decisions: string[];
  unresolvedQuestions: string[];
  updatedAt: string;
  status: 'updating' | 'current' | 'failed';
  error?: string;
}

export type ActionStatus = 'open' | 'completed' | 'dismissed';

export interface ActionStep {
  id: string;
  text: string;
  targetDate?: string;
  status: ActionStatus;
  sourceConversationId: string;
  supportingMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionSuggestion {
  tempId: string;
  text: string;
  targetDate?: string;
  supportingMessageId?: string;
  selected: boolean;
}

export type ActiveTab = 'journal' | 'actions';
