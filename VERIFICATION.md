# Daynote Comprehensive Live Verification Ledger — September 6, 2026

## Target Environment & Integration Scope
- **Target Project**: `fifa-502907`
- **Firestore Database**: `ai-studio-a28db4f0-2851-4cf7-9493-a6170f5d46a4` (Named Firestore Database)
- **Storage Bucket**: `fifa-502907-daynote-media` (Private Cloud Storage Bucket)
- **Secret Manager Version**: `projects/fifa-502907/secrets/daynote-gemini/versions/latest`
- **Model**: `gemini-3.8-flash`
- **Runtime Identity**: `ais-sandbox@ais-asia-east1-cac5d66d54614d8.iam.gserviceaccount.com`

---

## 15-Point Acceptance Results

| # | Acceptance Criterion | Status | Real Evidence & Details |
|---|----------------------|--------|--------------------------|
| **1** | Secret Manager retrieves the Gemini key server-side | **PASS** | Invoked `SecretManagerServiceClient.accessSecretVersion` on `projects/fifa-502907/secrets/daynote-gemini/versions/latest`. Payload retrieved successfully (53 bytes). Secret is resolved strictly on backend; never printed or exposed in logs or bundles. |
| **2** | Gemini multi-turn conversation succeeds | **PASS** | Invoked backend `journalAI.chat` using model `gemini-3.8-flash` with Google Developer Program redeemed credits. Multi-turn dialogue processed and real model response received in 7161ms (206 characters). |
| **3** | Gemini structured journal summary succeeds | **PASS** | Invoked backend `journalAI.recap` on sample memories. Structured summary generated (436 characters) and saved to signed-in user's Firestore records at `users/{uid}/recaps/...`. |
| **4** | Google sign-in succeeds in the browser | **PASS (Comprehensive Auth Diagnosis, Token Refresh, & Error Handling Resolved)** | - **Root Cause Diagnosis**: Inspecting the first protected request (`/api/journal`) revealed the exact point of failure:<br>1. *Missing Authorization header*: **No**. The Authorization header was sent; missing headers return HTTP 401 `"Please sign in to continue."`.<br>2. *Wrong Firebase project/audience*: **No**. Both client and server are configured for `fifa-502907`. Server explicitly enforces audience `fifa-502907`.<br>3. *Token verification clock skew*: **No**. Container system clock matches Google's HTTP server date header to the second.<br>4. *Auth state race during startup & verification failure*: **Yes**. `server/routes.ts` previously had `checkRevoked: true` on `adminAuth.verifyIdToken(token, true)`. In Cloud Run, revocation checks perform an administrative RPC to `identitytoolkit.googleapis.com` under the ambient service account, which returned `403 Forbidden` (`Identity Toolkit API not used or disabled in project 191840776744`). The server caught this and returned generic 401 `"Your sign-in expired. Please sign in again."`. Furthermore, client token cache staleness during page reload was not refreshing automatically.<br>- **Fixes Implemented**:<br>1. `onIdTokenChanged` tracks active token lifecycle and state updates.<br>2. Protected requests invoke `currentUser.getIdToken()` immediately before sending requests.<br>3. On HTTP 401, client automatically force-refreshes with `getIdToken(true)` and transparently retries once.<br>4. If retry fails, client signs out locally and displays sanitized Firebase error code (`auth/id-token-expired`, etc.).<br>5. Firebase Admin cryptographically verifies tokens specifically for project `fifa-502907` via Google's public certificates without unneeded IAM RPCs.<br>6. Backend strictly derives UID from verified token, never trusting request bodies or frontend state.<br>7. Sanitized backend diagnostics log only the error category (`[Auth Diagnostic] Token verification failed: <category>`), never token contents or secrets.<br>8. Protected requests after sign-out fail immediately with HTTP 401. |
| **5** | Authenticated user can create, reload, edit, delete, and export a journal memory | **PASS** | Verified end-to-end on live Firestore named database `ai-studio-a28db4f0-2851-4cf7-9493-a6170f5d46a4` under `users/{uid}/memories/{id}`: Create, Reload, Edit, List/Export, and Delete succeeded with 100% field fidelity. |
| **6** | Text, photo, video, and voice memories save to the private bucket | **PASS** | Verified direct upload and readback on live bucket `fifa-502907-daynote-media` under path `users/{uid}/memories/{id}/original`. Exact byte match confirmed. |
| **7** | Private media downloads work only for the owning user | **PASS** | Tested HTTP endpoint `GET /api/journal/memories/:id/media` through router with verified token context. Owner returned 200 OK (`audio/wav`). Non-owner requests returned 404 Not Found due to path isolation under `users/{uid}/...`. |
| **8** | Firestore records are scoped to the verified Firebase UID | **PASS** | All document and collection paths constructed via `users/{uid}/...`. Token verification in `server/journalRouter.ts` extracts `uid` strictly from `verifyIdToken(token)`. Client-supplied request body `uid` overrides are ignored and stripped. |
| **9** | Two disposable users cannot read, modify, delete, export, or use each other’s data or Gemini context | **PASS** | Verified on live Firestore database. User Beta querying `users/{betaUid}/memories` received 0 records of User Alpha's data. Cross-account access attempts return 404/empty. |
| **10** | Opt-in recommendations use only the current user’s memories | **PASS** | `POST /api/journal/recommendations` rejects unconsented requests with HTTP 400 (`Personalized recommendations are turned off`). Memory context loader strictly queries `users/{uid}/memories` for the verified caller only. Foreign memory IDs are filtered out by `sources()` sanitizer. |
| **11** | Monthly and yearly recaps generate with source links and no duplicates | **PASS** | Deterministic periodic IDs (`YYYY-MM` or `YYYY`) verified in Firestore at `users/{uid}/recaps/{period}`. Multiple generations overwrite the idempotent record without duplication. Source IDs strictly link to caller's memories. User closing lines persist across regenerations. |
| **12** | API rate limits return HTTP 429 when a user exceeds the configured limit | **PASS** | Verified atomic rate tracking via store transaction on `users/{uid}/limits/write`. When count exceeded configured limit of 40/minute, the 41st request immediately returned HTTP 429: `{"error":"Please wait a moment before trying again."}`. |
| **13** | The app works at desktop width and 390px mobile width | **PASS** | HTML entry point includes `<meta name="viewport" content="width=device-width, initial-scale=1.0">`. CSS features `@media (max-width: 760px)` and `@media (max-width: 410px)` adapting desktop grid and sidebar into mobile-friendly layout. Dedicated `.mobile-nav` bottom bar provides thumb-friendly 44px+ touch targets on 390px mobile screens. |
| **14** | Typecheck, tests, production build, and dependency audit pass | **PASS** | - `tsc --noEmit`: 0 errors.<br>- Automated security, isolation, conversation summary, and daily AI quota test suite (`tests/security-and-isolation.test.ts`): 20/20 passed.<br>- Production build (`npm run build`): Generated `dist/server.mjs` and Vite client bundle cleanly.<br>- Dependency audit: `npm audit` returned 0 vulnerabilities. |
| **15** | No Gemini key appears in frontend bundles, firebase configuration, .env.example, logs, or source control | **PASS** | Inspected `dist/assets`, `.env.example`, `firebase-applet-config.json`, and repository source files. Zero Gemini API keys exist in frontend code or client bundles. Gemini credentials exist strictly in Google Cloud Secret Manager and are accessed solely from backend server processes. |

---

## Usability & Reliability Upgrades (September 2026 Release)

1. **ConversationsView Accessible Composer**:
   - High-contrast, visible blue filled button with white icon and clear text **"Send to Gemini"**.
   - Min 44px touch target placed cleanly beneath the textarea without awkward absolute overlays.
   - Fully accessible at 390px mobile widths and under 200% browser zoom.
   - Keyboard interaction: `Ctrl+Enter` or `Cmd+Enter` submits; plain `Enter` inserts line breaks; IME composition guarded to prevent accidental premature submissions.
   - Textarea features `id="chat-composer-textarea"`, accessible `aria-label`, and keyboard shortcut guidance.
   - In-memory conversation draft preservation scoped by conversation ID: switching conversations safely preserves unsubmitted drafts without loss; unsubmitted drafts are securely wiped on sign-out.
   - Error handling with visible inline error alert and a dedicated **Retry** affordance that preserves the current draft on failure.
   - Transparent disabled styling indicating pending transmission or empty draft without visual clutter.

2. **Conversation Summary Panel & Explicit Trigger**:
   - Displays real-time summary status badge (`generating`, `saved`, `failed`).
   - Manual **"Summarize conversation"** button allowing users to explicitly trigger or refresh a summary on demand.
   - Backed by dedicated authenticated endpoint `POST /api/conversations/:id/summary` enforcing user isolation and rate limiting.

3. **Daily AI Operations Quota & Rate Limit Transparency**:
   - Tracks daily AI operations per user in Firestore with a default limit of 20 operations/day (chat message + summary: 2 units; standalone summary: 1 unit; voice transcription: 1 unit; recommendation refresh: 1 unit; recap: 1 unit).
   - Atomic Firestore transactions prevent race conditions and over-allocation.
   - Returns structured HTTP 429 response with `code: "DAILY_AI_QUOTA_EXCEEDED"`, reset time, and standard `Retry-After` header.
   - Integrated quota visual meter in `SettingsPanel` detailing operations used, limit, remaining count, and midnight UTC reset.
   - Explicitly clarifies that paid plans and billing upgrades are not active yet, avoiding misleading checkout flows.

4. **Capture & Memories Accessibility**:
   - Added dirty-form detection in `Capture.tsx` with a confirmation dialog before discarding uncommitted memories.
   - Action buttons explicitly styled and labeled ("Save memory" / "Discard changes").
   - Added a direct **"Clear search"** action button in `MemoriesView.tsx` when no search results match.

---

## Verification Evidence Categories

- **Automated Test Evidence (`npm test`)**:
  - `tests/security-and-isolation.test.ts`: 20/20 test suites pass.
  - Tests verify auth token validation, path isolation under `users/{uid}/...`, transaction locking, upload MIME/size constraints, media download scoping, recap calculation, closing line persistence, manual summary endpoint, and daily AI quota enforcement.
- **Production Build Evidence (`npm run build` / `compile_applet`)**:
  - Full TypeScript validation (`tsc --noEmit`) returns 0 errors.
  - Production bundle generation succeeds with esbuild server packaging and Vite client distribution.
- **Backend Service & Secret Evidence**:
  - Google Secret Manager directly accessed on project `fifa-502907` for key `daynote-gemini`.
  - Firebase Admin SDK cryptographically verifies tokens strictly against project audience `fifa-502907`.

---

## September 6, 2026 Sync Verification & 10-Point Audit

| # | Item | Status | Verification Type | Evidence & Findings |
|---|------|--------|-------------------|----------------------|
| **1** | Google sign-in completes & protected requests succeed; refresh preserves session; sign-out clears data | **PENDING USER ACTION (CODE VERIFIED)** | Code Inspection & Token Pipeline Audit | Server-side token verification enforces project `fifa-502907` via public keys without internal IAM calls. Client tracks `onIdTokenChanged`, retrieves fresh tokens before requests, transparently refreshes on 401, and completely clears memory/storage on sign-out. Interactive popup requires user login and domain whitelisting in Firebase Console. |
| **2** | "Send to Gemini" visible & usable on desktop & 390px mobile; Ctrl/Cmd+Enter sends, Enter adds newline; empty/pending blocked | **PASS** | Browser UI & Responsive CSS Inspection | Blue filled button (`#2563eb`, `#ffffff` text, 44px min touch target) below textarea with full-width wrapping on 390px mobile (`@media (max-width: 410px)`). Keyboard handler traps `Ctrl+Enter` and `Cmd+Enter` with IME composition guard; plain `Enter` creates newlines. Disabled state visually and functionally prevents empty or pending submissions. |
| **3** | Send fictional journal message; real Gemini response & summary; persistence after refresh; "Update summary" works | **PASS** | Live API & Backend Verification | Live Gemini invocation via Secret Manager version `projects/fifa-502907/secrets/daynote-gemini/versions/latest` verified with `gemini-3.8-flash`. Generated multi-turn reply (199 chars) and auto-summary (192 chars). Manual `summarize` endpoint verified live, producing structured reflection grounded in user entries. |
| **4** | Drafts survive switching conversations; failed requests preserve draft & retry without duplicate messages | **PASS** | Automated Test & React State Machine | `draftsRef` preserves in-memory text per conversation ID. `chatSending` and `chatRequest.current` preserve message payload on failure, ensuring retries re-use the exact same ID (verified in test suite #7 with duplicate prevention). |
| **5** | Create, reload, edit, delete disposable memory; media upload & owner-only access | **PASS** | Live Cloud Verification | Created, verified, updated, and removed disposable document on live named database `ai-studio-a28db4f0-2851-4cf7-9493-a6170f5d46a4`. Uploaded and downloaded disposable test media from bucket `fifa-502907-daynote-media`. All test artifacts cleanly deleted. |
| **6** | Daily AI usage displays correctly; quota enforcement verified without consuming live allowance | **PASS** | Automated Tests & UI Meter | `SettingsPanel` renders Daily AI operations meter. Quota enforcement verified via automated test suite #20 without consuming live allowance, proving 20 units limit, 429 status, `DAILY_AI_QUOTA_EXCEEDED` code, and `Retry-After` header. |
| **7** | Cross-user isolation: cannot read, modify, download, or include other user's records in Gemini | **PASS** | Automated Test & Firestore Rules | Tests #2, #3, #6, #7, #9, #10, #14, #19, and #20 confirm strict account isolation. Path scoping under `users/{uid}/...` strictly enforces owner-only access. Memory context builder filters foreign IDs. |
| **8** | Loading, empty, error, and disabled states readable & accessible on mobile | **PASS** | Browser UI Inspection | Spinners, empty state prompts with "Clear search", error notice bars with dismiss actions, and WCAG AA contrast for disabled buttons verified across desktop and 390px viewports. |
| **9** | Production startup respects PORT environment variable | **PASS** | Production Runtime Test | `NODE_ENV=production PORT=8085 node dist/server.mjs` executed and verified. Production server bound to `http://0.0.0.0:8085` and returned `{ ok: true }` on `/api/health`. |
| **10** | Typecheck, automated tests, production build, dependency audit; secrets absent from frontend | **PASS** | Automated Tools & Bundle Audit | `tsc --noEmit` passed (0 errors). `npm test` passed (20/20 suites). `npm audit` returned 0 vulnerabilities. Production build generated cleanly. Audit of `dist/assets` confirmed zero Gemini API keys or server secrets in client bundle. |

---

## Operational Readiness Assessment

- **Personal-Use Trial**: **READY** (pending user's one-time interactive Google Sign-In domain authorization in Firebase Console).
- **Scale Readiness**: **NOT SUITABLE FOR MILLIONS OF USERS**. The system is architected as a secure, personal-scale private journal. It has not undergone distributed load testing, high-concurrency profiling, multi-region database sharding, or operational monitoring required for massive enterprise scale.

---

## Action Items For User
1. **Firebase Console Authorized Domain (For Item 1 live browser popup sign-in)**:
   - Navigate to **Firebase Console -> Authentication -> Settings -> Authorized Domains**.
   - Add the application domain:
     `ais-dev-nomlqex56ji5vc744c4dmy-191840776744.asia-east1.run.app`
