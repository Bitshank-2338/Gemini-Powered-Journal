import { useState } from "react";
import {
  X,
  Sparkles,
  Pencil,
  Star,
  Mic,
  Download,
  Trash2,
  LoaderCircle,
} from "lucide-react";
import type { Memory } from "../../shared/journal";
import { useDialog } from "./useDialog";
import { api, download, mediaBlob } from "../client";
import { dateLabel } from "./RecapView";
import { MemoryMedia } from "./MemoryMedia";

export function MemoryDetailModal({
  memory,
  demo,
  close,
  edit,
  reflect,
  save,
  remove,
}: {
  memory: Memory;
  demo: boolean;
  close: () => void;
  edit: () => void;
  reflect: () => void;
  save: (m: Memory) => Promise<void>;
  remove: () => Promise<void>;
}) {
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      if (demo)
        throw new Error(
          "Sign in to use your own journal. These memories are fictional.",
        );
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="modal detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-title"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) close();
        }}
      >
        <div className="section-head">
          <span className="eyebrow">
            {memory.kind === "audio"
              ? "VOICE MEMORY"
              : memory.kind.toUpperCase() + " MEMORY"}{" "}
            · {dateLabel(memory.occurredAt)}
          </span>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close memory"
          >
            <X />
          </button>
        </div>
        <h2 id="memory-title">{memory.title}</h2>
        {memory.kind !== "text" && (
          <div className="detail-media">
            <MemoryMedia memory={memory} demo={demo} controls />
          </div>
        )}
        <p className="memory-text">
          {memory.text || "No written reflection yet."}
        </p>
        <div className="interest-pills">
          {memory.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="detail-actions">
          <button className="primary" onClick={reflect}>
            <Sparkles size={17} />
            Reflect with Gemini
          </button>
          <button onClick={edit}>
            <Pencil size={16} />
            Edit
          </button>
          <button
            className={memory.favorite ? "favorited" : ""}
            disabled={busy}
            onClick={() =>
              void run(() => save({ ...memory, favorite: !memory.favorite }))
            }
          >
            <Star size={16} fill={memory.favorite ? "currentColor" : "none"} />
            {memory.favorite ? "Favourite" : "Keep close"}
          </button>
        </div>
        {memory.kind === "audio" && memory.media && (
          <div className="transcription">
            <h3>Your voice, in words.</h3>
            <label className="check-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              Send this recording to Gemini for transcription.
            </label>
            <button
              disabled={busy || !consent}
              onClick={() =>
                void run(async () => {
                  const result = await api<{ text: string }>(
                    "/memories/" + memory.id + "/transcribe",
                    "POST",
                    { consent: true },
                  );
                  setTranscript(result.text);
                })
              }
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Mic size={16} />
              )}
              Transcribe recording
            </button>
            {transcript !== null && (
              <>
                <label>
                  Review before saving
                  <textarea
                    rows={6}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                  />
                </label>
                <button
                  className="primary small"
                  disabled={busy}
                  onClick={() =>
                    void run(() => save({ ...memory, text: transcript }))
                  }
                >
                  Save reviewed transcript
                </button>
              </>
            )}
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="detail-footer">
          {memory.media && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  download(
                    await mediaBlob(memory.id),
                    "daynote-memory." +
                      ({
                        "image/jpeg": "jpg",
                        "image/png": "png",
                        "image/webp": "webp",
                        "audio/webm": "webm",
                        "video/webm": "webm",
                        "video/mp4": "mp4",
                        "audio/mp4": "m4a",
                        "audio/ogg": "ogg",
                        "audio/mpeg": "mp3",
                        "audio/wav": "wav",
                      }[memory.media!.mime] || "bin"),
                  ),
                )
              }
            >
              <Download size={16} />
              Download original
            </button>
          )}
          <button
            className="text-button danger"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={16} />
            Delete memory
          </button>
        </div>
        {deleting && (
          <div className="delete-confirm">
            <h3>Let this memory go?</h3>
            <p>
              This removes the memory and attachment. Recaps and ideas are
              cleared for rebuilding. Existing conversations are separate.
            </p>
            <button
              className="danger"
              disabled={busy}
              onClick={() => void run(remove)}
            >
              Delete permanently
            </button>
            <button onClick={() => setDeleting(false)}>Keep memory</button>
          </div>
        )}
      </section>
    </div>
  );
}
