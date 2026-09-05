import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from './firebaseAdmin.js';
import { getDb } from './db.js';
import { 
  generateJournalReply, 
  generateSummary, 
  generateActionSuggestions,
  type ChatTurn 
} from './geminiService.js';

export const apiRouter = Router();

// Health check endpoint
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All subsequent routes require valid Firebase ID token authentication
apiRouter.use(requireAuth);

/**
 * Helper to get user root collection
 */
function getUserRef(uid: string) {
  return getDb().collection('users').doc(uid);
}

/**
 * GET /api/conversations - List all conversations for the authenticated user
 */
apiRouter.get('/conversations', async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  try {
    const snapshot = await getUserRef(uid)
      .collection('conversations')
      .orderBy('updatedAt', 'desc')
      .get();

    const conversations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ conversations });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations', details: error.message });
  }
});

/**
 * POST /api/conversations - Create a new conversation
 */
apiRouter.post('/conversations', async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  const { id, title, starterPrompt } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Conversation ID is required.' });
  }

  const cleanTitle = (typeof title === 'string' && title.trim().length > 0)
    ? title.trim().slice(0, 100)
    : 'Untitled reflection';

  const now = new Date().toISOString();
  const convRef = getUserRef(uid).collection('conversations').doc(id);

  try {
    const newConv = {
      id,
      title: cleanTitle,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      lastMessageSnippet: starterPrompt ? starterPrompt.slice(0, 80) : '',
    };

    await convRef.set(newConv);

    // If a starter prompt was provided, create the initial user message
    if (starterPrompt && typeof starterPrompt === 'string') {
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await convRef.collection('messages').doc(msgId).set({
        id: msgId,
        conversationId: id,
        role: 'user',
        content: starterPrompt.trim(),
        createdAt: now,
        status: 'saved',
      });
    }

    res.status(201).json({ conversation: newConv });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation', details: error.message });
  }
});

/**
 * GET /api/conversations/:id - Get conversation, chronological messages, and latest summary
 */
apiRouter.get('/conversations/:id', async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  const conversationId = req.params.id;

  try {
    const convRef = getUserRef(uid).collection('conversations').doc(conversationId);
    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found or access denied.' });
    }

    const messagesSnapshot = await convRef
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get();

    const messages = messagesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const summaryDoc = await convRef.collection('summaries').doc('current').get();
    const summary = summaryDoc.exists ? summaryDoc.data() : null;

    res.json({
      conversation: { id: convDoc.id, ...convDoc.data() },
      messages,
      summary,
    });
  } catch (error: any) {
    console.error('Error loading conversation:', error);
    res.status(500).json({ error: 'Failed to load conversation', details: error.message });
  }
});

/**
 * PATCH /api/conversations/:id - Rename a conversation
 */
apiRouter.patch('/conversations/:id', async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  const conversationId = req.params.id;
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Valid title is required.' });
  }

  try {
    const convRef = getUserRef(uid).collection('conversations').doc(conversationId);
    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found or access denied.' });
    }

    const updatedTitle = title.trim().slice(0, 100);
    const now = new Date().toISOString();

    await convRef.update({
      title: updatedTitle,
      updatedAt: now,
    });

    res.json({ success: true, title: updatedTitle });
  } catch (error: any) {
    console.error('Error renaming conversation:', error);
    res.status(500).json({ error: 'Failed to rename conversation', details: error.message });
  }
});

/**
 * DELETE /api/conversations/:id - Cascade delete conversation, messages, summary, and linked actions
 */
apiRouter.delete('/conversations/:id', async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  const conversationId = req.params.id;

  try {
    const convRef = getUserRef(uid).collection('conversations').doc(conversationId);
    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found or access denied.' });
    }

    // 1. Delete all messages
    const messages = await convRef.collection('messages').get();
    const batch = getDb().batch();
    messages.docs.forEach((doc) => batch.delete(doc.ref));

    // 2. Delete summary
    const summaries = await convRef.collection('summaries').get();
    summaries.docs.forEach((doc) => batch.delete(doc.ref));

    // 3. Delete conversation doc
    batch.delete(convRef);

    // 4. Clean up any next-step actions linked to this conversation
    const actionsSnapshot = await getUserRef(uid)
      .collection('actions')
      .where('sourceConversationId', '==', conversationId)
      .get();

    actionsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();

    res.json({ success: true, message: 'Conversation and all associated data deleted.' });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation', details: error.message });
  }
});

/**
 * POST /api/conversations/:id/messages - Send a message and generate assistant response
 */
apiRouter.post('/conversations/:id/messages', async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  const conversationId = req.params.id;
  const { messageId, content, retry } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Message content cannot be empty.' });
  }

  if (content.length > 10000) {
    return res.status(400).json({ error: 'Message exceeds maximum allowed length (10,000 characters).' });
  }

  const convRef = getUserRef(uid).collection('conversations').doc(conversationId);

  try {
    const convDoc = await convRef.get();
    if (!convDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found or access denied.' });
    }

    const convData = convDoc.data() || {};
    const currentRevision = (convData.revision || 1);
    const now = new Date().toISOString();

    const userMsgId = messageId || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const userMsgRef = convRef.collection('messages').doc(userMsgId);

    // PERSISTENCE RULE: Persist the user message before generation
    const userMessageData = {
      id: userMsgId,
      conversationId,
      role: 'user',
      content: content.trim(),
      createdAt: now,
      status: 'saved',
    };

    await userMsgRef.set(userMessageData, { merge: true });

    // Read full conversation history for context
    const messagesSnapshot = await convRef.collection('messages').orderBy('createdAt', 'asc').get();
    const history: ChatTurn[] = messagesSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      const role: 'user' | 'assistant' = data.role === 'assistant' ? 'assistant' : 'user';
      return {
        role,
        content: String(data.content || ''),
      };
    });

    // Invoke Gemini AI
    let replyText = '';
    try {
      replyText = await generateJournalReply(history);
    } catch (aiError: any) {
      console.error('Gemini journal reply failed:', aiError.message);
      // Return honest error with user message safely saved
      return res.status(502).json({
        userMessage: userMessageData,
        error: `Gemini service error: ${aiError.message}`,
        canRetry: true,
      });
    }

    // Persist assistant message
    const assistantMsgId = `asst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const assistantMsgData = {
      id: assistantMsgId,
      conversationId,
      role: 'assistant',
      content: replyText,
      createdAt: new Date().toISOString(),
      status: 'saved',
    };

    const newRevision = currentRevision + 1;

    await convRef.collection('messages').doc(assistantMsgId).set(assistantMsgData);
    await convRef.update({
      updatedAt: new Date().toISOString(),
      revision: newRevision,
      lastMessageSnippet: content.slice(0, 80),
    });

    // Trigger asynchronous summary generation with revision lock
    const updatedHistory: ChatTurn[] = [...history, { role: 'assistant', content: replyText }];
    triggerAsyncSummary(uid, conversationId, updatedHistory, newRevision).catch((err) => {
      console.warn('Async summary generation failed:', err.message);
    });

    res.status(200).json({
      userMessage: userMessageData,
      assistantMessage: assistantMsgData,
      revision: newRevision,
    });
  } catch (error: any) {
    console.error('Error handling message send:', error);
    res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
});

/**
 * Asynchronously generates and saves summary, guarded against stale revisions
 */
async function triggerAsyncSummary(
  uid: string, 
  conversationId: string, 
  history: ChatTurn[], 
  forRevision: number
) {
  const convRef = getUserRef(uid).collection('conversations').doc(conversationId);
  const summaryRef = convRef.collection('summaries').doc('current');

  try {
    // Set status to updating
    await summaryRef.set({
      conversationId,
      revision: forRevision,
      status: 'updating',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    const summaryOutput = await generateSummary(history);

    // Check that revision hasn't progressed in the meantime
    const currentConv = await convRef.get();
    if (!currentConv.exists) return;
    const latestRevision = currentConv.data()?.revision || 1;

    if (latestRevision > forRevision) {
      console.info(`Discarding summary for revision ${forRevision} because revision is now ${latestRevision}`);
      return;
    }

    await summaryRef.set({
      conversationId,
      revision: forRevision,
      summary: summaryOutput.summary,
      themes: summaryOutput.themes,
      decisions: summaryOutput.decisions,
      unresolvedQuestions: summaryOutput.unresolvedQuestions,
      status: 'current',
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Summary async generation failed:', error.message);
    await summaryRef.set({
      conversationId,
      revision: forRevision,
      status: 'failed',
      error: error.message,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
}

/**
 * POST /api/conversations/:id/summaries/generate - Manually refresh or retry summary
 */
apiRouter.post('/conversations/:id/summaries/generate', async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  const conversationId = req.params.id;

  const convRef = getUserRef(uid).collection('conversations').doc(conversationId);

  try {
    const convDoc = await convRef.get();
    if (!convDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found or access denied.' });
    }

    const currentRevision = convDoc.data()?.revision || 1;
    const messagesSnapshot = await convRef.collection('messages').orderBy('createdAt', 'asc').get();

    if (messagesSnapshot.empty) {
      return res.status(400).json({ error: 'Cannot summarize empty conversation.' });
    }

    const history: ChatTurn[] = messagesSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      const role: 'user' | 'assistant' = data.role === 'assistant' ? 'assistant' : 'user';
      return {
        role,
        content: String(data.content || ''),
      };
    });

    const summaryRef = convRef.collection('summaries').doc('current');
    await summaryRef.set({
      conversationId,
      revision: currentRevision,
      status: 'updating',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    const summaryOutput = await generateSummary(history);

    const fullSummary = {
      conversationId,
      revision: currentRevision,
      summary: summaryOutput.summary,
      themes: summaryOutput.themes,
      decisions: summaryOutput.decisions,
      unresolvedQuestions: summaryOutput.unresolvedQuestions,
      status: 'current',
      updatedAt: new Date().toISOString(),
    };

    await summaryRef.set(fullSummary);
    res.json({ summary: fullSummary });
  } catch (error: any) {
    console.error('Manual summary generation error:', error);
    res.status(502).json({ error: 'Failed to generate summary', details: error.message });
  }
});

/**
 * POST /api/conversations/:id/actions/suggest - Propose next steps (User review required, not saved)
 */
apiRouter.post('/conversations/:id/actions/suggest', async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  const conversationId = req.params.id;

  const convRef = getUserRef(uid).collection('conversations').doc(conversationId);

  try {
    const convDoc = await convRef.get();
    if (!convDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found or access denied.' });
    }

    const messagesSnapshot = await convRef.collection('messages').orderBy('createdAt', 'asc').get();
    if (messagesSnapshot.empty) {
      return res.status(400).json({ error: 'Cannot suggest next steps from an empty conversation.' });
    }

    const history: ChatTurn[] = messagesSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      const role: 'user' | 'assistant' = data.role === 'assistant' ? 'assistant' : 'user';
      return {
        role,
        content: String(data.content || ''),
      };
    });

    const lastMsgId = messagesSnapshot.docs[messagesSnapshot.docs.length - 1].id;
    const suggestions = await generateActionSuggestions(history, lastMsgId);

    res.json({ suggestions });
  } catch (error: any) {
    console.error('Action suggestions error:', error);
    res.status(502).json({ error: 'Failed to propose next steps', details: error.message });
  }
});

/**
 * GET /api/actions - List all saved actions for authenticated user
 */
apiRouter.get('/actions', async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;

  try {
    const snapshot = await getUserRef(uid)
      .collection('actions')
      .orderBy('createdAt', 'desc')
      .get();

    const actions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ actions });
  } catch (error: any) {
    console.error('Error fetching actions:', error);
    res.status(500).json({ error: 'Failed to fetch actions', details: error.message });
  }
});

/**
 * POST /api/actions - Save a user-confirmed action
 */
apiRouter.post('/actions', async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  const { id, text, targetDate, status, sourceConversationId, supportingMessageId } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Action ID is required.' });
  }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Action text cannot be empty.' });
  }

  if (!sourceConversationId || typeof sourceConversationId !== 'string') {
    return res.status(400).json({ error: 'sourceConversationId is required.' });
  }

  // Verify source conversation belongs to this user
  const convRef = getUserRef(uid).collection('conversations').doc(sourceConversationId);
  const convDoc = await convRef.get();
  if (!convDoc.exists) {
    return res.status(400).json({ error: 'Associated source conversation not found or access denied.' });
  }

  // If supportingMessageId is provided, verify it belongs to this conversation
  if (supportingMessageId) {
    const msgDoc = await convRef.collection('messages').doc(supportingMessageId).get();
    if (!msgDoc.exists) {
      return res.status(400).json({ error: 'Associated supporting message was not found in conversation.' });
    }
  }

  const now = new Date().toISOString();
  const actionData = {
    id,
    text: text.trim().slice(0, 500),
    targetDate: typeof targetDate === 'string' && targetDate.trim() ? targetDate.trim() : null,
    status: status === 'completed' || status === 'dismissed' ? status : 'open',
    sourceConversationId,
    supportingMessageId: supportingMessageId || null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await getUserRef(uid).collection('actions').doc(id).set(actionData);
    res.status(201).json({ action: actionData });
  } catch (error: any) {
    console.error('Error saving action:', error);
    res.status(500).json({ error: 'Failed to save action', details: error.message });
  }
});

/**
 * PATCH /api/actions/:id - Update status, text, or targetDate of an action
 */
apiRouter.patch('/actions/:id', async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  const actionId = req.params.id;
  const { status, text, targetDate } = req.body;

  const actionRef = getUserRef(uid).collection('actions').doc(actionId);

  try {
    const actionDoc = await actionRef.get();
    if (!actionDoc.exists) {
      return res.status(404).json({ error: 'Action not found or access denied.' });
    }

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (status && ['open', 'completed', 'dismissed'].includes(status)) {
      updates.status = status;
    }

    if (typeof text === 'string' && text.trim().length > 0) {
      updates.text = text.trim().slice(0, 500);
    }

    if (targetDate !== undefined) {
      updates.targetDate = typeof targetDate === 'string' && targetDate.trim() ? targetDate.trim() : null;
    }

    await actionRef.update(updates);
    const updated = await actionRef.get();

    res.json({ action: { id: updated.id, ...updated.data() } });
  } catch (error: any) {
    console.error('Error updating action:', error);
    res.status(500).json({ error: 'Failed to update action', details: error.message });
  }
});

/**
 * DELETE /api/actions/:id - Delete an action
 */
apiRouter.delete('/actions/:id', async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  const actionId = req.params.id;

  const actionRef = getUserRef(uid).collection('actions').doc(actionId);

  try {
    const actionDoc = await actionRef.get();
    if (!actionDoc.exists) {
      return res.status(404).json({ error: 'Action not found or access denied.' });
    }

    await actionRef.delete();
    res.json({ success: true, message: 'Action deleted.' });
  } catch (error: any) {
    console.error('Error deleting action:', error);
    res.status(500).json({ error: 'Failed to delete action', details: error.message });
  }
});

/**
 * Dedicated AI Generation Endpoints (Server-side Gemini proxy)
 */
apiRouter.post('/ai/chat', async (req: AuthenticatedRequest, res) => {
  try {
    const { history, userMessage } = req.body;
    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
      return res.status(400).json({ error: 'userMessage is required' });
    }
    if (userMessage.length > 10000) {
      return res.status(400).json({ error: 'userMessage exceeds 10000 characters limit' });
    }

    const safeHistory: ChatTurn[] = Array.isArray(history) 
      ? history.slice(-20).map((h: any) => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: String(h.content || '').slice(0, 10000),
        }))
      : [];

    safeHistory.push({ role: 'user', content: userMessage.trim() });

    const reply = await generateJournalReply(safeHistory);
    res.json({ reply });
  } catch (err: any) {
    console.error('AI chat endpoint error:', err.message);
    res.status(503).json({ error: 'Gemini generation error', details: err.message });
  }
});

apiRouter.post('/ai/summarize', async (req: AuthenticatedRequest, res) => {
  try {
    const { history } = req.body;
    if (!Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: 'history array is required' });
    }

    const safeHistory: ChatTurn[] = history.slice(-30).map((h: any) => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: String(h.content || '').slice(0, 10000),
    }));

    const result = await generateSummary(safeHistory);
    res.json(result);
  } catch (err: any) {
    console.error('AI summarize endpoint error:', err.message);
    res.status(503).json({ error: 'Gemini summarization error', details: err.message });
  }
});

apiRouter.post('/ai/suggest-actions', async (req: AuthenticatedRequest, res) => {
  try {
    const { history, lastMessageId } = req.body;
    if (!Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: 'history array is required' });
    }

    const safeHistory: ChatTurn[] = history.slice(-30).map((h: any) => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: String(h.content || '').slice(0, 10000),
    }));

    const suggestions = await generateActionSuggestions(safeHistory, lastMessageId || 'msg');
    res.json({ suggestions });
  } catch (err: any) {
    console.error('AI suggest-actions endpoint error:', err.message);
    res.status(503).json({ error: 'Gemini action suggestion error', details: err.message });
  }
});

// Fallback for any unknown /api route to prevent Vite SPA HTML fallback
apiRouter.all('*', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});
