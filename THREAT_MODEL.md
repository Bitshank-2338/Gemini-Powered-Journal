# Threat Model: Daynote (Personal Gemini Journal)

**Target Application:** Daynote — Personal Gemini Journal  
**Tagline:** "A private space to think clearly and move forward."  
**Architecture:** React 19 + TypeScript (Client), Node.js Express (Backend), Firebase Authentication (Google Sign-In), Cloud Firestore (User-isolated database), Google Cloud Secret Manager / Gemini SDK (@google/genai).

---

## 1. Authentication
- **Threats:**
  - Token spoofing, manipulation, or replay attacks.
  - Using expired or forged identities to invoke backend endpoints.
  - Stale client session remaining active across different user accounts.
- **Security Controls & Mitigations:**
  - Firebase Authentication with Google Sign-In as identity provider.
  - All protected backend API endpoints (`/api/*`) require a bearer token in the `Authorization: Bearer <ID_TOKEN>` header.
  - Firebase Admin SDK strictly validates tokens (`auth.verifyIdToken(token, true)`), verifying digital signatures, audience, issuer, expiration, and revocation status.
  - Frontend clears all in-memory state, active Firestore listeners, and conversational contexts immediately on sign-out or account transition.

---

## 2. Authorization & Data Isolation
- **Threats:**
  - Insecure Direct Object Reference (IDOR): User B modifies or reads User A's conversations, messages, summaries, or actions by manipulating URL/payload IDs.
  - Backend bypass where client supplies arbitrary `uid` parameters.
  - Mass assignment or privilege escalation.
- **Security Controls & Mitigations:**
  - **Single Source of Truth:** `uid` is exclusively derived from the cryptographically verified Firebase ID token on the server. Request parameters or bodies claiming a `uid` are rejected or ignored.
  - **Backend Access Control:** Every server-side Firestore query or operation strictly targets `users/${verifiedUid}/...`. The backend queries the specific user collection and verifies document existence and ownership before performing writes, AI completions, summaries, or deletions.
  - **Defense-in-Depth Firestore Rules:** Client-side Firestore rules enforce `request.auth != null && request.auth.uid == uid` across all subcollections (`conversations`, `messages`, `summaries`, `actions`). Direct access to other user trees is denied at the database rule layer.

---

## 3. User Input & Request Integrity
- **Threats:**
  - Injection attacks (SQL/NoSQL/Command injection, prompt injection).
  - Denial of Service (DoS) via oversized payloads or spamming expensive LLM endpoints.
  - Cross-Site Scripting (XSS) via reflection text.
- **Security Controls & Mitigations:**
  - Payload limits: Express limits JSON body sizes (100KB max). Message text is capped (max 10,000 characters) and validated.
  - Prompt Injection Defense: User input is passed as distinct content parts in Gemini API user turns, separated from system instructions. System instructions explicitly restrict Gemini to reflection, brainstorming, and structuring action proposals, forbidding tool execution or prompt override.
  - Document IDs are validated against strict alphanumeric/UUID character sets.

---

## 4. Model Output & AI Integrity
- **Threats:**
  - Hallucinated or malicious output containing unescaped HTML/JavaScript executing in the browser.
  - Model claiming it has taken external real-world actions, sent emails, or contacted emergency/medical services.
  - Model returning invalid formats for summaries or structured action suggestions.
- **Security Controls & Mitigations:**
  - Safe Rendering: React automatically escapes HTML. Model Markdown is parsed safely using `react-markdown` with HTML disabled or sanitized.
  - System Instructions: Ground Gemini strictly as a private reflection and brainstorming journal. Prohibit diagnostic/therapy claims and claims of external actions.
  - Schema Validation: For "Turn this into a next step", Gemini output is requested with strict JSON schema structure. Server validates that the proposed actions are non-empty arrays with required `text` fields before responding. Malformed proposals are rejected with an explicit error.
  - User Confirmation Gate: No suggested action is ever committed to Firestore automatically. The user must review, optionally edit, and explicitly click "Save action".

---

## 5. Storage & Persistence Integrity
- **Threats:**
  - Incomplete deletions leaving orphaned messages or actions.
  - Concurrency race conditions (e.g. older asynchronous summary job overwriting newer summary).
  - False reporting of "Saved" status when persistence failed.
- **Security Controls & Mitigations:**
  - Version/Revision tracking: Summaries are linked to the specific conversation revision / timestamp. Asynchronous summary updates check that the summarized revision matches or exceeds the stored revision before writing.
  - Strict Deletion Lifecycle: Deleting a conversation atomically or sequentially cleans up child messages, summaries, and associated next-step actions tagged with `sourceConversationId`.
  - Honest UI State: State is marked "Saving..." during transit and transitions to "Saved" only after Firestore confirmation, or "Save failed" with retry if rejected.

---

## 6. Secrets & Environment
- **Threats:**
  - Leaking `GEMINI_API_KEY` or service account credentials in client JS bundles, network headers, git repositories, or error messages.
- **Security Controls & Mitigations:**
  - Client bundle contains only public Firebase Web Config (`apiKey`, `projectId`, `authDomain`).
  - `GEMINI_API_KEY` is loaded strictly on the Node.js server via environment variables / Google Cloud Secret Manager.
  - Server errors return sanitized error messages (e.g., "AI service temporarily unavailable") rather than dumping stack traces or credentials.
  - `.env.example` contains only variable names and dummy placeholders.
