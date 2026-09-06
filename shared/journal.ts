export type MemoryKind = "text" | "audio" | "image" | "video";
export interface Memory {
  id: string;
  title: string;
  text: string;
  tags: string[];
  kind: MemoryKind;
  createdAt: string;
  occurredAt: string;
  favorite: boolean;
  media?: { mime: string; size: number; name: string };
}
export interface Preferences {
  interests: string[];
  personalized: boolean;
  automaticRecaps: boolean;
  timezone: string;
}
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
}
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  summary: string;
  updatedAt: string;
}
export interface Recommendation {
  title: string;
  description: string;
  reason: string;
  sourceIds: string[];
}
export interface Recap {
  id: string;
  period: string;
  title: string;
  narrative: string;
  themes: string[];
  sourceIds: string[];
  count: number;
  voiceCount: number;
  createdAt: string;
  sampleSize: number;
}
export const defaultPreferences: Preferences = {
  interests: [],
  personalized: false,
  automaticRecaps: false,
  timezone: "UTC",
};
