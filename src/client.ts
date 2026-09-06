import { auth, onTokenChange, signOutUser } from "./firebase";
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

export function extractSanitizedErrorCode(codeOrMessage: unknown): string {
  if (typeof codeOrMessage === "string") {
    const match = codeOrMessage.match(/auth\/[a-z0-9-]+/i);
    if (match) return match[0];
  }
  if (
    codeOrMessage &&
    typeof codeOrMessage === "object" &&
    "code" in codeOrMessage &&
    typeof (codeOrMessage as { code: unknown }).code === "string"
  ) {
    const code = (codeOrMessage as { code: string }).code;
    if (/^auth\/[a-z0-9-]+$/i.test(code)) return code;
  }
  return "auth/id-token-expired";
}

type AuthExpiredListener = (code: string, message: string) => void;
const authExpiredListeners = new Set<AuthExpiredListener>();

export function subscribeAuthExpired(listener: AuthExpiredListener): () => void {
  authExpiredListeners.add(listener);
  return () => authExpiredListeners.delete(listener);
}

function notifyAuthExpired(code: string, message: string) {
  for (const listener of authExpiredListeners) {
    try {
      listener(code, message);
    } catch {
      // Ignore listener error
    }
  }
}

// 1. Track current token with onIdTokenChanged
let trackedIdToken: string | null = null;
onTokenChange(async (user) => {
  if (user) {
    try {
      trackedIdToken = await user.getIdToken();
    } catch {
      trackedIdToken = null;
    }
  } else {
    trackedIdToken = null;
  }
});

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to save your journal.");

  // 2. Before protected requests, call currentUser.getIdToken()
  let token = await user.getIdToken();
  trackedIdToken = token;

  const binary = body instanceof Blob;
  let response = await fetch("/api" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      ...(body
        ? { "Content-Type": binary ? (body as Blob).type : "application/json" }
        : {}),
    },
    body: body ? (binary ? (body as Blob) : JSON.stringify(body)) : undefined,
  });

  // 3. If a request returns HTTP 401, refresh once with getIdToken(true) and retry once
  if (response.status === 401 && auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken(true);
      trackedIdToken = token;
      response = await fetch("/api" + path, {
        method,
        headers: {
          Authorization: "Bearer " + token,
          ...(body
            ? { "Content-Type": binary ? (body as Blob).type : "application/json" }
            : {}),
        },
        body: body ? (binary ? (body as Blob) : JSON.stringify(body)) : undefined,
      });
    } catch {
      // Force refresh attempt threw
    }
  }

  // 4. If the retry fails with 401, sign out locally and display sanitized error code
  if (response.status === 401) {
    const categoryHeader = response.headers.get("X-Auth-Error-Category");
    const bodyJson = await response.json().catch(() => ({}));
    const rawCategory = categoryHeader || bodyJson.error || "auth/id-token-expired";
    const sanitizedCode = extractSanitizedErrorCode(rawCategory);
    await signOutUser().catch(() => {});
    notifyAuthExpired(sanitizedCode, "Your sign-in expired. Please sign in again.");
    throw new Error(`Your sign-in expired (${sanitizedCode}). Please sign in again.`);
  }

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

  // 2. Before protected requests, call currentUser.getIdToken()
  let token = await user.getIdToken();
  trackedIdToken = token;

  let response = await fetch("/api/memories/" + id + "/media", {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
  });

  // 3. If 401, refresh once with getIdToken(true) and retry once
  if (response.status === 401 && auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken(true);
      trackedIdToken = token;
      response = await fetch("/api/memories/" + id + "/media", {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
    } catch {
      // Force refresh threw
    }
  }

  // 4. If retry fails with 401, sign out locally
  if (response.status === 401) {
    const categoryHeader = response.headers.get("X-Auth-Error-Category");
    const bodyJson = await response.json().catch(() => ({}));
    const rawCategory = categoryHeader || bodyJson.error || "auth/id-token-expired";
    const sanitizedCode = extractSanitizedErrorCode(rawCategory);
    await signOutUser().catch(() => {});
    notifyAuthExpired(sanitizedCode, "Your sign-in expired. Please sign in again.");
    throw new Error(`Your sign-in expired (${sanitizedCode}). Please sign in again.`);
  }

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

