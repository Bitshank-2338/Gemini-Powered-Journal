import { auth } from "./firebase";
import type {
  Memory,
  Conversation,
  Preferences,
  Recap,
  Recommendation,
} from "../shared/journal";
export interface JournalData {
  memories: Memory[];
  conversations: Conversation[];
  preferences: Preferences;
  recaps: Recap[];
  recommendations: Recommendation[];
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to save your journal.");
  const token = await user.getIdToken();
  const binary = body instanceof Blob;
  const response = await fetch("/api" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      ...(body
        ? { "Content-Type": binary ? (body as Blob).type : "application/json" }
        : {}),
    },
    body: body ? (binary ? (body as Blob) : JSON.stringify(body)) : undefined,
  });
  if (auth.currentUser?.uid !== user.uid)
    throw new Error("Your account changed. Please try again.");
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(
      result.error || "Unable to complete this request. Please try again.",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export async function mediaBlob(id: string): Promise<Blob> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to open this attachment.");
  const token = await user.getIdToken();
  const response = await fetch("/api/memories/" + id + "/media", {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("This attachment could not be loaded.");
  if (auth.currentUser?.uid !== user.uid)
    throw new Error("Your account changed.");
  return response.blob();
}
export function download(value: Blob | object, filename: string) {
  const blob =
    value instanceof Blob
      ? value
      : new Blob([JSON.stringify(value, null, 2)], {
          type: "application/json",
        });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
