import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomUUID, createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import type { Store } from "./store";
import type { JournalAI } from "./ai";
import {
  defaultPreferences,
  type Memory,
  type Preferences,
  type Conversation,
  type Recap,
} from "../shared/journal";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export interface MediaStore {
  save(path: string, bytes: Buffer, mime: string): Promise<void>;
  read(path: string): Promise<Buffer>;
  remove(path: string): Promise<void>;
}
export interface Dependencies {
  store: Store;
  ai: JournalAI;
  media: MediaStore;
  verify(token: string): Promise<string>;
  verifyScheduler(token: string): Promise<void>;
  now?: () => Date;
}
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const memorySchema = z
  .object({
    id: idSchema,
    title: z.string().trim().min(1).max(180),
    text: z.string().max(20000),
    tags: z.array(z.string().trim().min(1).max(40)).max(12),
    kind: z.enum(["text", "audio", "image", "video"]),
    occurredAt: z.iso.datetime(),
    favorite: z.boolean().default(false),
  })
  .strict();
const preferenceSchema = z
  .object({
    interests: z.array(z.string().trim().min(1).max(50)).max(12),
    personalized: z.boolean(),
    automaticRecaps: z.boolean(),
    timezone: z
      .string()
      .max(100)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }),
  })
  .strict();
const allowedMime = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
]);
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
export function calendarPeriod(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return (
    parts.find((p) => p.type === "year")!.value +
    "-" +
    parts.find((p) => p.type === "month")!.value
  );
}
export function completedPeriods(date: Date, timezone: string) {
  const [y, m] = calendarPeriod(date, timezone).split("-").map(Number);
  return [
    m === 1 ? y - 1 + "-12" : y + "-" + String(m - 1).padStart(2, "0"),
    String(y - 1),
  ];
}
export function inPeriod(memory: Memory, period: string, timezone: string) {
  return calendarPeriod(new Date(memory.occurredAt), timezone).startsWith(
    period,
  );
}
export function sampleMemories(memories: Memory[], limit = 120) {
  const sorted = [...memories].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt),
  );
  return sorted.length <= limit
    ? sorted
    : Array.from(
        { length: limit },
        (_, i) => sorted[Math.floor((i * (sorted.length - 1)) / (limit - 1))],
      );
}
export function createJournalRouter(d: Dependencies) {
  const router = express.Router();
  const now = () => d.now?.() || new Date();
  const path = (uid: string, collection: string, id?: string) =>
    "users/" + uid + "/" + collection + (id ? "/" + id : "");
  const mediaPath = (uid: string, id: string) =>
    "users/" + uid + "/memories/" + id + "/original";
  const wrap =
    (fn: (req: Request, res: Response) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res)).catch(next);
    };
  async function rate(uid: string, ai = false) {
    const period = Math.floor(now().getTime() / (ai ? 3600000 : 60000));
    const key = path(uid, "limits", ai ? "ai" : "write");
    await d.store.transact(key, (old) => {
      const count = old?.period === period ? old.count + 1 : 1;
      if (count > (ai ? 30 : 40))
        throw new HttpError(
          429,
          ai
            ? "Your hourly Gemini limit is reached. Please try later."
            : "Please wait a moment before trying again.",
        );
      return { value: { period, count }, result: null };
    });
  }
  async function locked<T>(uid: string, fn: () => Promise<T>): Promise<T> {
    const lockPath = path(uid, "locks", "journal");
    const token = randomUUID();
    await d.store.transact(lockPath, (old) => {
      if (old?.until > now().getTime())
        throw new HttpError(
          409,
          "Another save is in progress. Please try again in a moment.",
        );
      return {
        value: { token, until: now().getTime() + 600000 },
        result: null,
      };
    });
    try {
      return await fn();
    } finally {
      await d.store.transact(lockPath, (old) =>
        old?.token === token
          ? { value: { until: 0 }, result: null }
          : { result: null },
      );
    }
  }
  async function memories(uid: string): Promise<Memory[]> {
    return (await d.store.list(path(uid, "memories"))).sort((a, b) =>
      b.occurredAt.localeCompare(a.occurredAt),
    );
  }
  async function requireMemory(uid: string, id: string): Promise<Memory> {
    const m = await d.store.get(path(uid, "memories", id));
    if (!m) throw new HttpError(404, "Memory not found.");
    return m;
  }
  async function normalizeConversation(
    uid: string,
    c: any,
  ): Promise<Conversation> {
    if (Array.isArray(c.messages)) return c;
    const legacy = (
      await d.store.list(path(uid, "conversations", c.id) + "/messages")
    ).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    const summary = await d.store.get(
      path(uid, "conversations", c.id) + "/summaries/current",
    );
    return {
      id: c.id,
      title: c.title || "Earlier reflection",
      messages: legacy.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      })),
      summary: summary?.summary || "",
      updatedAt: c.updatedAt || c.createdAt || now().toISOString(),
    };
  }
  async function clearDerived(uid: string) {
    for (const r of await d.store.list(path(uid, "recaps")))
      await d.store.remove(path(uid, "recaps", r.id));
    await d.store.remove(path(uid, "insights", "recommendations"));
  }
  async function makeRecap(uid: string, period: string): Promise<Recap | null> {
    const existing = await d.store.get(path(uid, "recaps", period));
    if (existing) return existing;
    const prefs: Preferences =
      (await d.store.get(path(uid, "settings", "preferences"))) ||
      defaultPreferences;
    const all = (await memories(uid)).filter((m) =>
      inPeriod(m, period, prefs.timezone),
    );
    if (!all.length) return null;
    await rate(uid, true);
    const sample = sampleMemories(all);
    const generated = await d.ai.recap(sample, period);
    const recap = {
      ...generated,
      id: period,
      period,
      count: all.length,
      voiceCount: all.filter((m) => m.kind === "audio").length,
      sampleSize: sample.length,
      createdAt: now().toISOString(),
    };
    await d.store.set(path(uid, "recaps", period), recap);
    return recap;
  }
  router.get("/health", (_req, res) => res.json({ ok: true }));
  router.post(
    "/jobs/recaps",
    wrap(async (req, res) => {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) throw new HttpError(401, "Authentication required.");
      try {
        await d.verifyScheduler(token);
      } catch {
        throw new HttpError(403, "Scheduler authentication failed.");
      }
      const results: { userProcessed: number; failed: number } = {
        userProcessed: 0,
        failed: 0,
      };
      // Bounded daily batch; each user has a durable checkpoint. Oldest checked first.
      const users = (await d.store.list("users"))
        .filter((u) => u.automaticRecaps)
        .sort((a, b) =>
          (a.lastRecapCheck || "").localeCompare(b.lastRecapCheck || ""),
        )
        .slice(0, 10);
      for (const user of users) {
        try {
          await locked(user.id, async () => {
            const p = await d.store.get(
              path(user.id, "settings", "preferences"),
            );
            if (!p?.automaticRecaps) return;
            for (const period of completedPeriods(now(), p.timezone))
              await makeRecap(user.id, period);
            await d.store.set("users/" + user.id, {
              ...user,
              lastRecapCheck: now().toISOString(),
            });
          });
          results.userProcessed++;
        } catch {
          results.failed++;
          await d.store.transact("users/" + user.id, (old) => ({
            value: {
              ...old,
              lastRecapCheck: now().toISOString(),
              lastRecapErrorAt: now().toISOString(),
            },
            result: null,
          }));
        }
      }
      res.status(results.failed ? 503 : 200).json(results);
    }),
  );
  router.use((req, res, next) => {
    (async () => {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) throw new HttpError(401, "Please sign in to continue.");
      let uid: string;
      try {
        uid = await d.verify(token);
      } catch {
        throw new HttpError(401, "Your sign-in expired. Please sign in again.");
      }
      if (!uid || uid.includes("/"))
        throw new HttpError(401, "Invalid account.");
      res.locals.uid = uid;
      next();
    })().catch(next);
  });
  router.get(
    "/journal",
    wrap(async (_req, res) => {
      const uid = res.locals.uid;
      const [m, p, c, r, insights] = await Promise.all([
        memories(uid),
        d.store.get(path(uid, "settings", "preferences")),
        d.store.list(path(uid, "conversations")),
        d.store.list(path(uid, "recaps")),
        d.store.get(path(uid, "insights", "recommendations")),
      ]);
      const conversations = await Promise.all(
        c.map((c) => normalizeConversation(uid, c)),
      );
      res.json({
        memories: m,
        preferences: p || defaultPreferences,
        conversations: conversations.sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
        recaps: r.sort((a, b) => b.period.localeCompare(a.period)),
        recommendations: insights?.items || [],
      });
    }),
  );
  router.put(
    "/preferences",
    wrap(async (req, res) => {
      const uid = res.locals.uid;
      const preferences = preferenceSchema.parse(req.body);
      await rate(uid);
      await locked(uid, async () => {
        const previous = await d.store.get(
          path(uid, "settings", "preferences"),
        );
        await d.store.set(path(uid, "settings", "preferences"), preferences);
        const profile = (await d.store.get("users/" + uid)) || {};
        await d.store.set("users/" + uid, {
          ...profile,
          automaticRecaps: preferences.automaticRecaps,
        });
        await d.store.remove(path(uid, "insights", "recommendations"));
        if (previous && previous.timezone !== preferences.timezone)
          await clearDerived(uid);
      });
      res.json(preferences);
    }),
  );
  router.put(
    "/memories/:id",
    wrap(async (req, res) => {
      const uid = res.locals.uid,
        id = idSchema.parse(req.params.id);
      const input = memorySchema.parse(req.body);
      if (input.id !== id) throw new HttpError(400, "Memory ID mismatch.");
      if (new Date(input.occurredAt).getTime() > now().getTime() + 86400000)
        throw new HttpError(400, "Choose today or an earlier date.");
      await rate(uid);
      const saved = await locked(uid, async () => {
        const previous = await d.store.get(path(uid, "memories", id));
        if (!previous && (await memories(uid)).length >= 2000)
          throw new HttpError(
            413,
            "This journal has reached its 2,000 memory limit. Export or remove older memories.",
          );
        if (previous?.media && previous.kind !== input.kind)
          throw new HttpError(400, "The attachment type cannot change.");
        const value = {
          ...input,
          createdAt: previous?.createdAt || now().toISOString(),
          ...(previous?.media ? { media: previous.media } : {}),
        };
        await d.store.set(path(uid, "memories", id), value);
        if (
          !previous ||
          previous.title !== value.title ||
          previous.text !== value.text ||
          previous.occurredAt !== value.occurredAt ||
          JSON.stringify(previous.tags) !== JSON.stringify(value.tags)
        )
          await clearDerived(uid);
        return value;
      });
      res.json(saved);
    }),
  );
  router.delete(
    "/memories/:id",
    wrap(async (req, res) => {
      const uid = res.locals.uid,
        id = idSchema.parse(req.params.id);
      await rate(uid);
      await locked(uid, async () => {
        const memory = await requireMemory(uid, id);
        if (memory.media) await d.media.remove(mediaPath(uid, id));
        await d.store.remove(path(uid, "memories", id));
        await clearDerived(uid);
      });
      res.status(204).end();
    }),
  );
  router.put(
    "/memories/:id/media",
    express.raw({ type: () => true, limit: MAX_MEDIA_BYTES }),
    wrap(async (req, res) => {
      const uid = res.locals.uid,
        id = idSchema.parse(req.params.id);
      const bytes = req.body;
      if (!Buffer.isBuffer(bytes) || !bytes.length)
        throw new HttpError(400, "Choose a photo, video or audio recording.");
      const detected = await fileTypeFromBuffer(bytes);
      let mime = detected?.mime || "";
      if (mime === "audio/x-m4a") mime = "audio/mp4";
      const declared = req.headers["content-type"]?.split(";")[0] || "";
      if (mime === "video/webm" && declared === "audio/webm")
        mime = "audio/webm";
      if (mime === "video/mp4" && declared === "audio/mp4") mime = "audio/mp4";
      if (!allowedMime.has(mime))
        throw new HttpError(
          415,
          "Use JPEG, PNG, WebP, MP4, WebM, Ogg, MP3 or WAV.",
        );
      await rate(uid);
      const saved = await locked(uid, async () => {
        const m = await requireMemory(uid, id);
        const hash = createHash("sha256").update(bytes).digest("hex");
        if (m.media) {
          if ((m.media as any).hash === hash) return m;
          throw new HttpError(409, "This memory already has an attachment.");
        }
        if (!mime.startsWith(m.kind + "/"))
          throw new HttpError(415, "The file does not match this memory type.");
        const used = (await memories(uid)).reduce(
          (sum, m) => sum + (m.media?.size || 0),
          0,
        );
        if (used + bytes.length > 500 * 1024 * 1024)
          throw new HttpError(
            413,
            "Your journal has reached its 500 MB media limit.",
          );
        await d.media.save(mediaPath(uid, id), bytes, mime);
        const result = {
          ...m,
          media: { mime, size: bytes.length, name: "original", hash },
        };
        try {
          await d.store.set(path(uid, "memories", id), result);
        } catch (error) {
          await d.media.remove(mediaPath(uid, id));
          throw error;
        }
        return result;
      });
      res.json(saved);
    }),
  );
  router.get(
    "/memories/:id/media",
    wrap(async (req, res) => {
      const uid = res.locals.uid,
        id = idSchema.parse(req.params.id),
        m = await requireMemory(uid, id);
      if (!m.media) throw new HttpError(404, "This memory has no attachment.");
      const bytes = await d.media.read(mediaPath(uid, id));
      res
        .set({
          "Content-Type": m.media.mime,
          "Cache-Control": "private, no-store",
          "Content-Disposition": 'inline; filename="memory"',
        })
        .send(bytes);
    }),
  );
  router.post(
    "/memories/:id/transcribe",
    wrap(async (req, res) => {
      const uid = res.locals.uid,
        id = idSchema.parse(req.params.id);
      if (req.body?.consent !== true)
        throw new HttpError(400, "Confirm sending this recording to Gemini.");
      await rate(uid, true);
      const m = await requireMemory(uid, id);
      if (!m.media || m.kind !== "audio")
        throw new HttpError(400, "Choose a saved voice recording.");
      const text = await d.ai.transcribe(
        await d.media.read(mediaPath(uid, id)),
        m.media.mime,
      );
      res.json({ text });
    }),
  );
  router.post(
    "/conversations/:id/messages",
    wrap(async (req, res) => {
      const uid = res.locals.uid,
        id = idSchema.parse(req.params.id);
      const input = z
        .object({
          id: idSchema,
          content: z.string().trim().min(1).max(6000),
          sourceIds: z.array(idSchema).max(5).default([]),
        })
        .strict()
        .parse(req.body);
      await rate(uid, true);
      const result = await locked(uid, async () => {
        const stored = await d.store.get(path(uid, "conversations", id));
        if (
          !stored &&
          (await d.store.list(path(uid, "conversations"))).length >= 300
        )
          throw new HttpError(
            413,
            "Your journal has reached its 300 conversation limit. Export or remove older reflections.",
          );
        const previous: Conversation = stored
          ? await normalizeConversation(uid, stored)
          : {
              id,
              title: input.content.slice(0, 70),
              messages: [],
              summary: "",
              updatedAt: now().toISOString(),
            };
        if (previous.messages.some((m) => m.id === input.id)) return previous;
        if (previous.messages.length >= 80)
          throw new HttpError(
            400,
            "Start a new conversation to keep the reflection focused.",
          );
        const selected = await Promise.all(
          input.sourceIds.map((sourceId) => requireMemory(uid, sourceId)),
        );
        const messages = [
          ...previous.messages,
          { role: "user" as const, content: input.content, id: input.id },
        ];
        if (Buffer.byteLength(JSON.stringify(messages), "utf8") > 500000)
          throw new HttpError(
            400,
            "This conversation is full. Start a new reflection to continue.",
          );
        const response = await d.ai.chat(messages, selected);
        const conversation = {
          ...previous,
          messages: [
            ...messages,
            {
              role: "assistant" as const,
              content: response.reply,
              id: randomUUID(),
            },
          ],
          summary: response.summary,
          updatedAt: now().toISOString(),
        };
        if (Buffer.byteLength(JSON.stringify(conversation), "utf8") > 850000)
          throw new HttpError(
            400,
            "This conversation is full. Start a new reflection to continue.",
          );
        await d.store.set(path(uid, "conversations", id), conversation);
        return conversation;
      });
      res.json(result);
    }),
  );
  router.delete(
    "/conversations/:id",
    wrap(async (req, res) => {
      const uid = res.locals.uid,
        id = idSchema.parse(req.params.id);
      await rate(uid);
      await locked(uid, async () => {
        for (const collection of ["messages", "summaries"])
          for (const entry of await d.store.list(
            path(uid, "conversations", id) + "/" + collection,
          ))
            await d.store.remove(
              path(uid, "conversations", id) +
                "/" +
                collection +
                "/" +
                entry.id,
            );
        await d.store.remove(path(uid, "conversations", id));
      });
      res.status(204).end();
    }),
  );
  router.post(
    "/recommendations",
    wrap(async (_req, res) => {
      const uid = res.locals.uid;
      await rate(uid, true);
      const items = await locked(uid, async () => {
        const prefs: Preferences =
          (await d.store.get(path(uid, "settings", "preferences"))) ||
          defaultPreferences;
        if (!prefs.personalized)
          throw new HttpError(
            403,
            "Turn on personalized ideas in Settings first.",
          );
        const items = await d.ai.recommend(
          (await memories(uid)).slice(0, 40),
          prefs,
        );
        await d.store.set(path(uid, "insights", "recommendations"), {
          items,
          updatedAt: now().toISOString(),
        });
        return items;
      });
      res.json(items);
    }),
  );
  router.post(
    "/recaps/:period",
    wrap(async (req, res) => {
      const uid = res.locals.uid,
        period = z
          .string()
          .regex(/^\d{4}(-(?:0[1-9]|1[0-2]))?$/)
          .parse(req.params.period);
      const prefs: Preferences =
        (await d.store.get(path(uid, "settings", "preferences"))) ||
        defaultPreferences;
      if (
        period >= calendarPeriod(now(), prefs.timezone).slice(0, period.length)
      )
        throw new HttpError(
          400,
          "Recaps are available after the month or year ends.",
        );
      await rate(uid);
      const recap = await locked(uid, () => makeRecap(uid, period));
      if (!recap) throw new HttpError(404, "No memories saved in this period.");
      res.json(recap);
    }),
  );
  router.post(
    "/recaps/catch-up/run",
    wrap(async (_req, res) => {
      const uid = res.locals.uid;
      await rate(uid);
      const prefs = await d.store.get(path(uid, "settings", "preferences"));
      if (!prefs?.automaticRecaps) return res.json([]);
      const recaps = await locked(uid, async () => {
        const result = [];
        for (const period of completedPeriods(now(), prefs.timezone)) {
          const r = await makeRecap(uid, period);
          if (r) result.push(r);
        }
        return result;
      });
      res.json(recaps);
    }),
  );
  router.get(
    "/export",
    wrap(async (_req, res) => {
      const uid = res.locals.uid;
      res
        .set(
          "Content-Disposition",
          'attachment; filename="daynote-journal.json"',
        )
        .json({
          exportedAt: now().toISOString(),
          memories: await memories(uid),
          conversations: await Promise.all(
            (await d.store.list(path(uid, "conversations"))).map((c) =>
              normalizeConversation(uid, c),
            ),
          ),
          recaps: await d.store.list(path(uid, "recaps")),
          preferences: await d.store.get(path(uid, "settings", "preferences")),
          mediaNote:
            "Media files can be downloaded separately from each memory.",
        });
    }),
  );
  router.use((_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  router.use(
    (error: any, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof HttpError)
        return res.status(error.status).json({ error: error.message });
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: "Check the fields and try again." });
      if (error?.type === "entity.too.large")
        return res
          .status(413)
          .json({ error: "This file is too large. The limit is 25 MB." });
      console.error("Journal request failed", {
        code: typeof error?.code === "number" ? error.code : "SERVICE_ERROR",
      });
      res.status(503).json({
        error:
          "The cloud service could not confirm this operation. Please try again or check the project setup.",
      });
    },
  );
  return router;
}
