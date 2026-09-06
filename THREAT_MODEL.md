# Daynote threat model

## Assets and boundaries

Private journal words, recordings, photos, videos, summaries, interests and recaps; Firebase identity tokens; the Gemini key. Browser → authenticated API → Firestore/Cloud Storage. API → Secret Manager → Gemini. Scheduler → independently verified OIDC endpoint.

## Controls implemented

| Threat | Control |
|---|---|
| Browser-supplied user ID / path traversal | UID comes exclusively from Firebase Admin verification; identifiers use a restrictive allowlist; request schemas reject extra fields. |
| Cross-account reads and AI context leakage | Every path is rooted under the verified UID; selected source memories are individually loaded from that root; tests attack reads, uploads, deletes, exports and AI sources. |
| Private key exposure | Server accesses an explicit Secret Manager version; no Gemini key in frontend environment, browser requests, logs or committed config. Firebase browser config remains public by design. |
| Forged development credentials | No NODE_ENV-based token bypass; synthetic identities exist only in the injected test fixture. |
| Unsafe file uploads | 25 MB parser limit; file-signature detection; restricted media formats; memory-category check; owner-bound object path; no active HTML/SVG uploads. |
| Public media links | Authenticated server download; private no-store responses; no public Firebase download tokens; private bucket IAM/PAP in deployment plan. |
| Duplicate/concurrent operations | Per-user transactional lease, deterministic IDs, duplicate message detection, attachment hash verification, atomic conversation+summary document. |
| AI prompt injection | Memory content treated as untrusted data, no autonomous tools/actions, bounded inputs, schema-parsed JSON, citation IDs filtered to submitted sources. |
| Unbounded cost and resource use | Shared Firestore rate counters, memory/media/account limits, bounded conversation size, maximum request size, bounded recap sampling and scheduler batches. |
| XSS / leaking error data | React renders AI/user output as plain text, no raw HTML; restrictive production CSP; generic cloud errors; no personal payload logging. |
| Account changes and local residue | User-keyed React remount, response identity check, media object-URL revocation, recorder track cleanup; journal content is not persisted in localStorage. |
| Unexpected AI processing | Voice transcription requires explicit confirmation; personal ideas and automatic recaps require separate opt-ins. |
| Inaccurate recaps | Counts computed by server; sampled narrative disclosed; source links; only completed calendar periods. |
| Stale derived content | Semantic edits/deletes clear recaps and recommendations; changing timezone clears recaps. |

## Remaining release risks

Application tests use injected service doubles. They prove routing behavior, not deployed IAM or Firebase rules. Real two-user, media, token-revocation and scheduler tests remain mandatory. No malware-scanning/transcoding pipeline is included; formats are checked but media is still untrusted. This release buffers media up to 25 MB, so deployment concurrency is deliberately bounded. No end-to-end encryption, comprehensive account erasure, queued large-scale recap processing or independent security audit is claimed.

A process crash can leave an operation lease for up to ten minutes. An interrupted upload can leave an orphan object if the process dies between storage and metadata writes; failed writes perform best-effort cleanup, and retries with the same memory ID and content hash can recover uploaded objects. Orphans with no later retry still need reconciliation. Add lifecycle reconciliation before scaling. Deleting original memories does not redact passages already copied into separate conversations; the UI explains that those conversations must be removed separately.

## Dependency overrides

qs is pinned to 6.16.0 and uuid to 11.1.1 through npm overrides to resolve the advisories found in upstream dependency trees. Keep the lockfile and rerun audit, build and tests when upgrading. The uuid patch retains CommonJS support required by upstream Google clients; avoid blindly applying npm audit's suggested Firebase Admin downgrade.
