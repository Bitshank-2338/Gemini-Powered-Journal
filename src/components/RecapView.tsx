import { useState } from "react";
import {
  Mic,
  BookOpen,
  Sparkles,
  Download,
  ChevronRight,
  Pencil,
  Trash2,
  LoaderCircle,
  Check,
  X,
} from "lucide-react";
import type { Memory, Recap } from "../../shared/journal";
import { download, api } from "../client";

export function periodLabel(period: string) {
  if (period.length === 4) return period + " in review";
  const [y, m] = period.split("-");
  return (
    new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    }) + " recap"
  );
}

export function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function RecapView({
  recap,
  memories,
  demo,
  open,
  reflect,
  onUpdateClosingLine,
}: {
  recap: Recap;
  memories: Memory[];
  demo: boolean;
  open: (m: Memory) => void;
  reflect: (r: Recap) => void;
  onUpdateClosingLine?: (period: string, line?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(recap.closingLine || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const sources = recap.sourceIds
    .map((id) => memories.find((m) => m.id === id))
    .filter(Boolean) as Memory[];

  async function handleSaveClosing(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      if (demo) {
        throw new Error(
          "Sign in to your private account to save your own closing line.",
        );
      }
      await api<{ period: string; text: string }>(
        `/recaps/${encodeURIComponent(recap.period)}/closing`,
        "PUT",
        { text: draft.trim() },
      );
      onUpdateClosingLine?.(recap.period, draft.trim());
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteClosing() {
    if (
      !confirm(
        "Remove your closing line? You can write a new one anytime.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (demo) {
        throw new Error(
          "Sign in to your private account to manage your journal.",
        );
      }
      await api(
        `/recaps/${encodeURIComponent(recap.period)}/closing`,
        "DELETE",
      );
      setDraft("");
      onUpdateClosingLine?.(recap.period, undefined);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="recap-story">
      <div className="recap-editorial">
        <span className="recap-period">{periodLabel(recap.period)}</span>
        <h2>{recap.title}</h2>
        <p className="fineprint">
          {demo ? "Fictional sample recap" : "Based on your saved words"} ·
          Private to your account
        </p>
        <div className="recap-stats">
          <div>
            <strong>{recap.count}</strong>
            <span>memories</span>
          </div>
          <div>
            <strong>{recap.voiceCount}</strong>
            <span>voice notes</span>
          </div>
          <div>
            <strong>{recap.themes.length}</strong>
            <span>themes</span>
          </div>
        </div>
        <div className="eyebrow">THEMES YOU RETURNED TO</div>
        <div className="interest-pills">
          {recap.themes.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <p className="recap-narrative">{recap.narrative}</p>
        {recap.sampleSize < recap.count && (
          <p className="fineprint">
            Narrative drawn from {recap.sampleSize} evenly spaced memories;
            counts include all {recap.count}.
          </p>
        )}

        {/* User's Own Closing Line Feature */}
        <section
          className="closing-line-card"
          aria-labelledby="closing-line-heading"
        >
          <div className="section-head">
            <span id="closing-line-heading" className="eyebrow">
              WHAT WOULD I LIKE TO CARRY FORWARD?
            </span>
            <small className="fineprint">Your words · Preserved on update</small>
          </div>

          {recap.closingLine && !editing ? (
            <div className="closing-display">
              <blockquote className="user-closing-quote">
                “{recap.closingLine}”
              </blockquote>
              <div className="closing-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setDraft(recap.closingLine || "");
                    setEditing(true);
                    setError("");
                  }}
                  disabled={busy}
                >
                  <Pencil size={15} /> Edit closing line
                </button>
                <button
                  type="button"
                  className="text-button danger"
                  onClick={handleDeleteClosing}
                  disabled={busy}
                >
                  <Trash2 size={15} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <form className="closing-form" onSubmit={handleSaveClosing}>
              <label htmlFor="closing-input" className="sr-only">
                What would you like to carry forward from this recap?
              </label>
              <textarea
                id="closing-input"
                rows={3}
                maxLength={500}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="In your own words: an intention, a lesson, or a feeling to hold onto..."
                disabled={busy}
              />
              <div className="closing-form-footer">
                <span className="fineprint">
                  {500 - draft.length} characters remaining
                </span>
                <div className="closing-button-group">
                  {editing && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setDraft(recap.closingLine || "");
                        setEditing(false);
                        setError("");
                      }}
                      disabled={busy}
                    >
                      <X size={15} /> Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="primary small"
                    disabled={busy || !draft.trim()}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={15} />
                    ) : success ? (
                      <Check size={15} />
                    ) : (
                      <Sparkles size={15} />
                    )}
                    {recap.closingLine ? "Update closing line" : "Save closing line"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {error && (
            <p role="alert" className="error" style={{ marginTop: "0.5rem" }}>
              {error}
            </p>
          )}
        </section>

        <div className="recap-buttons">
          <button className="primary" onClick={() => reflect(recap)}>
            <Sparkles size={17} />
            Carry something forward
          </button>
          <button
            onClick={() =>
              download(recap, "daynote-recap-" + recap.period + ".json")
            }
          >
            <Download size={17} />
            Download recap
          </button>
        </div>
      </div>
      <div className="recap-sources">
        <div className="recap-art">
          <div className="orbital-calendar">
            <span>{recap.period.length === 4 ? "365" : "a month"}</span>
            <p>little chances to notice</p>
          </div>
          <div className="orbit-line one" />
          <div className="orbit-line two" />
        </div>
        <h3>The moments behind the story</h3>
        {sources.map((m) => (
          <button className="recap-source" key={m.id} onClick={() => open(m)}>
            <span className="round-icon">
              {m.kind === "audio" ? <Mic size={18} /> : <BookOpen size={18} />}
            </span>
            <div>
              <strong>{m.title}</strong>
              <small>{dateLabel(m.occurredAt)}</small>
            </div>
            <ChevronRight size={17} />
          </button>
        ))}
      </div>
    </section>
  );
}
