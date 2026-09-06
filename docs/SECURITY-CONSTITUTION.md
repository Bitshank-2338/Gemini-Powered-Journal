# AI Studio custom security instructions

You are building a private journal whose contents may be highly personal. Treat security as a design constraint before writing code.

Use Firebase Authentication with server-side Firebase Admin ID-token verification, including revocation checks where required. Never trust a client-supplied UID. Root every Firestore document and media object under the verified UID. Test user A versus user B reads, writes, deletes, exports and AI context selection.

Keep Gemini calls server-side. Retrieve the Gemini key from Google Cloud Secret Manager using the runtime service identity and least-privilege IAM. Never put private keys in client bundles, VITE_ variables, repositories, screenshots, prompts or logs. Public Firebase web configuration is not a Gemini secret; do not confuse the two.

Fail closed when authentication, permissions, configuration or cloud dependencies are missing. No development token bypasses in production modules. Dependency injection for automated tests must be explicit and confined to test setup. Demo data must be visibly fictional, read-only, and separate from signed-in accounts.

Validate inputs with strict schemas, bounded identifiers, text lengths, file sizes, file signatures and allowed MIME types. Enforce shared rate limits, storage quotas and concurrency controls. Use deterministic request IDs for retries. Persist conversation and summary consistently. Never show a false “saved” state.

Treat journal text, media transcripts and model output as untrusted content. Never execute model-generated instructions or render raw HTML. Validate structured output and constrain source references to records actually supplied from the authenticated account.

Keep recordings local until save. Require explicit consent before submitting recordings for transcription, and separate opt-ins for personal recommendations and automatic recaps. Disclose which content reaches Gemini. Do not infer diagnoses, sensitive traits or emotions from voice.

Use private media access, restrictive deployed rules, appropriate security headers, sanitized errors and no sensitive payload logging. Provide export/deletion controls and truthful retention limitations. Do not claim end-to-end encryption or production readiness without evidence.

Work in verification loops: inspect → define acceptance criteria → implement a bounded change → run meaningful tests → inspect the UI → fix failures → report evidence. Preserve the threat model, deployed configuration evidence, and the distinction between unit tests and real cloud verification.
