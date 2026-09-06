import {
  Mic,
  Pencil,
  Image,
  Video,
  Plus,
  ArrowUpRight,
  BookOpen,
  ArrowRight,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import type {
  Memory,
  MemoryKind,
  Recap,
  Recommendation,
  Tab,
} from "../../shared/journal";
import { Waveform } from "./Capture";
import { MemoryMedia } from "./MemoryMedia";
import { periodLabel } from "./RecapView";

export function TodayView({
  memories,
  recommendations,
  latestRecap,
  demo,
  card,
  setCapture,
  setTab,
  setRecap,
  setSelected,
}: {
  memories: Memory[];
  recommendations: Recommendation[];
  latestRecap: Recap | null;
  demo: boolean;
  card: (m: Memory) => React.ReactNode;
  setCapture: (c: { kind: MemoryKind; initial?: Memory }) => void;
  setTab: (t: Tab) => void;
  setRecap: (r: Recap | null) => void;
  setSelected: (m: Memory | null) => void;
}) {
  const onThisDay = memories.find((m) => {
    const d = new Date(m.occurredAt),
      today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() !== today.getFullYear()
    );
  });
  const featureMemory = onThisDay || memories[0];

  return (
    <>
      <section className="page-heading">
        <div className="eyebrow">MAKE ROOM FOR YOURSELF</div>
        <h1>
          What’s on your mind<span>?</span>
        </h1>
        <p>Some days are better spoken.</p>
      </section>
      <div className="today-grid">
        <div className="today-main">
          <section className="voice-surface">
            <div className="voice-top">
              <span className="eyebrow">
                <span className="tiny-dot" /> YOUR NEXT MEMORY STARTS HERE
              </span>
              <span className="fineprint">No perfect words needed</span>
            </div>
            <div className="voice-stage">
              <div className="wave-line" />
              <Waveform />
              <div className="orbital-record">
                <div className="orbit-ring ring-one" />
                <div className="orbit-ring ring-two" />
                <button
                  className="record-button"
                  aria-label="Create a voice memory"
                  onClick={() => setCapture({ kind: "audio" })}
                >
                  <Mic size={32} />
                </button>
                <span>Start a voice memory</span>
              </div>
            </div>
            <div className="capture-options">
              {(
                [
                  ["audio", Mic, "Voice"],
                  ["text", Pencil, "Write"],
                  ["image", Image, "Photo"],
                  ["video", Video, "Video"],
                ] as const
              ).map(([kind, Icon, label]) => (
                <button key={kind} onClick={() => setCapture({ kind })}>
                  <Icon size={19} />
                  {label}
                  <Plus size={13} />
                </button>
              ))}
            </div>
          </section>
          <section className="recent-section">
            <div className="section-head">
              <h2>
                Recent memories <span className="count">{memories.length}</span>
              </h2>
              <button
                className="text-button"
                onClick={() => setTab("Memories")}
              >
                View all <ArrowUpRight size={16} />
              </button>
            </div>
            {memories.length ? (
              <div className="memory-grid">{memories.slice(0, 3).map(card)}</div>
            ) : (
              <div className="empty-state compact">
                <BookOpen />
                <h3>Your story starts with one moment.</h3>
                <p>A sentence, a voice note, a favourite photo.</p>
                <button onClick={() => setCapture({ kind: "text" })}>
                  Keep your first memory <ArrowRight size={16} />
                </button>
              </div>
            )}
          </section>
          <button
            className="recap-strip"
            onClick={() => {
              setTab("Recaps");
              setRecap(latestRecap || null);
            }}
          >
            <span className="round-icon">
              <CalendarDays size={23} />
            </span>
            <div>
              <span className="eyebrow">THE BIGGER PICTURE</span>
              <h3>
                {latestRecap
                  ? "Your " + periodLabel(latestRecap.period) + ", remembered."
                  : "Little moments. A bigger story."}
              </h3>
              <p>
                {latestRecap
                  ? "A private recap of the moments you kept."
                  : "Monthly and yearly recaps, made from your memories."}
              </p>
            </div>
            <span className="strip-action">
              {latestRecap ? "Open recap" : "Explore recaps"}{" "}
              <ArrowRight size={18} />
            </span>
          </button>
        </div>
        <aside className="right-column">
          <section className="revisit-card">
            <div className="section-head">
              <span className="eyebrow">
                {onThisDay ? "ON THIS DAY" : "A MOMENT TO REVISIT"}
              </span>
              <Sparkles size={17} />
            </div>
            {featureMemory ? (
              <button
                className="revisit-content"
                onClick={() => setSelected(featureMemory)}
              >
                <div className="revisit-cover">
                  <MemoryMedia memory={featureMemory} demo={demo} />
                </div>
                <h2>{featureMemory.title}</h2>
                <p>
                  {featureMemory.text.slice(0, 105)}
                  {featureMemory.text.length > 105 ? "…" : ""}
                </p>
                <span className="text-link">
                  Return to this moment <ArrowUpRight size={16} />
                </span>
              </button>
            ) : (
              <div className="quiet-empty">
                <Sparkles />
                <h2>
                  Ordinary days.
                  <br />
                  Extraordinary details.
                </h2>
                <p>
                  Keep a memory today. Find a little of yourself here tomorrow.
                </p>
              </div>
            )}
          </section>
          <section className="for-you-card">
            <div className="eyebrow">A LITTLE MORE OF WHAT YOU LOVE</div>
            <h2>{recommendations[0]?.title || "Follow your curiosity."}</h2>
            <p>
              {recommendations[0]?.description ||
                "Choose your interests and let Gemini suggest small ideas inspired by your journal."}
            </p>
            <button className="text-button" onClick={() => setTab("For you")}>
              Something for you <ArrowUpRight size={16} />
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
