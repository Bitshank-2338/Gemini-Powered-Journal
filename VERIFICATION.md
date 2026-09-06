# Verification ledger — September 6, 2026

## Local evidence

- TypeScript checks passed.
- Production frontend/server build passed (ES module server).
- 17 injected-service API/security tests passed.
- npm audit reported zero known vulnerabilities after updating qs and uuid through explicit overrides.
- Chrome desktop and 390 × 844 mobile preview inspected.
- Voice capture, recap source navigation, memory-to-reflection context, and preview mutation rejection checked in the browser.
- Preview uses fictional sample content and an illustrative AI-generated coast photo. It is not an authenticated integration test.
- Local production server smoke test: health returned 200, unauthenticated journal request returned 401, and CSP header was present.
- Deployment script syntax and its no-change planning mode passed.
- Staged source scan found no newly introduced credential patterns; private cloud setup remains pending.

## Required live release loop

Use two disposable Google accounts and synthetic memories, not real private journal content.

| Loop | Acceptance evidence | Status |
|---|---|---|
| Firebase sign-in | A and B can independently sign in and out on the deployed hostname. | Pending |
| Token enforcement | Missing, expired, forged and revoked tokens rejected; auth-required errors are readable. | Local routing verified; cloud pending |
| Firestore isolation | A's real memory/chat/summary persists after reload. B cannot list/read/update/delete/export it through API or direct Firestore requests. | Local routing verified; cloud pending |
| Private attachments | Save and download a photo, video and voice recording. B gets no access using A's ID. Public bucket/direct storage access denied. | Local validation verified; cloud pending |
| Interrupted upload | Interrupt after written memory creation, retry with same ID and bytes, verify one attachment and clear status. | Local idempotency verified; browser/cloud pending |
| Real Gemini | A two-turn conversation references the first turn and saves its summary. No synthetic fallback response appears on API failure. | Pending |
| Voice | Allow microphone, record, stop, listen, discard; then record/save/transcribe/review/save. No upload before save and no Gemini request before consent. | UI inspected; hardware/cloud pending |
| Personal ideas | Opt-in off blocks requests; opt-in on returns relevant ideas with source links scoped to A. | Local routing verified; cloud pending |
| Monthly/yearly recaps | Backdate synthetic memories in completed periods. Check counts, sample disclosure, source links, idempotent refresh and time zones. | Local logic verified; cloud pending |
| Scheduler | Authenticated OIDC job runs with opted-in accounts and durable checkpoints; wrong identity/audience fails. | Local auth injection verified; cloud OIDC pending |
| Secret Manager | Runtime identity accesses only the named secret. Capture audit evidence without payloads. No private Gemini key in frontend assets or browser requests. | Server retrieval implemented; cloud pending |
| Privacy lifecycle | Account switch clears old data, stops recording and releases blob URLs; memory deletion removes originals/derived recaps; conversations deleted separately. | Implementation checked; live two-account pending |
| Hackathon provenance | Screenshot Custom Instructions; preserve an original enhancement implemented in AI Studio using docs/AI-STUDIO-ITERATION.md. | Pending |

No production-grade or zero-leakage certification is claimed from passing local tests alone.
