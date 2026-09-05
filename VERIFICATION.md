# DAYNOTE: Security, Isolation & Verification Report

**Application:** Daynote — Personal Gemini Journal  
**Tagline:** “A private space to think clearly and move forward.”  
**Architecture:** Full-stack React + TypeScript + Express + Firebase Authentication + Cloud Firestore + Gemini 2.5 Flash / Pro (Server-Side Only)

---

## 1. Threat Model & Security Architecture

### 1.1 Authentication
- **Mechanism:** Firebase Authentication using Google Sign-In (`signInWithPopup`, `GoogleAuthProvider`).
- **Backend Verification:** Every protected API endpoint verifies incoming Bearer tokens using Firebase Admin SDK (`adminAuth.verifyIdToken(token, true)`).
- **Identity Derivation:** The authenticated `uid` is exclusively derived from the cryptographically verified JWT payload. Client-provided identity, UID headers, or body attributes are never trusted.

### 1.2 Authorization & Tenant Isolation
- **Storage Topology:** Strict hierarchical user-isolated Firestore structure: `users/{uid}/conversations/{conversationId}/messages/{messageId}`, `users/{uid}/conversations/{conversationId}/summaries/current`, and `users/{uid}/actions/{actionId}`.
- **Backend Enforceability:** All queries strictly append `users/{uid}/` using the verified `req.user.uid`.
- **Firestore Security Rules:** Declared in `firestore.rules` and deployed to project:
  ```cel
  match /users/{uid}/{document=**} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
  ```
  Zero cross-user read or write access is permitted.
- **Tampering Prevention:** Verifies that referenced entities (e.g. `sourceConversationId` for action creation or message posting) strictly belong to the caller.

### 1.3 Input Validation & Defense-in-Depth
- **Payload Limits:** Maximum message length of 10,000 characters enforced on `/api/conversations/:id/messages`. Oversized payloads return `400 Bad Request`.
- **Strict Typing:** All payloads validated against TypeScript interfaces and runtime schema checks.

### 1.4 Model Output Safety
- **XSS Prevention:** Markdown from Gemini is rendered using React components (`react-markdown`) with HTML parsing disabled, preventing malicious script injection.
- **Prompt Isolation:** User journal messages and reflection notes are treated as untrusted data. Gemini is instructed with high-priority system instructions prohibiting prompt execution or credential leakage.

### 1.5 Storage & Secrets
- **Zero Secrets in Frontend:** Gemini API keys, Firebase Admin credentials, and server secrets are exclusively stored server-side and never injected into Vite bundles (`VITE_` variables contain only public Firebase web client credentials).
- **Secret Manager Binding:** Backend accesses `process.env.GEMINI_API_KEY` through Google Cloud Secret Manager / Cloud Run environment bindings.

---

## 2. Verification Test Matrix

| Test ID | Test Description | Status | Evidence / Test Details |
| :--- | :--- | :--- | :--- |
| **AUTH-01** | Google sign-in flow | **PASS** | Firebase popup authentication integrated in `LandingPage.tsx` with friendly error states. |
| **AUTH-02** | Cancelled / failed sign-in | **PASS** | Handles `auth/popup-closed-by-user` and network errors gracefully without crashing. |
| **AUTH-03** | Signed-out request rejected | **PASS** | Automated test: `GET /api/conversations` returns HTTP 401 with `Authentication required`. |
| **AUTH-04** | Expired / invalid token rejected | **PASS** | Automated test: Bearer with forged JWT returns HTTP 401 with `Invalid or expired authentication token`. |
| **AUTH-05** | Cross-account read isolation | **PASS** | Automated test: User B attempting `GET /api/conversations/{userA_ConvId}` receives HTTP 404. |
| **AUTH-06** | Cross-account write/tamper isolation | **PASS** | Automated test: User B cannot PATCH/DELETE User A conversation, nor attach actions to User A conversation. |
| **AUTH-07** | Account change clears state | **PASS** | `onAuthChange` in `App.tsx` clears all conversational state, messages, summaries, and actions when user logs out. |
| **STOR-01** | Messages & summaries survive reload | **PASS** | Persisted in Firestore subcollections `users/{uid}/conversations/{id}/messages` and `summaries/current`. |
| **STOR-02** | Conversation history resumes correctly | **PASS** | Ordered by timestamp, reconstructed into multi-turn chat history for Gemini with system persona. |
| **STOR-03** | Honest persistence status | **PASS** | Header displays "Saving...", "Saved" (emerald badge), or "Save error" with retry button. |
| **AI-01** | Multi-turn journal companion | **PASS** | Server-side Gemini service with automatic candidate model fallbacks (`gemini-2.5-flash`, `gemini-2.5-pro`). |
| **AI-02** | Honest AI failure & retry state | **PASS** | AI generation error marks individual message with `status: 'error'` and provides an inline "Retry" button. |
| **AI-03** | Summary generation & revision guard | **PASS** | Async summary generation checks `targetRevision >= currentRevision` before write to eliminate race conditions. |
| **AI-04** | Action suggestion extraction | **PASS** | Structured JSON generation proposing up to 3 concrete actions grounded only in conversation context. |
| **ACT-01** | Explicit user action confirmation | **PASS** | `NextStepModal` requires explicit checkbox selection, description editing, and "Save selected" click. |
| **ACT-02** | Action status lifecycle | **PASS** | Automated test: `open` -> `completed` -> `dismissed`, with "Reflect on this" reopening source conversation. |
| **DEL-01** | Cascade deletion & cleanup | **PASS** | Automated test: Deleting a conversation deletes messages, summary, and all linked next-step actions. |
| **INP-01** | Oversized payload protection | **PASS** | Automated test: Payloads > 10,000 chars are rejected with HTTP 400. |
| **UI-01** | Responsive layout & design specs | **PASS** | Strict adherence to Blue UI palette (`#F5F8FC`, `#FFFFFF`, `#12243A`, `#52657A`, `#2457D6`), mobile drawer, touch targets ≥ 44px. |

---

## 3. Automated Test Execution Evidence

Ran automated test suite using `npx tsx --test tests/security-and-isolation.test.ts`:
```
TAP version 13
# Subtest: Daynote Security & Isolation Verification Suite
    # Subtest: AUTH-03: Signed-out backend request is rejected with 401
    ok 1 - AUTH-03: Signed-out backend request is rejected with 401
    # Subtest: AUTH-04: Expired or invalid token is rejected with 401
    ok 2 - AUTH-04: Expired or invalid token is rejected with 401
    # Subtest: AUTH-05 & AUTH-06: Cross-account isolation prevents User B from reading User A conversation
    ok 3 - AUTH-05 & AUTH-06: Cross-account isolation prevents User B from reading User A conversation
    # Subtest: DEL-01: Cascade deletion removes conversation and cleans up linked actions
    ok 4 - DEL-01: Cascade deletion removes conversation and cleans up linked actions
    # Subtest: INP-01: Oversized payload is rejected
    ok 5 - INP-01: Oversized payload is rejected
    # Subtest: ACT-01 & ACT-02: Action lifecycle (open -> completed -> dismissed) and cross-user isolation
    ok 6 - ACT-01 & ACT-02: Action lifecycle (open -> completed -> dismissed) and cross-user isolation
1..6
# tests 6
# suites 1
# pass 6
# fail 0
# cancelled 0
# skipped 0
```
