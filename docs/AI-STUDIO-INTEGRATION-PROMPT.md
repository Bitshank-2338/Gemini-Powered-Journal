Continue the existing Daynote application. Integrate and verify the real Google services while preserving its current midnight-blue, voice-first UI.

SOURCE OF TRUTH
Repository: https://github.com/Bitshank-2338/Gemini-Powered-Journal
Branch: feat/voice-memory-journal
Review: https://github.com/Bitshank-2338/Gemini-Powered-Journal/pull/1

Confirm this branch is loaded before editing. Verify these files exist: shared/journal.ts, server/journalRouter.ts, server/ai.ts, src/components/Capture.tsx, docs/CLOUD-SETUP.md. If this is the older text-only app, stop and explain how to load the rebuilt branch. Do not rebuild from scratch or overwrite newer repository changes.

Read README.md, THREAT_MODEL.md, VERIFICATION.md, docs/CLOUD-SETUP.md, docs/SECURITY-CONSTITUTION.md and infra/deploy.ps1. Keep the security constitution in force.

WORK IN VERIFICATION LOOPS
For each stage: inspect → state acceptance criteria → implement a bounded change → run tests → exercise the UI → fix failures → record evidence. Continue independent work if a cloud permission is missing, but report the exact missing action. Never fabricate success or replace a failed live service with sample data.

1. Establish the baseline.
   Run npm ci, npm run lint, npm test, npm run build and npm audit. The rebuild previously passed 17 local API/security tests and the Verify Daynote workflow. A later SonarCloud quality gate failed with reliability/security ratings of C. Inspect the current report, resolve actionable findings, and rerun analysis; do not disable the gate or suppress findings simply to obtain a pass. Existing annotations include excessive complexity in Journal and Capture. Keep service doubles confined to tests.

2. Connect Firebase Authentication and Firestore.
   Use project fifa-502907, region asia-southeast1, and the EXISTING named Firestore database ai-studio-a28db4f0-2851-4cf7-9493-a6170f5d46a4. Verify these resources; do not silently create or use the default database. Enable Google sign-in and configure authorized domains for the actual preview/deployed origins.

Keep journal access through the server. Verify Firebase ID tokens, including revocation, and derive every user's storage path exclusively from the verified UID. Preserve older conversations. Deploy rules only to the intended named database after reviewing the migration impact on the old frontend.

Verify with two disposable accounts: A saves and reloads a memory and conversation; B cannot list, fetch, edit, delete, export or use A's content as Gemini context, even with A's IDs. Test direct database access too. Local mock tests alone do not prove deployed isolation.

3. Connect Google Cloud Secret Manager and Gemini.
   At the last check Secret Manager was disabled. Enable it if authorized and configure the runtime service identity with access to the single daynote-gemini secret. Use:
   GEMINI_SECRET_VERSION=projects/fifa-502907/secrets/daynote-gemini/versions/latest

The owner must enter the key through Secret Manager's secure interface. Never request or display it in chat, code, logs, screenshots, frontend variables or committed files. Keep the public Firebase browser key separate. Do not replace the required Secret Manager integration with AI Studio's generic GEMINI_API_KEY injection and claim the challenge requirement is met.

Verify the configured Gemini model is available using current official documentation. Test a real multi-turn conversation, previous-turn context, persisted summaries, safe errors, and reviewed audio transcription. Obtain runtime evidence of Secret Manager access without revealing payloads.

4. Connect private photo, video and voice storage.
   The default configured bucket fifa-502907.firebasestorage.app previously returned 404. The deployment plan proposes fifa-502907-daynote-media. Verify/create the intended private bucket and set STORAGE_BUCKET consistently. Preserve owner-bound object paths, private access, signature/type validation, quotas and authenticated downloads.

Test record → stop → playback → save → reload → explicitly request Gemini transcription → edit → save transcript. Test denied microphone permission, interrupted upload/retry, duplicate requests, deletion, and account switching. Retain the microphone request in metadata.json. Check AI Studio iframe/Permissions Policy compatibility with a narrow trusted-origin configuration; do not broadly remove security protections. Recording must remain local until save. Photos/videos currently contribute written captions to AI features; do not claim automatic visual understanding.

5. Connect personal ideas and automatic recaps.
   Verify explicit opt-ins, chosen interests, grounded recommendations and valid source-memory links. Provision the actual Cloud Scheduler OIDC job using a dedicated service account and exact audience. An enabled UI switch is not proof of a scheduler.

Test monthly and yearly completed periods, time zones/year boundaries, accurate counts, disclosed sampling, idempotent retries, source links, user opt-out and the scheduler's real execution logs. Preserve per-user isolation, bounded processing and failure reporting.

6. Complete one evidenced AI Studio enhancement.
   After the core integrations work, add a user's editable “What would I like to carry forward?” closing line to each recap. Save it separately from Gemini's narrative under the verified UID and period. It must survive recap regeneration. Add clear save/error/delete states and two-account isolation tests. Preserve this AI Studio generation history as hackathon evidence.

FINAL ACCEPTANCE
Exercise capture → save → reload → reflect → summarize → personalized idea → monthly/yearly recap → export/delete. Check desktop and a 390 px phone viewport. Run the regression suite, production build, dependency scan and quality analysis again.

Update VERIFICATION.md with PASS / FAIL / BLOCKED and actual evidence for each requirement. Report the deployed URL if deployment succeeded, changed files, real test results, resource names, screenshots without secrets, and exact outstanding manual actions. Do not claim production readiness while live verification or the quality gate remains unresolved.
