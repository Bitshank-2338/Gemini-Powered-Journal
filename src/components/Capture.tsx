import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Image,
  Video,
  FileText,
  X,
  Upload,
  LoaderCircle,
} from "lucide-react";
import type { Memory, MemoryKind } from "../../shared/journal";
import { useDialog } from "./useDialog";
export function Waveform({ active = false }: { active?: boolean }) {
  return (
    <div className={"waveform " + (active ? "active" : "")} aria-hidden="true">
      {Array.from({ length: 65 }, (_, i) => (
        <i
          key={i}
          style={{
            height:
              8 + Math.abs(Math.sin(i * 1.8) * Math.cos(i * 0.23)) * 50 + "px",
            animationDelay: (i % 7) * 0.11 + "s",
          }}
        />
      ))}
    </div>
  );
}
export function Capture({
  kind: initialKind = "text",
  initial,
  onClose,
  onSave,
}: {
  kind?: MemoryKind;
  initial?: Memory;
  onClose: () => void;
  onSave: (memory: Memory, file?: Blob) => Promise<void>;
}) {
  const dialog = useDialog();
  const [kind, setKind] = useState(initial?.kind || initialKind),
    [title, setTitle] = useState(initial?.title || ""),
    [text, setText] = useState(initial?.text || ""),
    [tags, setTags] = useState(initial?.tags.join(", ") || "");
  const [occurred, setOccurred] = useState(
    (initial ? new Date(initial.occurredAt) : new Date()).toLocaleDateString(
      "en-CA",
    ),
  );
  const [file, setFile] = useState<Blob>(),
    [url, setUrl] = useState(""),
    [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const id = useRef(initial?.id || crypto.randomUUID()),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    input = useRef<HTMLInputElement>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (seconds >= 300 && recording) stop();
  }, [seconds, recording]);
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(false);
    stream.current?.getTracks().forEach((t) => t.stop());
  }
  async function record() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Voice recording needs a supported browser on HTTPS or localhost. You can upload audio instead.",
        );
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      recorder.current = r;
      const chunks: BlobPart[] = [];
      let size = 0;
      r.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          size += e.data.size;
          if (size > 25 * 1024 * 1024) stop();
        }
      };
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        if (alive.current) {
          setFile(new Blob(chunks, { type: r.mimeType }));
          setRecording(false);
        }
      };
      r.onerror = () => {
        stop();
        setError("Recording stopped unexpectedly. Please try again.");
      };
      setFile(undefined);
      setSeconds(0);
      setRecording(true);
      r.start(1000);
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone access was declined. Allow it in your browser, or upload an audio file."
          : (e as Error).message,
      );
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (kind !== "text" && !file && !initial?.media) {
      setError("Record or choose a file before saving.");
      return;
    }
    if (file && file.size > 25 * 1024 * 1024) {
      setError("Choose a file under 25 MB.");
      return;
    }
    setBusy(true);
    try {
      await onSave(
        {
          id: id.current,
          title: title.trim(),
          text,
          tags: tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          kind,
          createdAt: initial?.createdAt || new Date().toISOString(),
          occurredAt: new Date(occurred + "T12:00:00").toISOString(),
          favorite: initial?.favorite || false,
          ...(initial?.media ? { media: initial.media } : {}),
        },
        file,
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-title"
        className="modal capture-modal"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
        }}
      >
        <div className="section-head">
          <span className="eyebrow">A MOMENT, KEPT</span>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close capture"
          >
            <X />
          </button>
        </div>
        <h2 id="capture-title">
          {initial ? "Revisit your words." : "A thought worth keeping."}
        </h2>
        {!initial && (
          <div className="segmented">
            {(
              [
                ["audio", Mic, "Voice"],
                ["text", FileText, "Write"],
                ["image", Image, "Photo"],
                ["video", Video, "Video"],
              ] as const
            ).map(([k, I, label]) => (
              <button
                key={k}
                className={kind === k ? "selected" : ""}
                disabled={recording}
                onClick={() => {
                  setKind(k);
                  setFile(undefined);
                }}
              >
                <I size={16} />
                {label}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={save}>
          {kind === "audio" && !initial?.media && (
            <div className="record-review">
              <Waveform active={recording} />
              <button
                type="button"
                className={"record-button " + (recording ? "recording" : "")}
                onClick={recording ? stop : record}
                aria-label={recording ? "Stop recording" : "Start recording"}
              >
                {recording ? <Square fill="currentColor" /> : <Mic size={28} />}
              </button>
              <p>
                {recording
                  ? "Recording · " +
                    Math.floor(seconds / 60) +
                    ":" +
                    String(seconds % 60).padStart(2, "0")
                  : file
                    ? "Ready to review"
                    : "Tap to record · up to 5 minutes"}
              </p>
            </div>
          )}
          {kind !== "text" && !initial?.media && (
            <>
              <input
                ref={input}
                hidden
                type="file"
                accept={
                  kind === "image"
                    ? "image/jpeg,image/png,image/webp"
                    : kind === "video"
                      ? "video/mp4,video/webm"
                      : "audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/wav"
                }
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    setError("");
                  }
                }}
              />
              <button
                type="button"
                className="upload-button"
                disabled={recording}
                onClick={() => input.current?.click()}
              >
                <Upload size={17} />
                {file
                  ? "Choose a different file"
                  : "Choose " +
                    (kind === "image"
                      ? "a photo"
                      : kind === "video"
                        ? "a video"
                        : "audio")}
                <small>Up to 25 MB</small>
              </button>
            </>
          )}
          {url &&
            (kind === "audio" ? (
              <audio controls src={url} />
            ) : kind === "video" ? (
              <video controls src={url} />
            ) : (
              <img
                className="attachment-preview"
                src={url}
                alt="Selected photo"
              />
            ))}
          <label>
            Title
            <input
              autoFocus
              required
              maxLength={180}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give this moment a name"
            />
          </label>
          <label>
            {kind === "audio"
              ? "Your words (optional)"
              : "What would you like to remember?"}
            <textarea
              maxLength={20000}
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="A detail. A feeling. Something you don’t want to forget."
            />
          </label>
          <div className="form-row">
            <label>
              Date
              <input
                type="date"
                required
                value={occurred}
                max={new Date().toLocaleDateString("en-CA")}
                onChange={(e) => setOccurred(e.target.value)}
              />
            </label>
            <label>
              Tags, separated by commas
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="photography, small rituals"
              />
            </label>
          </div>
          <p className="fineprint">
            {kind === "audio"
              ? "Your recording stays on this device until you save. You can request Gemini transcription after saving."
              : "Saving stores this memory privately in your account."}
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button
            className="primary wide"
            disabled={busy || recording || !title.trim()}
          >
            {busy ? <LoaderCircle className="spin" size={18} /> : null}
            {busy ? "Saving your memory…" : "Save memory"}
          </button>
        </form>
      </section>
    </div>
  );
}
