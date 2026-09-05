import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  writeBatch,
  where
} from 'firebase/firestore';
import { db, auth, getCurrentIdToken, handleFirestoreError, OperationType } from '../firebase';
import type { Conversation, Message, Summary, ActionStep, ActionSuggestion } from '../types';

export async function fetchConversations(): Promise<Conversation[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const path = `users/${uid}/conversations`;
  try {
    const q = query(collection(db, 'users', uid, 'conversations'), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as Conversation));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createConversation(
  id: string, 
  title: string, 
  starterPrompt?: string
): Promise<Conversation> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const path = `users/${uid}/conversations/${id}`;
  const now = new Date().toISOString();
  const convData: Conversation = {
    id,
    title: title.trim().slice(0, 200),
    createdAt: now,
    updatedAt: now,
    lastMessageSnippet: starterPrompt ? starterPrompt.slice(0, 80) : '',
    revision: 1,
  };

  try {
    await setDoc(doc(db, 'users', uid, 'conversations', id), convData);
    return convData;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getConversation(id: string): Promise<{
  conversation: Conversation;
  messages: Message[];
  summary: Summary | null;
}> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const path = `users/${uid}/conversations/${id}`;
  try {
    const convDoc = await getDoc(doc(db, 'users', uid, 'conversations', id));
    if (!convDoc.exists()) {
      throw new Error('Conversation not found');
    }

    const conversation = { id: convDoc.id, ...convDoc.data() } as Conversation;

    // Fetch messages
    const msgsQuery = query(
      collection(db, 'users', uid, 'conversations', id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const msgsSnap = await getDocs(msgsQuery);
    const messages = msgsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));

    // Fetch summary
    const summaryDoc = await getDoc(doc(db, 'users', uid, 'conversations', id, 'summaries', 'latest'));
    const summary = summaryDoc.exists()
      ? ({
          conversationId: id,
          revision: 1,
          summary: '',
          themes: [],
          decisions: [],
          unresolvedQuestions: [],
          status: 'current',
          updatedAt: new Date().toISOString(),
          ...summaryDoc.data(),
        } as Summary)
      : null;

    return { conversation, messages, summary };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const path = `users/${uid}/conversations/${id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'conversations', id), {
      title: title.trim().slice(0, 200),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteConversation(id: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const path = `users/${uid}/conversations/${id}`;
  try {
    const batch = writeBatch(db);

    // Delete messages
    const msgsSnap = await getDocs(collection(db, 'users', uid, 'conversations', id, 'messages'));
    msgsSnap.docs.forEach((d) => batch.delete(d.ref));

    // Delete summaries
    const summariesSnap = await getDocs(collection(db, 'users', uid, 'conversations', id, 'summaries'));
    summariesSnap.docs.forEach((d) => batch.delete(d.ref));

    // Delete conversation
    batch.delete(doc(db, 'users', uid, 'conversations', id));

    // Delete linked action steps
    const actionsQuery = query(
      collection(db, 'users', uid, 'actions'),
      where('sourceConversationId', '==', id)
    );
    const actionsSnap = await getDocs(actionsQuery);
    actionsSnap.docs.forEach((d) => batch.delete(d.ref));

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

async function parseJsonResponse<T = any>(res: Response, fallbackErrorMessage: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    let errorMsg = `${fallbackErrorMessage} (${res.status})`;
    if (isJson) {
      try {
        const errBody = await res.json();
        errorMsg = errBody.error || errBody.details || errorMsg;
      } catch {
        // ignore parse failure
      }
    } else {
      const text = await res.text().catch(() => '');
      if (text && !text.includes('<!doctype') && !text.includes('<html')) {
        errorMsg = text.slice(0, 200);
      }
    }
    throw new Error(errorMsg);
  }

  if (!isJson) {
    const text = await res.text().catch(() => '');
    if (text.includes('<!doctype') || text.includes('<html')) {
      throw new Error('Received unexpected HTML response from server.');
    }
    throw new Error(`Unexpected non-JSON response: ${text.slice(0, 100)}`);
  }

  return await res.json();
}

export async function sendMessage(
  conversationId: string,
  messageId: string,
  content: string,
  retry?: boolean
): Promise<{
  userMessage: Message;
  assistantMessage: Message;
  revision: number;
}> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const token = await getCurrentIdToken();
  if (!token) {
    throw new Error('Authentication token unavailable. Please sign in.');
  }

  const userMsgId = messageId || `user_${Date.now()}`;
  const now = new Date().toISOString();
  const userMessageData: Message = {
    id: userMsgId,
    conversationId,
    role: 'user',
    content: content.trim(),
    createdAt: now,
    status: 'saved',
  };

  const userMsgPath = `users/${uid}/conversations/${conversationId}/messages/${userMsgId}`;
  try {
    // 1. Persist user message first (Ensures zero data loss)
    await setDoc(doc(db, 'users', uid, 'conversations', conversationId, 'messages', userMsgId), userMessageData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, userMsgPath);
  }

  // 2. Fetch messages history for Gemini context
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let currentRevision = 1;
  try {
    const convDoc = await getDoc(doc(db, 'users', uid, 'conversations', conversationId));
    if (convDoc.exists()) {
      currentRevision = convDoc.data().revision || 1;
    }
    const msgsSnap = await getDocs(
      query(collection(db, 'users', uid, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'))
    );
    history = msgsSnap.docs.map((d) => {
      const data = d.data();
      return {
        role: data.role === 'assistant' ? 'assistant' : 'user',
        content: String(data.content || ''),
      };
    });
  } catch (err) {
    console.warn('Failed to load history for AI context:', err);
  }

  // 3. Call backend Gemini AI endpoint
  let replyText = '';
  try {
    const aiRes = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversationId,
        history: history.filter((h) => h.content !== content.trim()), // previous history
        userMessage: content.trim(),
      }),
    });

    const aiData = await parseJsonResponse<{ reply?: string }>(aiRes, 'AI chat service error');
    replyText = aiData.reply || 'Thank you for sharing your reflection.';
  } catch (aiErr: any) {
    console.error('Gemini call failed:', aiErr);
    // User message is preserved in Firestore
    throw new Error(`AI response failed: ${aiErr.message}. Your journal entry is safely saved.`);
  }

  // 4. Persist assistant message in Firestore
  const asstMsgId = `asst_${Date.now()}`;
  const assistantMsgData: Message = {
    id: asstMsgId,
    conversationId,
    role: 'assistant',
    content: replyText,
    createdAt: new Date().toISOString(),
    status: 'saved',
  };

  const newRevision = currentRevision + 1;
  const asstPath = `users/${uid}/conversations/${conversationId}/messages/${asstMsgId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'conversations', conversationId, 'messages', asstMsgId), assistantMsgData);
    await updateDoc(doc(db, 'users', uid, 'conversations', conversationId), {
      updatedAt: new Date().toISOString(),
      revision: newRevision,
      lastMessageSnippet: content.slice(0, 80),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, asstPath);
  }

  // 5. Trigger asynchronous summary in the background
  refreshSummary(conversationId).catch((e) => console.warn('Background summary failed:', e));

  return {
    userMessage: userMessageData,
    assistantMessage: assistantMsgData,
    revision: newRevision,
  };
}

export async function refreshSummary(conversationId: string): Promise<Summary> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const token = await getCurrentIdToken();
  if (!token) {
    throw new Error('Authentication token unavailable.');
  }

  // Read conversation history
  const msgsSnap = await getDocs(
    query(collection(db, 'users', uid, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'))
  );
  if (msgsSnap.empty) {
    throw new Error('Cannot summarize empty conversation.');
  }

  const history = msgsSnap.docs.map((d) => {
    const data = d.data();
    return {
      role: data.role === 'assistant' ? 'assistant' : 'user',
      content: String(data.content || ''),
    };
  });

  const res = await fetch('/api/ai/summarize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ history }),
  });

  const aiData = await parseJsonResponse<Partial<Summary>>(res, 'Summary generation service error');
  const summaryData: Summary = {
    conversationId,
    revision: 1,
    summary: aiData.summary || '',
    themes: aiData.themes || [],
    decisions: aiData.decisions || [],
    unresolvedQuestions: aiData.unresolvedQuestions || [],
    updatedAt: new Date().toISOString(),
    status: 'current',
  };

  const summaryPath = `users/${uid}/conversations/${conversationId}/summaries/latest`;
  try {
    await setDoc(doc(db, 'users', uid, 'conversations', conversationId, 'summaries', 'latest'), summaryData);
    return summaryData;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, summaryPath);
  }
}

export async function requestNextStepSuggestions(
  conversationId: string
): Promise<Array<{ text: string; targetDate?: string; supportingMessageId?: string }>> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const token = await getCurrentIdToken();
  if (!token) {
    throw new Error('Authentication token unavailable.');
  }

  const msgsSnap = await getDocs(
    query(collection(db, 'users', uid, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'))
  );
  if (msgsSnap.empty) {
    return [];
  }

  const history = msgsSnap.docs.map((d) => {
    const data = d.data();
    return {
      role: data.role === 'assistant' ? 'assistant' : 'user',
      content: String(data.content || ''),
    };
  });

  const lastMessageId = msgsSnap.docs[msgsSnap.docs.length - 1].id;

  const res = await fetch('/api/ai/suggest-actions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ history, lastMessageId }),
  });

  const aiData = await parseJsonResponse<{ suggestions?: Array<{ text: string; targetDate?: string; supportingMessageId?: string }> }>(
    res,
    'Action suggestions service error'
  );
  return aiData.suggestions || [];
}

export async function fetchActions(): Promise<ActionStep[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const path = `users/${uid}/actions`;
  try {
    const q = query(collection(db, 'users', uid, 'actions'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActionStep));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveAction(action: Omit<ActionStep, 'createdAt' | 'updatedAt'>): Promise<ActionStep> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const path = `users/${uid}/actions/${action.id}`;
  const now = new Date().toISOString();
  const actionData: ActionStep = {
    ...action,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'users', uid, 'actions', action.id), actionData);
    return actionData;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateAction(
  id: string,
  updates: Partial<Pick<ActionStep, 'status' | 'text' | 'targetDate'>>
): Promise<ActionStep> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const path = `users/${uid}/actions/${id}`;
  const now = new Date().toISOString();
  const cleanUpdates = {
    ...updates,
    updatedAt: now,
  };

  try {
    await updateDoc(doc(db, 'users', uid, 'actions', id), cleanUpdates);
    const updatedDoc = await getDoc(doc(db, 'users', uid, 'actions', id));
    return { id: updatedDoc.id, ...updatedDoc.data() } as ActionStep;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteAction(id: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Please sign in.');
  }

  const path = `users/${uid}/actions/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'actions', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
