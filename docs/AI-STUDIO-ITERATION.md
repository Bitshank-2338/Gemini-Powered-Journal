# AI Studio continuation prompt

Keep the existing security constitution in AI Studio Custom Instructions. Upload the three reference images from docs/design and import the rebuilt branch. Paste the text below into the normal app-building chat.

---

Continue Daynote, a private, voice-first Gemini journal. Treat the attached images as visual references, not proof of implemented behavior. Preserve the midnight-blue design, the source-memory links, and all existing security controls.

Use a repeatable loop: inspect → specify one change → implement → test → inspect the running UI → correct failures → record evidence. Do not call an untested or unconfigured service complete.

First inspect README.md, THREAT_MODEL.md, VERIFICATION.md, shared/journal.ts and the current server and client. Report which four core challenge requirements are verified locally and which remain unverified in the deployed Google project.

Implement this focused original enhancement in AI Studio: **a user's own closing line for each recap**. Let the user answer “What would I like to carry forward?” directly in the recap. Save the answer as the user's words in Firestore under the authenticated UID and recap period. Keep it separate from Gemini-generated narrative and preserve it when a recap is regenerated. Add edit and delete, clear saving/error states, and keyboard/mobile accessibility. Do not add public sharing.

Verification loops:
1. Contract and security: validate IDs and input length; derive UID exclusively from the verified Firebase token; reject cross-account reads and writes. No client Firestore writes, test-token bypasses, or Gemini key in the frontend.
2. Persistence: save a closing line, reload, edit it, reload, then delete it. A failed save must keep the draft and show an error.
3. Regeneration: change an original memory and rebuild the recap; the separately saved closing line must survive.
4. Isolation: user B must never see, modify or delete user A's closing line, even using A's recap period.
5. Visual verification: inspect desktop and a 390 px phone viewport. Match the references' spacing and quiet editorial style. Use the existing design tokens and components.
6. Regression: run type checks, the meaningful security tests, production build and dependency scan. Verify the previous capture → memory → reflection → recap flow still works.

At the end provide the changed files, real test results, screenshots of the running enhancement, and any cloud setup still missing. Preserve this AI Studio conversation and generation history as honest hackathon evidence. Never state that a mocked test proves production isolation, that an enabled UI switch proves a scheduler exists, or that a secret was securely retrieved without runtime evidence.

---
