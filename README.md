# Daynote

A voice-first private Gemini journal for the words, photos, videos and small moments you want to keep.

## Run locally

Requires Node 22.16+.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Choose **Explore the design** for a clearly labelled, read-only fictional journal. Preview mode does not authenticate API requests, persist sample memories, or simulate Gemini responses.

For real accounts, follow [Google Cloud setup](docs/CLOUD-SETUP.md). Local backend access requires Application Default Credentials. A Cloud Run service uses its attached service identity instead of a downloaded service-account key.

## What is implemented

- Firebase Google sign-in and server verification, including revoked-token checks.
- Voice recording with review/playback before save; explicit Gemini transcription, editable before committing.
- Private text, photo, video and audio memories; titles, captions, dates, tags, favourites and search.
- Private original-media playback/download via authenticated requests, without public download tokens.
- Multi-turn Gemini conversations with automatically persisted summaries and selected source memories.
- Optional personalized ideas based on explicit interests and the latest 40 written memories; source links and explanations.
- Optional automatic monthly/yearly recaps: actual counts, themes, source memories, JSON download, and follow-up reflection.
- On-this-day resurfacing, export and deletion. Earlier conversations using the previous subcollection schema remain readable.
- Midnight-blue desktop/mobile UI, keyboard focus containment in dialogs and reduced-motion support.

## Limits and honest boundaries

- One media file per memory, up to 25 MB; up to five minutes of browser-recorded audio. Each account is limited to 2,000 memories, 300 conversations and 500 MB of attachments.
- Gemini understands submitted voice recordings and saved words. Photo/video captions enter recommendations and recaps; automatic visual/video understanding is not implemented.
- Recap narratives use at most 120 memories sampled across the period. Counts include all memories. The UI discloses sampling.
- Cloud Scheduler processes up to 10 opted-in accounts per run, oldest checkpoint first; login also catches up the last completed month/year. This is a bounded initial-release design; scale with queues and indexed pagination before expanding substantially.
- Google services must be configured before real saving/AI can be verified. This repository is not evidence of a successful production deployment.
- Account isolation is not end-to-end encryption. Cloud services process submitted content.
- Deleting a memory clears derived recaps/ideas. Any text already included in separate conversations remains until those conversations are deleted.
- Journal JSON exports do not bundle media; originals download separately.

## Verify

```sh
npm run lint
npm test
npm run build
npm audit
```

See [verification evidence and release checklist](VERIFICATION.md), [threat model](THREAT_MODEL.md), and [AI Studio iteration prompt](docs/AI-STUDIO-ITERATION.md).

## Design

[Desktop reference](docs/design/01-desktop.png) · [Mobile reference](docs/design/02-mobile.png) · [Recap reference](docs/design/03-recaps.png)

References were generated before implementation. The fictional coastal photo in the preview is AI-generated. Real accounts never receive these example memories.
