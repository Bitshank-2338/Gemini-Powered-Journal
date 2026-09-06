# Daynote voice beta

Four Daynote voice labels map to Google voices: Aster/Aoede, Ember/Kore, Orbit/Puck, Cove/Charon. Accent is a model instruction, not a guaranteed regional voice. Choices are remembered on the current device.

- The existing device reader now toggles Stop reading. For natural Gemini audio, use Voice beta > Read latest reply (or Preview voice before a reply exists).
- Live conversation uses Gemini Live with microphone input, streamed output, interruption handling, mute, Stop speaking and End conversation.
- Permission and explicit consent are required. Read-aloud does not request the microphone. Switching conversations or leaving the view releases audio resources.
- Transcripts stay in component memory until the user reviews and saves them as a private text memory. They are not automatically saved or summarized; refresh/navigation discards an unsaved transcript. Saved memories become available on refresh.
- No existing journal records are supplied to Live. Selected read-aloud text is sent only when requested.
- Firebase-authenticated backend issues one-use short-lived tokens through Secret Manager credentials. The actual API key never reaches the browser. Tokens constrain model, instructions, transcription and voice.
- Server reserves three sessions per UTC day per verified UID independently of text quotas. Each token expires after three minutes; the UI also ends at expiry. Failed provisioning can consume a reservation. This is not an application-wide monetary budget.

## Configuration and verification

GEMINI_LIVE_MODEL defaults to gemini-3.1-flash-live-preview. Confirm this model and Live token provisioning are available in the project's Gemini account. No new secret is needed. Use HTTPS or localhost for microphone access. The preview iframe must allow microphone; otherwise open the app in a top-level browser tab.

Local automated coverage checks authentication, consent, allowlisted voices, identity injection rejection and independent per-user limits. Typecheck/build do not prove live audio quality. Live microphone, native voices, accent adherence, interruption, token expiry and transcript saving require an authenticated browser acceptance run after sync; not yet verified against paid Gemini services in this change.

Run one short session: start, speak, interrupt, mute/unmute, Stop speaking, end, review transcript, save and reload memory. Confirm microphone indicator disappears. Repeat a read-only preview without microphone permission. Check denied mic, network disconnect, mobile layout and navigation cleanup. Do not mark pending steps PASS from code inspection.

Sources: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens and https://ai.google.dev/gemini-api/docs/live-api/capabilities
