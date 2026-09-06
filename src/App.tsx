import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  Home,
  BookOpen,
  MessagesSquare,
  Sparkles,
  CalendarDays,
  Settings,
  Search,
  ArrowUpRight,
  ArrowRight,
  Mic,
  FileText,
  Image,
  Video,
  Plus,
  X,
  LogOut,
  Download,
  Star,
  Trash2,
  Pencil,
  Send,
  Volume2,
  ShieldCheck,
  LoaderCircle,
  ChevronRight,
  Compass,
} from "lucide-react";
import { auth, onAuthChange, signInWithGoogle, signOutUser } from "./firebase";
import { api, mediaBlob, download, type JournalData } from "./client";
import {
  defaultPreferences,
  type Memory,
  type MemoryKind,
  type Conversation,
  type Recap,
  type Preferences,
} from "../shared/journal";
import { demoData } from "./demo";
import { Capture, Waveform } from "./components/Capture";
import { MemoryMedia } from "./components/MemoryMedia";
import { useDialog } from "./components/useDialog";
const empty: JournalData = {
  memories: [],
  conversations: [],
  recaps: [],
  recommendations: [],
  preferences: defaultPreferences,
};
const tabs = [
  ["Today", Home],
  ["Memories", BookOpen],
  ["Conversations", MessagesSquare],
  ["For you", Compass],
  ["Recaps", CalendarDays],
  ["Settings", Settings],
] as const;
type Tab = (typeof tabs)[number][0];
function Logo() {
  return (
    <div className="brand">
      <span className="orbit-logo">
        <i />
      </span>
      daynote<span className="brand-dot">.</span>
    </div>
  );
}
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const periodLabel = (period: string) =>
  period.length === 4
    ? period
    : new Date(period + "-15T12:00:00").toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [demo, setDemo] = useState(
      new URLSearchParams(location.search).get("preview") === "true",
    ),
    [error, setError] = useState("");
  useEffect(
    () =>
      onAuthChange(auth, (u) => {
        setUser(u);
        setReady(true);
        if (u) setDemo(false);
      }),
    [],
  );
  async function login() {
    setError("");
    try {
      await signInWithGoogle();
    } catch {
      setError(
        "Sign-in could not finish. Allow the popup and check that Google sign-in and this domain are enabled in Firebase.",
      );
    }
  }
  if (!ready)
    return (
      <div className="loading-screen">
        <Logo />
        <LoaderCircle className="spin" />
      </div>
    );
  if (!user && !demo)
    return (
      <div className="landing">
        <nav>
          <Logo />
          <span className="eyebrow">YOUR LIFE. IN YOUR WORDS.</span>
          <button onClick={login}>
            Sign in <ArrowUpRight size={16} />
          </button>
        </nav>
        <div className="landing-grid">
          <section>
            <div className="eyebrow">
              <span className="tiny-dot" /> A PERSONAL JOURNAL, POWERED BY
              GEMINI
            </div>
            <h1>
              Life happens.
              <br />
              Keep a little
              <br />
              <em>more of it.</em>
            </h1>
            <p>
              The words, the photos, the “you had to be there.”
              <br />A quiet space to remember, reflect, and find your next
              little adventure.
            </p>
            <button className="primary" onClick={login}>
              Begin with Google <ArrowRight size={18} />
            </button>
            <button className="text-button" onClick={() => setDemo(true)}>
              Explore the design <ArrowUpRight size={16} />
            </button>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="landing-notes">
              <span>
                <Mic size={16} />
                Voice comes first
              </span>
              <span>
                <ShieldCheck size={16} />
                Your account. Your memories.
              </span>
            </div>
          </section>
          <div className="landing-art">
            <img
              src="/demo/coast.png"
              alt="Illustrative quiet coastline at dusk"
            />
            <div className="art-caption">
              <span className="eyebrow">SOME DAYS ARE BETTER SPOKEN.</span>
              <Waveform />
              <div className="art-record">
                <span>
                  <Mic size={28} />
                </span>
                <p>“I took the long way home today…”</p>
              </div>
              <small>Illustrative memory · AI-generated photo</small>
            </div>
            <div className="orbit-line one" />
            <div className="orbit-line two" />
          </div>
        </div>
        <footer>
          <span>A place for everything you want to keep.</span>
          <span>Write it. Say it. Remember it.</span>
        </footer>
      </div>
    );
  return (
    <Journal
      key={user?.uid || "demo"}
      user={user}
      demo={demo}
      leaveDemo={() => {
        setDemo(false);
        history.replaceState(null, "", location.pathname);
      }}
    />
  );
}
function Journal({
  user,
  demo,
  leaveDemo,
}: {
  user: User | null;
  demo: boolean;
  leaveDemo: () => void;
}) {
  const [data, setData] = useState<JournalData>(demo ? demoData : empty),
    [tab, setTab] = useState<Tab>("Today"),
    [loading, setLoading] = useState(!demo),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [capture, setCapture] = useState<{
      kind: MemoryKind;
      initial?: Memory;
    } | null>(null),
    [selected, setSelected] = useState<Memory | null>(null);
  const [chatId, setChatId] = useState<string>(""),
    [chatText, setChatText] = useState(""),
    [sources, setSources] = useState<string[]>([]),
    [recap, setRecap] = useState<Recap | null>(null),
    [period, setPeriod] = useState(() => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    });
  const alive = useRef(true),
    chatRequest = useRef<{
      content: string;
      id: string;
      conversationId: string;
    } | null>(null);
  useEffect(() => {
    alive.current = true;
    if (!demo) {
      void load().then((result) => {
        if (result?.preferences.automaticRecaps)
          void api("/recaps/catch-up/run", "POST", {})
            .then(() => load())
            .catch((e) => {
              if (alive.current)
                setNotice("Automatic recap is pending: " + e.message);
            });
      });
    }
    return () => {
      alive.current = false;
      window.speechSynthesis?.cancel();
    };
  }, []);
  async function load() {
    setError("");
    try {
      const result = await api<JournalData>("/journal");
      if (alive.current) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (e) {
      if (alive.current) {
        setError((e as Error).message);
        setLoading(false);
      }
    }
  }
  function requireLive() {
    if (demo)
      throw new Error(
        "This is a design preview with fictional memories. Sign in to use your own journal.",
      );
  }
  async function run(fn: () => Promise<void>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function saveMemory(memory: Memory, file?: Blob) {
    requireLive();
    const { createdAt, media, ...body } = memory;
    await api("/memories/" + memory.id, "PUT", body);
    if (file) {
      try {
        await api("/memories/" + memory.id + "/media", "PUT", file);
      } catch (e) {
        throw new Error(
          "Your written memory was saved, but its attachment was not confirmed. Keep this window open and retry Save memory. " +
            (e as Error).message,
        );
      }
    }
    await load();
    setSelected(null);
    setNotice("Memory saved.");
  }
  function reflect(m: Memory) {
    setSelected(null);
    setTab("Conversations");
    setChatId("");
    setSources([m.id]);
    setChatText("Help me reflect on “" + m.title + "”.");
  }
  const visible = data.memories.filter(
    (m) =>
      (filter === "all" ||
        (filter === "favorites" && m.favorite) ||
        m.kind === filter) &&
      [m.title, m.text, ...m.tags]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const onThisDay = data.memories.find((m) => {
    const d = new Date(m.occurredAt),
      n = new Date();
    return (
      d.getMonth() === n.getMonth() &&
      d.getDate() === n.getDate() &&
      d.getFullYear() < n.getFullYear()
    );
  });
  const featureMemory =
    onThisDay ||
    data.memories.find((m) => m.kind === "image") ||
    data.memories[0];
  const conversation = data.conversations.find((c) => c.id === chatId);
  const latestRecap = data.recaps[0];
  function card(m: Memory) {
    return (
      <button key={m.id} className="memory-card" onClick={() => setSelected(m)}>
        <div className="memory-cover">
          <MemoryMedia memory={m} demo={demo} />
          {m.favorite && (
            <span className="favorite-indicator">
              <Star size={13} fill="currentColor" />
            </span>
          )}
        </div>
        <div className="memory-caption">
          <h3>{m.title}</h3>
          <span>
            {m.kind === "audio"
              ? "Voice note"
              : m.kind === "text"
                ? "Written note"
                : m.kind === "image"
                  ? "Photo"
                  : "Video"}
            <i /> {dateLabel(m.occurredAt)}
          </span>
        </div>
      </button>
    );
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!chatText.trim()) return;
    await run(async () => {
      requireLive();
      const request =
        chatRequest.current?.content === chatText &&
        chatRequest.current?.conversationId ===
          (chatId || chatRequest.current.conversationId)
          ? chatRequest.current
          : {
              content: chatText,
              id: crypto.randomUUID(),
              conversationId: chatId || crypto.randomUUID(),
            };
      chatRequest.current = request;
      const saved = await api<Conversation>(
        "/conversations/" + request.conversationId + "/messages",
        "POST",
        { id: request.id, content: request.content, sourceIds: sources },
      );
      if (!alive.current) return;
      setData((d) => ({
        ...d,
        conversations: [
          saved,
          ...d.conversations.filter((c) => c.id !== saved.id),
        ],
      }));
      setChatId(saved.id);
      setChatText("");
      chatRequest.current = null;
    });
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <div className="sidebar-label">YOUR PRIVATE SPACE</div>
        <nav>
          {tabs.slice(0, 5).map(([name, Icon]) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => {
                setTab(name);
                setError("");
              }}
            >
              <Icon size={20} />
              <span>{name}</span>
              {name === "Memories" && data.memories.length > 0 && (
                <small>{data.memories.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <span className="tiny-dot" /> A little space, just for you.
          </div>
          <button
            className={tab === "Settings" ? "active" : ""}
            onClick={() => setTab("Settings")}
          >
            <Settings size={20} />
            Settings
          </button>
          <div className="user-area">
            <span className="avatar">
              {(user?.displayName || "Preview")
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")}
            </span>
            <div>
              <strong>{user?.displayName || "Design preview"}</strong>
              <small>
                {demo ? "Fictional sample data" : "Personal journal"}
              </small>
            </div>
            <button
              className="icon-button"
              title={demo ? "Leave preview" : "Sign out"}
              aria-label={demo ? "Leave preview" : "Sign out"}
              onClick={() => {
                if (demo) leaveDemo();
                else void run(() => signOutUser());
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
          <div className="topbar-actions">
            {demo && <span className="demo-label">DESIGN PREVIEW</span>}
            <label className="search">
              <Search size={17} />
              <input
                aria-label="Find a memory"
                placeholder="Find a memory"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setTab("Memories");
                }}
              />
              <kbd>/</kbd>
            </label>
            <button
              className="mobile-settings icon-button"
              aria-label="Settings"
              onClick={() => setTab("Settings")}
            >
              <Settings size={20} />
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            You’re exploring a fictional journal.{" "}
            <button onClick={leaveDemo}>
              Sign in to make it yours <ArrowUpRight size={13} />
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="error global-error">
            {error}
            <button
              aria-label="Dismiss error"
              className="icon-button"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
            <button
              aria-label="Dismiss notice"
              className="icon-button"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {loading ? (
          <div className="empty-state">
            <LoaderCircle className="spin" />
            <h2>Opening your journal…</h2>
          </div>
        ) : (
          <>
            {tab === "Today" && (
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
                          <span className="tiny-dot" /> YOUR NEXT MEMORY STARTS
                          HERE
                        </span>
                        <span className="fineprint">
                          No perfect words needed
                        </span>
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
                          <button
                            key={kind}
                            onClick={() => setCapture({ kind })}
                          >
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
                          Recent memories{" "}
                          <span className="count">{data.memories.length}</span>
                        </h2>
                        <button
                          className="text-button"
                          onClick={() => setTab("Memories")}
                        >
                          View all <ArrowUpRight size={16} />
                        </button>
                      </div>
                      {data.memories.length ? (
                        <div className="memory-grid">
                          {data.memories.slice(0, 3).map(card)}
                        </div>
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
                            ? "Your " +
                              periodLabel(latestRecap.period) +
                              ", remembered."
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
                            Keep a memory today. Find a little of yourself here
                            tomorrow.
                          </p>
                        </div>
                      )}
                    </section>
                    <section className="for-you-card">
                      <div className="eyebrow">
                        A LITTLE MORE OF WHAT YOU LOVE
                      </div>
                      <h2>
                        {data.recommendations[0]?.title ||
                          "Follow your curiosity."}
                      </h2>
                      <p>
                        {data.recommendations[0]?.description ||
                          "Choose your interests and let Gemini suggest small ideas inspired by your journal."}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => setTab("For you")}
                      >
                        Something for you <ArrowUpRight size={16} />
                      </button>
                    </section>
                  </aside>
                </div>
              </>
            )}
            {tab === "Memories" && (
              <>
                <PageHeading
                  eyebrow="THE THINGS THAT STAY"
                  title="Your life, collected."
                  subtitle="Not just what happened. What it felt like."
                />
                <div className="section-head library-tools">
                  <div className="filters">
                    {[
                      ["all", "All memories"],
                      ["audio", "Voice"],
                      ["image", "Photos"],
                      ["video", "Videos"],
                      ["text", "Notes"],
                      ["favorites", "Favourites"],
                    ].map(([key, label]) => (
                      <button
                        className={filter === key ? "selected" : ""}
                        key={key}
                        onClick={() => setFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="primary small"
                    onClick={() => setCapture({ kind: "text" })}
                  >
                    <Plus size={17} />
                    New memory
                  </button>
                </div>
                {visible.length ? (
                  <div className="memory-grid library">{visible.map(card)}</div>
                ) : (
                  <Empty
                    title={
                      search
                        ? "No memories match that search."
                        : "A little empty. Full of possibility."
                    }
                    text="Try a different filter or keep a new moment."
                    action={() => {
                      setSearch("");
                      setFilter("all");
                      setCapture({ kind: "text" });
                    }}
                  />
                )}
              </>
            )}
            {tab === "Conversations" && (
              <>
                <PageHeading
                  eyebrow="A SPACE TO THINK OUT LOUD"
                  title="A little perspective."
                  subtitle="Reflect with Gemini. Your conversation is summarized and saved after each reply."
                />
                <div className="conversation-layout">
                  <aside className="conversation-list">
                    <button
                      className="primary small"
                      onClick={() => {
                        setChatId("");
                        setSources([]);
                        setChatText("");
                      }}
                    >
                      <Plus size={16} />
                      New conversation
                    </button>
                    {data.conversations.map((c) => (
                      <button
                        key={c.id}
                        className={c.id === chatId ? "selected" : ""}
                        onClick={() => {
                          setChatId(c.id);
                          setSources([]);
                        }}
                      >
                        <MessagesSquare size={16} />
                        <span>{c.title}</span>
                      </button>
                    ))}
                    {!data.conversations.length && (
                      <p className="fineprint">
                        Your reflections will appear here.
                      </p>
                    )}
                  </aside>
                  <section className="chat-panel">
                    <div className="chat-messages" aria-live="polite">
                      {conversation?.messages.length ? (
                        conversation.messages.map((m) => (
                          <div key={m.id} className={"chat-message " + m.role}>
                            <span>{m.role === "user" ? "YOU" : "GEMINI"}</span>
                            <p>{m.content}</p>
                            {m.role === "assistant" &&
                              "speechSynthesis" in window && (
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    speechSynthesis.cancel();
                                    speechSynthesis.speak(
                                      new SpeechSynthesisUtterance(m.content),
                                    );
                                  }}
                                >
                                  <Volume2 size={15} />
                                  Listen
                                </button>
                              )}
                          </div>
                        ))
                      ) : (
                        <div className="chat-welcome">
                          <Sparkles size={30} />
                          <h2>No right place to start.</h2>
                          <p>
                            Untangle an idea, revisit a memory, or simply talk
                            about your day.
                          </p>
                          {[
                            "Help me notice something good about today.",
                            "I have an idea I want to think through.",
                          ].map((p) => (
                            <button key={p} onClick={() => setChatText(p)}>
                              {p}
                              <ArrowUpRight size={15} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {sources.length > 0 && (
                      <div className="source-pills">
                        {sources.map((id) => (
                          <span key={id}>
                            <BookOpen size={13} />
                            {data.memories.find((m) => m.id === id)?.title}
                            <button
                              aria-label="Remove source memory"
                              onClick={() =>
                                setSources((s) => s.filter((x) => x !== id))
                              }
                            >
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <form className="chat-composer" onSubmit={send}>
                      <textarea
                        aria-label="Your message to Gemini"
                        rows={2}
                        value={chatText}
                        maxLength={6000}
                        onChange={(e) => setChatText(e.target.value)}
                        placeholder="Say what’s on your mind…"
                      />
                      <button
                        className="primary icon-button"
                        disabled={busy || !chatText.trim()}
                        aria-label="Send message"
                      >
                        {busy ? (
                          <LoaderCircle className="spin" />
                        ) : (
                          <Send size={19} />
                        )}
                      </button>
                    </form>
                    <div className="chat-footnote">
                      Messages and selected memories are sent to Gemini. Check
                      its reflections against your own experience.
                    </div>
                  </section>
                  <aside className="summary-panel">
                    <span className="eyebrow">THE THREAD OF YOUR THOUGHTS</span>
                    <h2>A little clarity.</h2>
                    <p>
                      {conversation?.summary ||
                        "Your conversation summary will appear here after Gemini replies."}
                    </p>
                    {conversation && (
                      <button
                        className="text-button danger"
                        onClick={() => {
                          if (
                            confirm("Delete this conversation and its summary?")
                          )
                            void run(async () => {
                              requireLive();
                              await api(
                                "/conversations/" + conversation.id,
                                "DELETE",
                              );
                              setChatId("");
                              await load();
                            });
                        }}
                      >
                        <Trash2 size={15} />
                        Delete conversation
                      </button>
                    )}
                  </aside>
                </div>
              </>
            )}
            {tab === "For you" && (
              <>
                <PageHeading
                  eyebrow="INSPIRED BY YOU"
                  title="Follow your curiosity."
                  subtitle="Small ideas for a life that feels a little more like yours."
                />
                <div className="personalization-bar">
                  <p>
                    {data.preferences.personalized
                      ? "Based on your chosen interests and your most recent saved words."
                      : "Personalized ideas are off. Choose your interests and turn them on in Settings."}
                  </p>
                  <button
                    className="primary small"
                    disabled={busy}
                    onClick={() => {
                      if (!data.preferences.personalized) {
                        setTab("Settings");
                        return;
                      }
                      void run(async () => {
                        requireLive();
                        const items = await api<JournalData["recommendations"]>(
                          "/recommendations",
                          "POST",
                          {},
                        );
                        setData((d) => ({ ...d, recommendations: items }));
                      });
                    }}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Sparkles size={16} />
                    )}{" "}
                    {data.preferences.personalized
                      ? "Find new ideas"
                      : "Personalize my journal"}
                  </button>
                </div>
                <div className="interest-pills">
                  {data.preferences.interests.map((i) => (
                    <span key={i}>{i}</span>
                  ))}
                </div>
                <div className="recommendation-grid">
                  {data.recommendations.map((r, i) => (
                    <article className="idea-card" key={i}>
                      <span className="idea-number">0{i + 1}</span>
                      <Compass size={28} />
                      <h2>{r.title}</h2>
                      <p>{r.description}</p>
                      <div className="reason">
                        <span className="eyebrow">WHY THIS FITS</span>
                        <p>{r.reason}</p>
                        {r.sourceIds.map((id) => (
                          <button
                            key={id}
                            className="text-button"
                            onClick={() =>
                              setSelected(
                                data.memories.find((m) => m.id === id) || null,
                              )
                            }
                          >
                            <BookOpen size={14} />
                            {data.memories.find((m) => m.id === id)?.title ||
                              "Source memory"}
                          </button>
                        ))}
                      </div>
                      <button
                        className="text-button"
                        onClick={() => {
                          setTab("Conversations");
                          setChatId("");
                          setSources(r.sourceIds.slice(0, 5));
                          setChatText(
                            "Help me explore this idea: " +
                              r.title +
                              " " +
                              r.description,
                          );
                        }}
                      >
                        Think this through <ArrowUpRight size={16} />
                      </button>
                    </article>
                  ))}
                </div>
                {!data.recommendations.length && (
                  <Empty
                    title="Let’s start with what you love."
                    text="Ideas appear here after you enable personalization and ask Gemini for inspiration."
                    action={() => setTab("Settings")}
                    label="Choose my interests"
                  />
                )}
              </>
            )}
            {tab === "Recaps" && (
              <>
                <PageHeading
                  eyebrow="THE BIGGER PICTURE"
                  title="Your story, revisited."
                  subtitle="The months that shaped you. The years you’ll want to remember."
                />
                <div className="recap-controls">
                  <div className="period-input">
                    <label htmlFor="recap-period">Month or year</label>
                    <input
                      id="recap-period"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      placeholder="2026-08 or 2025"
                      pattern="[0-9]{4}(-[0-9]{2})?"
                    />
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          requireLive();
                          const r = await api<Recap>(
                            "/recaps/" + encodeURIComponent(period),
                            "POST",
                            {},
                          );
                          setRecap(r);
                          await load();
                        })
                      }
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      Create recap
                    </button>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setTab("Settings")}
                  >
                    <span
                      className={
                        "tiny-dot " +
                        (!data.preferences.automaticRecaps ? "muted-dot" : "")
                      }
                    />
                    Automatic recaps{" "}
                    {data.preferences.automaticRecaps ? "on" : "off"}
                    <Settings size={16} />
                  </button>
                </div>
                <div className="recap-tabs">
                  {data.recaps.map((r) => (
                    <button
                      className={
                        (recap?.id || latestRecap?.id) === r.id
                          ? "selected"
                          : ""
                      }
                      key={r.id}
                      onClick={() => setRecap(r)}
                    >
                      {periodLabel(r.period)}
                    </button>
                  ))}
                </div>
                {recap || latestRecap ? (
                  <RecapView
                    recap={(recap || latestRecap)!}
                    memories={data.memories}
                    demo={demo}
                    open={setSelected}
                    reflect={(r) => {
                      setTab("Conversations");
                      setChatId("");
                      setSources(r.sourceIds.slice(0, 5));
                      setChatText(
                        "What would I like to carry forward from " +
                          periodLabel(r.period) +
                          "?",
                      );
                    }}
                  />
                ) : (
                  <Empty
                    title="A story that writes itself, over time."
                    text="Keep memories through the month. When it ends, Gemini can help you see the themes that connect them. Annual recaps work the same way."
                    action={() => setTab("Settings")}
                    label="Set up automatic recaps"
                  />
                )}
              </>
            )}
            {tab === "Settings" && (
              <>
                <PageHeading
                  eyebrow="MAKE YOURSELF AT HOME"
                  title="A journal that knows your pace."
                  subtitle="You choose what to keep, what to share with Gemini, and what comes back to you."
                />
                <SettingsPanel
                  preferences={data.preferences}
                  busy={busy}
                  save={(p) =>
                    run(async () => {
                      requireLive();
                      await api("/preferences", "PUT", p);
                      await load();
                      setNotice("Preferences saved.");
                    })
                  }
                  exportJournal={() =>
                    void run(async () => {
                      requireLive();
                      download(await api("/export"), "daynote-journal.json");
                    })
                  }
                />
              </>
            )}
          </>
        )}
        <footer className="app-footer">
          <span>
            <ShieldCheck size={14} />
            Your story belongs to you.
          </span>
          <span>
            {demo
              ? "Fictional sample data · illustrative AI-generated photo"
              : "A little more present. A little more remembered."}
          </span>
          {!demo && error && (
            <button className="text-button" onClick={() => void load()}>
              Retry connection
            </button>
          )}
        </footer>
      </main>
      <nav className="mobile-nav">
        {tabs.slice(0, 5).map(([name, Icon]) => (
          <button
            className={tab === name ? "active" : ""}
            key={name}
            onClick={() => setTab(name)}
          >
            <Icon size={21} />
            <span>{name === "Conversations" ? "Reflect" : name}</span>
          </button>
        ))}
      </nav>
      {capture && (
        <Capture
          kind={capture.kind}
          initial={capture.initial}
          onClose={() => setCapture(null)}
          onSave={saveMemory}
        />
      )}
      {selected && (
        <MemoryDetail
          memory={selected}
          demo={demo}
          close={() => setSelected(null)}
          edit={() => {
            setCapture({ kind: selected.kind, initial: selected });
            setSelected(null);
          }}
          reflect={() => reflect(selected)}
          save={async (m) => {
            await saveMemory(m);
            setSelected(m);
          }}
          remove={async () => {
            requireLive();
            await api("/memories/" + selected.id, "DELETE");
            setSelected(null);
            await load();
            setNotice(
              "Memory and its attachment deleted. Derived recaps and ideas were cleared. Conversations keep any passages you previously included.",
            );
          }}
        />
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <section className="page-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </section>
  );
}
function Empty({
  title,
  text,
  action,
  label = "Keep a memory",
}: {
  title: string;
  text: string;
  action: () => void;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <BookOpen size={32} />
      <h2>{title}</h2>
      <p>{text}</p>
      <button onClick={action}>
        {label}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
function MemoryDetail({
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
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [transcript, setTranscript] = useState<string | null>(null),
    [consent, setConsent] = useState(false),
    [deleting, setDeleting] = useState(false);
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
function SettingsPanel({
  preferences,
  busy,
  save,
  exportJournal,
}: {
  preferences: Preferences;
  busy: boolean;
  save: (p: Preferences) => Promise<void>;
  exportJournal: () => void;
}) {
  const [p, setP] = useState(preferences),
    [interests, setInterests] = useState(preferences.interests.join(", "));
  useEffect(() => {
    setP(preferences);
    setInterests(preferences.interests.join(", "));
  }, [preferences]);
  return (
    <div className="settings-grid">
      <form
        className="settings-card"
        onSubmit={(e) => {
          e.preventDefault();
          void save({
            ...p,
            interests: interests
              .split(",")
              .map((i) => i.trim())
              .filter(Boolean),
          });
        }}
      >
        <span className="eyebrow">YOUR TASTE, YOUR TERMS</span>
        <h2>What makes you, you?</h2>
        <label>
          Interests
          <input
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="Photography, books, weekend hikes"
          />
        </label>
        <p className="fineprint">
          Up to 12 interests, separated by commas. No personality profiling.
        </p>
        <label className="toggle-row">
          <span>
            <strong>Ideas inspired by me</strong>
            <small>
              Send my chosen interests and recent written memories to Gemini
              when I request personalized ideas.
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={p.personalized}
            onChange={(e) => setP({ ...p, personalized: e.target.checked })}
          />
        </label>
        <label className="toggle-row">
          <span>
            <strong>Monthly & yearly recaps</strong>
            <small>
              Automatically send saved words and tags to Gemini after each
              period ends. Photos and videos remain attachments; recaps use
              their written captions. Recaps stay private.
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={p.automaticRecaps}
            onChange={(e) => setP({ ...p, automaticRecaps: e.target.checked })}
          />
        </label>
        <label>
          Time zone
          <input
            required
            value={p.timezone}
            onChange={(e) => setP({ ...p, timezone: e.target.value })}
            placeholder="Asia/Kolkata"
          />
        </label>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            setP({
              ...p,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            })
          }
        >
          Use my device’s time zone
        </button>
        <button className="primary wide" disabled={busy}>
          {busy ? "Saving…" : "Save preferences"}
        </button>
      </form>
      <div>
        <section className="settings-card">
          <ShieldCheck size={28} />
          <h2>A little clarity on privacy.</h2>
          <p>
            Your journal is stored under your signed-in account. Gemini receives
            conversations, selected source memories, and media you explicitly
            submit for transcription.
          </p>
          <p>
            Ideas and automatic recaps use your words only when enabled. There
            are no public sharing links.
          </p>
          <p className="fineprint">
            This is account-isolated cloud storage, not end-to-end encryption.
            Google cloud services process the content needed to provide these
            features.
          </p>
        </section>
        <section className="settings-card">
          <h2>Take your story with you.</h2>
          <p>
            Export your words, conversations, preferences and recaps as JSON.
            Download original media from each memory.
          </p>
          <button disabled={busy} onClick={exportJournal}>
            <Download size={16} />
            Export my journal
          </button>
        </section>
      </div>
    </div>
  );
}
function RecapView({
  recap,
  memories,
  demo,
  open,
  reflect,
}: {
  recap: Recap;
  memories: Memory[];
  demo: boolean;
  open: (m: Memory) => void;
  reflect: (r: Recap) => void;
}) {
  const sources = recap.sourceIds
    .map((id) => memories.find((m) => m.id === id))
    .filter(Boolean) as Memory[];
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
