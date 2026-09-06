import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { Server } from "node:http";
import {
  createJournalRouter,
  completedPeriods,
  calendarPeriod,
  sampleMemories,
  type Dependencies,
} from "../server/journalRouter";
import type { Store } from "../server/store";
import type { Memory } from "../shared/journal";

// Fakes exist only in this test. No environment variable or magic token enables them in the app.
class MemoryStore implements Store {
  data = new Map<string, any>();
  async get(path: string) {
    return structuredClone(this.data.get(path) || null);
  }
  async list(path: string) {
    return [...this.data]
      .filter(
        ([k]) =>
          k.startsWith(path + "/") &&
          k.split("/").length === path.split("/").length + 1,
      )
      .map(([k, v]) => ({ ...structuredClone(v), id: k.split("/").at(-1) }));
  }
  async set(path: string, value: any) {
    this.data.set(path, structuredClone(value));
  }
  async remove(path: string) {
    this.data.delete(path);
  }
  async transact<T>(
    path: string,
    fn: (old: any) => { value?: any; result: T },
  ) {
    const r = fn(structuredClone(this.data.get(path) || null));
    if (r.value !== undefined) this.data.set(path, structuredClone(r.value));
    return r.result;
  }
}
const db = new MemoryStore(),
  blobs = new Map<string, Buffer>();
let aiCalls = 0;
let failAI = false;
let chatGate: Promise<void> | null = null;
const dependencies: Dependencies = {
  store: db,
  now: () => new Date("2026-09-06T00:30:00Z"),
  verify: async (token) => {
    if (!["alice", "bob"].includes(token)) throw new Error("invalid");
    return token;
  },
  verifyScheduler: async (token) => {
    if (token !== "scheduler") throw new Error("invalid");
  },
  media: {
    async save(path, bytes) {
      blobs.set(path, bytes);
    },
    async read(path) {
      const b = blobs.get(path);
      if (!b) throw new Error("not found");
      return b;
    },
    async remove(path) {
      blobs.delete(path);
    },
  },
  ai: {
    async chat(messages, memories) {
      aiCalls++;
      if (chatGate) await chatGate;
      if (failAI) throw new Error("sensitive SDK details must not escape");
      return {
        reply: "A thoughtful response to " + messages.at(-1)!.content,
        summary: "Summary with " + memories.length + " sources",
      };
    },
    async transcribe() {
      aiCalls++;
      return "A reviewed transcript.";
    },
    async recommend(memories) {
      aiCalls++;
      return [
        {
          title: "An idea",
          description: "Try a walk",
          reason: "Your interest in outdoors",
          sourceIds: memories.slice(0, 1).map((m) => m.id),
        },
      ];
    },
    async recap(memories, period) {
      aiCalls++;
      return {
        title: "A quieter " + period,
        narrative: "A grounded reflection",
        themes: ["Outdoors"],
        sourceIds: memories.slice(0, 1).map((m) => m.id),
      };
    },
  },
};
let server: Server, base: string;
before(async () => {
  const app = express();
  app.use(express.json({ limit: "200kb" }));
  app.use("/api", createJournalRouter(dependencies));
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const a = server.address() as { port: number };
  base = "http://127.0.0.1:" + a.port + "/api";
});
after(
  () =>
    new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    ),
);
async function request(
  path: string,
  method = "GET",
  body?: any,
  user = "alice",
) {
  const binary = Buffer.isBuffer(body);
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(user ? { Authorization: "Bearer " + user } : {}),
      ...(body
        ? { "Content-Type": binary ? "image/png" : "application/json" }
        : {}),
    },
    body: body ? (binary ? body : JSON.stringify(body)) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  return {
    status: response.status,
    body: contentType.includes("json")
      ? await response.json()
      : Buffer.from(await response.arrayBuffer()),
  };
}
const memory = (id: string, overrides: any = {}) => ({
  id,
  title: "A quiet walk",
  text: "An evening outdoors.",
  tags: ["outdoors"],
  kind: "text",
  occurredAt: "2026-08-24T12:00:00Z",
  favorite: false,
  ...overrides,
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR+0AAAAASUVORK5CYII=",
  "base64",
);
test("private endpoints reject absent and forged authentication", async () => {
  assert.equal((await request("/journal", "GET", undefined, "")).status, 401);
  assert.equal(
    (await request("/journal", "GET", undefined, "test-token-alice")).status,
    401,
  );
  assert.equal((await request("/health", "GET", undefined, "")).status, 200);
});
test("a saved memory and export are scoped to the verified account", async () => {
  assert.equal(
    (await request("/memories/m1", "PUT", memory("m1"))).status,
    200,
  );
  assert.equal((await request("/journal")).body.memories.length, 1);
  assert.equal(
    (await request("/journal", "GET", undefined, "bob")).body.memories.length,
    0,
  );
  assert.equal(
    (await request("/export", "GET", undefined, "bob")).body.memories.length,
    0,
  );
  assert.equal(
    (await request("/memories/m1", "DELETE", undefined, "bob")).status,
    404,
  );
  assert.ok(await db.get("users/alice/memories/m1"));
});
test("the client cannot select another user or inject storage fields", async () => {
  assert.equal(
    (await request("/memories/bad", "PUT", memory("bad", { uid: "bob" })))
      .status,
    400,
  );
  assert.equal(
    (
      await request(
        "/memories/bad",
        "PUT",
        memory("bad", { media: { mime: "image/png" } }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("/memories/a%2Fb", "PUT", memory("a/b"))).status,
    400,
  );
  assert.equal(
    (await request("/memories/wrong", "PUT", memory("other"))).status,
    400,
  );
});
test("uploads validate file contents, bind ownership and support safe retries", async () => {
  await request("/memories/photo", "PUT", memory("photo", { kind: "image" }));
  assert.equal(
    (
      await request(
        "/memories/photo/media",
        "PUT",
        Buffer.from("<script>bad</script>"),
      )
    ).status,
    415,
  );
  assert.equal(
    (await request("/memories/photo/media", "PUT", png, "bob")).status,
    404,
  );
  assert.equal(
    (await request("/memories/photo/media", "PUT", png)).status,
    200,
  );
  assert.equal(
    (await request("/memories/photo/media", "PUT", png)).status,
    200,
  );
  assert.equal(
    (await request("/memories/photo/media", "GET", undefined, "bob")).status,
    404,
  );
  assert.deepEqual((await request("/memories/photo/media")).body, png);
  assert.equal(blobs.size, 1);
});
test("wrong media category and oversized uploads are rejected", async () => {
  await request("/memories/audio", "PUT", memory("audio", { kind: "audio" }));
  assert.equal(
    (await request("/memories/audio/media", "PUT", png)).status,
    415,
  );
  assert.equal(
    (
      await request(
        "/memories/photo/media",
        "PUT",
        Buffer.alloc(25 * 1024 * 1024 + 1),
      )
    ).status,
    413,
  );
});
test("Gemini only receives source memories from the authenticated user", async () => {
  const before = aiCalls;
  assert.equal(
    (
      await request(
        "/conversations/c1/messages",
        "POST",
        { id: "msg1", content: "Think with me", sourceIds: ["m1"] },
        "bob",
      )
    ).status,
    404,
  );
  assert.equal(aiCalls, before);
  const result = await request("/conversations/c1/messages", "POST", {
    id: "msg1",
    content: "Think with me",
    sourceIds: ["m1"],
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.messages.length, 2);
  assert.equal(result.body.summary, "Summary with 1 sources");
  assert.equal(
    (await request("/journal", "GET", undefined, "bob")).body.conversations
      .length,
    0,
  );
});
test("retries do not duplicate a conversation turn or charge Gemini again", async () => {
  const before = aiCalls;
  const r = await request("/conversations/c1/messages", "POST", {
    id: "msg1",
    content: "Think with me",
    sourceIds: ["m1"],
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.messages.length, 2);
  assert.equal(aiCalls, before);
});
test("two simultaneous turns cannot overwrite each other", async () => {
  let unlock!: () => void;
  chatGate = new Promise<void>((resolve) => (unlock = resolve));
  const first = request("/conversations/c1/messages", "POST", {
    id: "msg2",
    content: "Next thought",
    sourceIds: [],
  });
  for (let i = 0; i < 100; i++) {
    if ((await db.get("users/alice/locks/journal"))?.until) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  const second = await request("/conversations/c1/messages", "POST", {
    id: "msg3",
    content: "Concurrent thought",
    sourceIds: [],
  });
  assert.equal(second.status, 409);
  unlock();
  chatGate = null;
  assert.equal((await first).status, 200);
});
test("AI failures expose no secret details and preserve the previous conversation", async () => {
  failAI = true;
  const r = await request("/conversations/c1/messages", "POST", {
    id: "failed",
    content: "Unsaved message",
    sourceIds: [],
  });
  assert.equal(r.status, 503);
  assert.ok(!JSON.stringify(r.body).includes("sensitive SDK"));
  assert.equal(
    (await db.get("users/alice/conversations/c1")).messages.length,
    4,
  );
  assert.equal((await db.get("users/alice/locks/journal")).until, 0);
  failAI = false;
});
test("recommendations need explicit opt-in and remain account isolated", async () => {
  assert.equal((await request("/recommendations", "POST", {})).status, 403);
  const prefs = {
    interests: ["Outdoors"],
    personalized: true,
    automaticRecaps: true,
    timezone: "Asia/Kolkata",
  };
  assert.equal((await request("/preferences", "PUT", prefs)).status, 200);
  assert.equal((await request("/recommendations", "POST", {})).status, 200);
  assert.equal(
    (await request("/journal", "GET", undefined, "bob")).body.recommendations
      .length,
    0,
  );
  assert.equal(
    (
      await request("/preferences", "PUT", {
        ...prefs,
        timezone: "MadeUp/Nowhere",
      })
    ).status,
    400,
  );
});
test("calendar logic handles timezone and year boundaries", () => {
  assert.equal(
    calendarPeriod(new Date("2026-01-01T00:30:00Z"), "America/Los_Angeles"),
    "2025-12",
  );
  assert.deepEqual(completedPeriods(new Date("2026-01-01T12:00:00Z"), "UTC"), [
    "2025-12",
    "2025",
  ]);
  const ms = Array.from(
    { length: 240 },
    (_, i) =>
      ({
        ...memory(String(i)),
        createdAt: new Date(i * 86400000).toISOString(),
        occurredAt: new Date(i * 86400000).toISOString(),
      }) as Memory,
  );
  const sample = sampleMemories(ms);
  assert.equal(sample.length, 120);
  assert.equal(sample[0].id, "0");
  assert.equal(sample.at(-1)!.id, "239");
});
test("recaps use real counts, completed periods, and idempotent IDs", async () => {
  const before = aiCalls;
  const r = await request("/recaps/2026-08", "POST", {});
  assert.equal(r.status, 200);
  assert.equal(r.body.count, 3);
  assert.equal(r.body.voiceCount, 1);
  assert.equal((await request("/recaps/2026-08", "POST", {})).status, 200);
  assert.equal(aiCalls, before + 1);
  assert.equal((await request("/recaps/2026-09", "POST", {})).status, 400);
  assert.equal((await request("/recaps/2026", "POST", {})).status, 400);
  assert.equal(
    (await request("/recaps/2026-08", "POST", {}, "bob")).status,
    404,
  );
});
test("only scheduler identity can invoke automatic recaps", async () => {
  assert.equal(
    (await request("/jobs/recaps", "POST", {}, "alice")).status,
    403,
  );
  assert.equal((await request("/jobs/recaps", "POST", {}, "")).status, 401);
  assert.equal(
    (await request("/jobs/recaps", "POST", {}, "scheduler")).status,
    200,
  );
  assert.ok((await db.get("users/alice")).lastRecapCheck);
});
test("deleting a memory removes media and invalidates derived output", async () => {
  assert.equal((await request("/memories/photo", "DELETE")).status, 204);
  assert.equal(blobs.size, 0);
  assert.equal((await request("/journal")).body.recaps.length, 0);
  assert.equal((await request("/journal")).body.recommendations.length, 0);
});
test("transcription requires affirmative consent and an owned voice recording", async () => {
  assert.equal(
    (await request("/memories/audio/transcribe", "POST", {})).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/memories/audio/transcribe",
        "POST",
        { consent: true },
        "bob",
      )
    ).status,
    404,
  );
  assert.equal(
    (await request("/memories/m1/transcribe", "POST", { consent: true }))
      .status,
    400,
  );
});
test("legacy conversations remain readable and delete their old subcollections", async () => {
  await db.set("users/bob/conversations/legacy", {
    id: "legacy",
    title: "Earlier reflection",
    updatedAt: "2026-08-01T00:00:00Z",
  });
  await db.set("users/bob/conversations/legacy/messages/old", {
    role: "user",
    content: "Keep my earlier journal",
    createdAt: "2026-08-01T00:00:00Z",
  });
  await db.set("users/bob/conversations/legacy/summaries/current", {
    summary: "Earlier summary",
  });
  const result = (await request("/journal", "GET", undefined, "bob")).body
    .conversations[0];
  assert.equal(result.messages[0].content, "Keep my earlier journal");
  assert.equal(result.summary, "Earlier summary");
  assert.equal(
    (await request("/conversations/legacy", "DELETE", undefined, "bob")).status,
    204,
  );
  assert.equal(
    await db.get("users/bob/conversations/legacy/messages/old"),
    null,
  );
});
test("rate limits apply across requests using the shared store", async () => {
  for (let i = 0; i < 40; i++)
    await request(
      "/preferences",
      "PUT",
      {
        interests: [],
        personalized: false,
        automaticRecaps: false,
        timezone: "UTC",
      },
      "bob",
    );
  assert.equal(
    (
      await request(
        "/preferences",
        "PUT",
        {
          interests: [],
          personalized: false,
          automaticRecaps: false,
          timezone: "UTC",
        },
        "bob",
      )
    ).status,
    429,
  );
});
