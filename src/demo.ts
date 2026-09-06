import type { JournalData } from "./client";
export const demoData: JournalData = {
  preferences: {
    interests: ["Photography", "Slow weekends", "Creative work"],
    personalized: true,
    automaticRecaps: true,
    timezone: "Asia/Kolkata",
  },
  memories: [
    {
      id: "demo-coast",
      title: "Blue hour on the coast",
      text: "Took the long way home. The ocean was almost the same colour as the sky. I want to make more room for afternoons like this.",
      tags: ["photography", "outdoors"],
      kind: "image",
      createdAt: "2026-09-05T14:00:00Z",
      occurredAt: "2026-09-05T14:00:00Z",
      favorite: true,
      media: {
        mime: "image/png",
        size: 0,
        name: "Illustrative AI-generated photograph",
      },
    },
    {
      id: "demo-voice",
      title: "Coffee, ideas, a fresh start",
      text: "A thought for tomorrow: keep a small notebook beside my coffee. Good ideas seem to show up when I stop looking for them.",
      tags: ["creative work", "small rituals"],
      kind: "audio",
      createdAt: "2026-09-04T08:00:00Z",
      occurredAt: "2026-09-04T08:00:00Z",
      favorite: false,
    },
    {
      id: "demo-note",
      title: "Things I want to remember",
      text: "The first cool morning. A book that made me miss my train. An unhurried conversation. Nothing extraordinary, except all of it.",
      tags: ["gratitude"],
      kind: "text",
      createdAt: "2026-09-03T08:00:00Z",
      occurredAt: "2026-09-03T08:00:00Z",
      favorite: false,
    },
    {
      id: "demo-old",
      title: "A little more outside",
      text: "An evening walk without a destination. I took my camera and noticed the shape of the light.",
      tags: ["photography", "outdoors"],
      kind: "text",
      createdAt: "2026-08-24T08:00:00Z",
      occurredAt: "2026-08-24T08:00:00Z",
      favorite: false,
    },
  ],
  conversations: [],
  recommendations: [
    {
      title: "Take the scenic route.",
      description:
        "Give yourself twenty minutes, a camera, and no destination. Find one thing you would usually walk past.",
      reason: "Inspired by your interest in photography and your coastal walk.",
      sourceIds: ["demo-coast"],
    },
    {
      title: "A ritual for your ideas",
      description:
        "Leave a notebook next to tomorrow’s coffee. Write the first three things that come to mind.",
      reason: "A small experiment inspired by your voice note.",
      sourceIds: ["demo-voice"],
    },
  ],
  recaps: [
    {
      id: "2026-08",
      period: "2026-08",
      title: "The month you made room.",
      narrative:
        "An evening walk became a reason to notice the light. Your August memory points to a small ritual worth carrying forward: step outside, bring your camera, and leave the destination open.",
      themes: ["Photography", "Time outdoors"],
      sourceIds: ["demo-old"],
      count: 1,
      voiceCount: 0,
      sampleSize: 1,
      createdAt: "2026-09-01T00:00:00Z",
    },
  ],
};
