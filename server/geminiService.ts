import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured on the server. Please set it in your environment or Secret Manager.');
    }
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
];

function isTransientError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code;
  if (status === 503 || status === 429 || status === 500 || status === 502 || status === 504 || status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED') {
    return true;
  }
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('spikes in demand') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('rate limit') ||
    msg.includes('resource has been exhausted')
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callWithRetryAndFallback<T>(
  taskName: string,
  operation: (ai: GoogleGenAI, modelName: string) => Promise<T>
): Promise<T> {
  const ai = getAiClient();
  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation(ai, modelName);
      } catch (err: any) {
        lastError = err;
        if (err.status === 401 || err.status === 403 || err.message?.includes('API key')) {
          throw new Error(`Gemini Authentication Error: ${err.message}`);
        }

        const transient = isTransientError(err);
        if (transient && attempt < maxRetries) {
          const delay = (attempt + 1) * 750 + Math.random() * 250;
          console.warn(`[${taskName}] ${modelName} encountered transient issue (attempt ${attempt + 1}/${maxRetries}). Retrying in ${Math.round(delay)}ms...`);
          await wait(delay);
          continue;
        }

        console.warn(`[${taskName}] ${modelName} attempt failed:`, err.message || err);
        break; // proceed to next candidate model
      }
    }
  }

  throw new Error(`All candidate models failed for ${taskName}. Root cause: ${lastError?.message || 'Unknown error'}`);
}

function parseJsonSafely(text: string): any {
  let cleaned = (text || '').trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned);
}

const JOURNAL_SYSTEM_INSTRUCTION = `You are Daynote, a calm, reflective, and thoughtful journaling companion.
Your purpose: A private space to think clearly and move forward.

Guidelines:
- Keep your responses grounded, concise, thoughtful, and directly tailored to what the user wrote.
- Ask one or two insightful, gentle follow-up questions that help the user untangle their thoughts, consider alternative perspectives, or move toward clarity.
- Avoid superficial cheerleading or repetitive generic affirmations ("That sounds amazing!", "You got this!"). Speak with genuine curiosity and grounded calm.
- Treat this purely as a personal reflection, brainstorming, and decision-clarifying journal.
- NEVER present yourself as a medical doctor, psychotherapist, counselor, or mental health clinician. Do not provide medical, diagnostic, or psychiatric assessments.
- NEVER claim that you have contacted anyone, notified outside parties, sent an email, created a calendar event, or taken any external real-world action.`;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Generate next turn response for a multi-turn journal conversation
 */
export async function generateJournalReply(history: ChatTurn[]): Promise<string> {
  const contents = history.map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content }],
  }));

  return await callWithRetryAndFallback('generateJournalReply', async (ai, modelName) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: JOURNAL_SYSTEM_INSTRUCTION,
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error('Model returned an empty response.');
    }
    return text;
  });
}

export interface SummaryOutput {
  summary: string;
  themes: string[];
  decisions: string[];
  unresolvedQuestions: string[];
}

/**
 * Generate a concise structured summary of the conversation
 */
export async function generateSummary(history: ChatTurn[]): Promise<SummaryOutput> {
  const conversationText = history
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Journal Companion'}: ${turn.content}`)
    .join('\n\n');

  const prompt = `Analyze the following private journal conversation and provide a structured summary.
Base your summary ONLY on what was actually discussed in the conversation.

Return ONLY a valid JSON object matching this schema:
{
  "summary": "A concise 2-3 sentence overview of what was explored.",
  "themes": ["Theme 1", "Theme 2"],
  "decisions": ["Any decision made or leaning toward (empty list if none)"],
  "unresolvedQuestions": ["Key open questions or thoughts left to explore"]
}

Conversation:
${conversationText}`;

  return await callWithRetryAndFallback('generateSummary', async (ai, modelName) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const rawJson = response.text?.trim() || '{}';
    const parsed = parseJsonSafely(rawJson);

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Summary unavailable.',
      themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 5) : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.slice(0, 5) : [],
      unresolvedQuestions: Array.isArray(parsed.unresolvedQuestions) ? parsed.unresolvedQuestions.slice(0, 5) : [],
    };
  });
}

export interface NextStepSuggestion {
  text: string;
  targetDate?: string;
  supportingMessageId?: string;
}

/**
 * Propose up to 3 small, concrete, actionable next steps grounded in the conversation
 */
export async function generateActionSuggestions(
  history: ChatTurn[],
  lastMessageId?: string
): Promise<NextStepSuggestion[]> {
  const conversationText = history
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Journal Companion'}: ${turn.content}`)
    .join('\n\n');

  const prompt = `Based on this private journal reflection, identify up to 3 small, concrete, immediate next steps the user can take to move forward.

Rules:
- Actions must be small, specific, and realistic (e.g., "Draft a bulleted outline for tomorrow's check-in", "Write down 3 boundary rules for evening screen time").
- Ground every action strictly in what the user expressed or brainstormed.
- Do NOT propose external calendar syncs, contacting emergency services, or medical treatments.
- If a target date is mentioned or clearly appropriate (like "tomorrow" or "by Friday"), provide an optional ISO date (YYYY-MM-DD) or relative phrase; otherwise omit or leave null.

Return ONLY a valid JSON object matching this schema:
{
  "suggestions": [
    {
      "text": "Specific, small actionable next step",
      "targetDate": null
    }
  ]
}

Conversation:
${conversationText}`;

  return await callWithRetryAndFallback('generateActionSuggestions', async (ai, modelName) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    });

    const rawJson = response.text?.trim() || '{}';
    const parsed = parseJsonSafely(rawJson);

    if (!Array.isArray(parsed.suggestions)) {
      throw new Error('Model output did not contain suggestions array.');
    }

    const cleanSuggestions: NextStepSuggestion[] = parsed.suggestions
      .filter((s: any) => typeof s.text === 'string' && s.text.trim().length > 0)
      .slice(0, 3)
      .map((s: any) => ({
        text: s.text.trim(),
        targetDate: typeof s.targetDate === 'string' ? s.targetDate : undefined,
        supportingMessageId: lastMessageId,
      }));

    if (cleanSuggestions.length === 0) {
      throw new Error('No valid suggestions could be extracted from reflection.');
    }

    return cleanSuggestions;
  });
}
