import { createJournalRouter } from "./journalRouter";
import { store } from "./store";
import { journalAI } from "./ai";
import { adminAuth, bucket } from "./firebaseAdmin";
import { OAuth2Client } from "google-auth-library";
import { createHash } from "node:crypto";
const oidc = new OAuth2Client();
export const apiRouter = createJournalRouter({
  store,
  ai: journalAI,
  verify: async (token) => (await adminAuth.verifyIdToken(token, true)).uid,
  verifyScheduler: async (token) => {
    const audience = process.env.SCHEDULER_AUDIENCE,
      email = process.env.SCHEDULER_SERVICE_ACCOUNT;
    if (!audience || !email) throw new Error("Scheduler is not configured");
    const ticket = await oidc.verifyIdToken({ idToken: token, audience });
    const p = ticket.getPayload();
    if (
      !p?.email_verified ||
      p.email !== email ||
      !["accounts.google.com", "https://accounts.google.com"].includes(p.iss)
    )
      throw new Error("Invalid scheduler identity");
  },
  media: {
    async save(path, bytes, mime) {
      const file = bucket.file(path);
      const hash = createHash("sha256").update(bytes).digest("hex");
      try {
        await file.save(bytes, {
          resumable: false,
          metadata: {
            contentType: mime,
            cacheControl: "private, no-store",
            metadata: { sha256: hash },
          },
          preconditionOpts: { ifGenerationMatch: 0 },
        });
      } catch (error: any) {
        if (error?.code !== 412) throw error;
        const [metadata] = await file.getMetadata();
        if (
          metadata.metadata?.sha256 !== hash ||
          Number(metadata.size) !== bytes.length
        )
          throw error;
        // Recover a retry after a process stopped between object upload and Firestore metadata.
      }
    },
    async read(path) {
      const [bytes] = await bucket.file(path).download();
      return bytes;
    },
    async remove(path) {
      await bucket.file(path).delete({ ignoreNotFound: true });
    },
  },
});
