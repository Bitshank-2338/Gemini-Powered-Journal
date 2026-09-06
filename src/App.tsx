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
  ShieldCheck,
  LoaderCircle,
  LogOut,
  Star,
  X,
  Compass,
} from "lucide-react";
import {
  auth,
  onTokenChange,
  checkRedirectResult,
  signInWithGooglePopup,
  signInWithGoogleRedirect,
  signOutUser,
} from "./firebase";
import { api, download, subscribeAuthExpired, type JournalData } from "./client";
import {
  defaultPreferences,
  type Memory,
  type MemoryKind,
  type Conversation,
  type Recap,
  type Preferences,
  type Recommendation,
  type AiUsage,
} from "../shared/journal";
import { demoData } from "./demo";
import { Capture, Waveform } from "./components/Capture";
import { MemoryMedia } from "./components/MemoryMedia";
import { TodayView } from "./components/TodayView";
import { MemoriesView } from "./components/MemoriesView";
import { ConversationsView } from "./components/ConversationsView";
import { ForYouView } from "./components/ForYouView";
import { RecapsTab } from "./components/RecapsTab";
import { SettingsPanel } from "./components/SettingsPanel";
import { MemoryDetailModal } from "./components/MemoryDetailModal";
import { dateLabel } from "./components/RecapView";

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

export type Tab = (typeof tabs)[number][0];

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

function extractSanitizedErrorCode(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  ) {
    const code = (err as { code: string }).code;
    if (/^auth\/[a-z0-9-]+$/i.test(code)) {
      return code;
    }
  }
  return "auth/unknown-error";
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(
    new URLSearchParams(location.search).get("preview") === "true",
  );
  const [error, setError] = useState("");
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    // 3. Process any pending redirect sign-in result during startup
    checkRedirectResult()
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
          setDemo(false);
        }
      })
      .catch((err: unknown) => {
        const code = extractSanitizedErrorCode(err);
        setAuthErrorCode(code);
        setError(`Redirect sign-in completed with code: ${code}`);
      });

    const unsubscribeToken = onTokenChange((u) => {
      setUser(u);
      setReady(true);
      if (u) {
        setDemo(false);
        setError("");
        setAuthErrorCode(null);
      }
    });

    const unsubscribeExpired = subscribeAuthExpired((code, msg) => {
      setUser(null);
      setAuthErrorCode(code);
      setError(msg);
    });

    return () => {
      unsubscribeToken();
      unsubscribeExpired();
    };
  }, []);

  async function login() {
    setError("");
    setAuthErrorCode(null);
    setIsSigningIn(true);

    // 1. Try signInWithPopup
    try {
      await signInWithGooglePopup();
      setIsSigningIn(false);
      return;
    } catch (popupErr: unknown) {
      const code = extractSanitizedErrorCode(popupErr);
      setAuthErrorCode(code);

      // 2. For auth/popup-blocked, auth/cancelled-popup-request, or iframe restrictions, fallback to signInWithRedirect
      const shouldRedirect =
        code === "auth/popup-blocked" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment" ||
        (typeof window !== "undefined" && window.self !== window.top);

      if (shouldRedirect) {
        try {
          await signInWithGoogleRedirect();
          return;
        } catch (redirectErr: unknown) {
          const redirectCode = extractSanitizedErrorCode(redirectErr);
          setAuthErrorCode(redirectCode);
          setIsSigningIn(false);
          if (redirectCode === "auth/unauthorized-domain") {
            setError(
              `Domain '${typeof window !== "undefined" ? window.location.hostname : ""}' is not authorized in Firebase Console.`,
            );
          } else {
            setError(
              "Redirect sign-in was restricted by the browser sandbox. Please open the app in a top-level tab to sign in.",
            );
          }
          return;
        }
      }

      setIsSigningIn(false);
      if (code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed before completion. Please try again.");
      } else if (code === "auth/unauthorized-domain") {
        setError(
          `Domain '${typeof window !== "undefined" ? window.location.hostname : ""}' is not authorized in Firebase Console.`,
        );
      } else {
        setError("Sign-in could not finish. Please try again or open the app in a top-level tab.");
      }
    }
  }

  if (!ready) {
    return (
      <div className="loading-screen">
        <Logo />
        <LoaderCircle className="spin" />
      </div>
    );
  }

  if (!user && !demo) {
    return (
      <div className="landing">
        <nav>
          <Logo />
          <span className="eyebrow">YOUR LIFE. IN YOUR WORDS.</span>
          <button onClick={login} disabled={isSigningIn}>
            {isSigningIn ? "Signing in..." : "Sign in"} <ArrowUpRight size={16} />
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
              <br />A quiet space to remember, reflect, and find your next little
              adventure.
            </p>
            <button className="primary" onClick={login} disabled={isSigningIn}>
              {isSigningIn ? "Signing in..." : "Begin with Google"} <ArrowRight size={18} />
            </button>
            <button className="text-button" onClick={() => setDemo(true)}>
              Explore the design <ArrowUpRight size={16} />
            </button>
            {error && (
              <div role="alert" className="error" style={{ margin: "14px 0" }}>
                <p style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  {authErrorCode && (
                    <code
                      style={{
                        padding: "2px 6px",
                        background: "rgba(220, 38, 38, 0.12)",
                        borderRadius: "4px",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      {authErrorCode}
                    </code>
                  )}
                  <span>{error}</span>
                </p>
                {typeof window !== "undefined" && window.self !== window.top && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-button"
                    style={{ marginTop: "8px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    Open app in top-level tab <ArrowUpRight size={14} />
                  </a>
                )}
              </div>
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
  }

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
  const [data, setData] = useState<JournalData>(demo ? demoData : empty);
  const [tab, setTab] = useState<Tab>("Today");
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [capture, setCapture] = useState<{
    kind: MemoryKind;
    initial?: Memory;
  } | null>(null);
  const [selected, setSelected] = useState<Memory | null>(null);

  const [chatId, setChatId] = useState<string>("");
  const [chatText, setChatText] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [sendError, setSendError] = useState("");
  const [summaryStatus, setSummaryStatus] = useState<
    "idle" | "generating" | "saved" | "failed"
  >("idle");
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [usage, setUsage] = useState<AiUsage | null>(null);

  const [recap, setRecap] = useState<Recap | null>(null);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  });

  const alive = useRef(true);
  const draftsRef = useRef<Record<string, string>>({});
  const chatSending = useRef(false);
  const chatRequest = useRef<{
    content: string;
    id: string;
    conversationId: string;
  } | null>(null);

  useEffect(() => {
    alive.current = true;
    if (!demo) {
      void load().then((result) => {
        if (result?.preferences.automaticRecaps) {
          void api("/recaps/catch-up/run", "POST", {})
            .then(() => load())
            .catch((e) => {
              if (alive.current)
                setNotice("Automatic recap is pending: " + e.message);
            });
        }
      });
      void loadUsage();
    }
    return () => {
      alive.current = false;
      draftsRef.current = {};
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function loadUsage() {
    if (demo) return;
    try {
      const u = await api<AiUsage>("/usage");
      if (alive.current) setUsage(u);
    } catch {
      // Non-fatal if usage cannot be fetched
    }
  }

  async function load() {
    setError("");
    try {
      const result = await api<JournalData>("/journal");
      if (alive.current) {
        setData(result);
        setLoading(false);
      }
      void loadUsage();
      return result;
    } catch (e) {
      if (alive.current) {
        setError((e as Error).message);
        setLoading(false);
      }
    }
  }

  function requireLive() {
    if (demo) {
      throw new Error(
        "This is a design preview with fictional memories. Sign in to use your own journal.",
      );
    }
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

  function handleUpdateClosingLine(targetPeriod: string, line?: string) {
    setData((d) => ({
      ...d,
      recaps: d.recaps.map((r) =>
        r.period === targetPeriod ? { ...r, closingLine: line } : r,
      ),
    }));
    setRecap((r) =>
      r && r.period === targetPeriod ? { ...r, closingLine: line } : r,
    );
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

  function selectConversation(id: string) {
    draftsRef.current[chatId || "new"] = chatText;
    setChatId(id);
    setSources([]);
    setSendError("");
    setSummaryStatus("idle");
    const restored = draftsRef.current[id || "new"] || "";
    setChatText(restored);
  }

  async function send(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!chatText.trim() || busy || chatSending.current) return;
    chatSending.current = true;
    setSendError("");
    setSummaryStatus("generating");
    const currentText = chatText;
    const currentSources = [...sources];
    const targetConversationId = chatId || crypto.randomUUID();

    try {
      await run(async () => {
        requireLive();
        const request =
          chatRequest.current?.content === currentText &&
          chatRequest.current?.conversationId === targetConversationId
            ? chatRequest.current
            : {
                content: currentText,
                id: crypto.randomUUID(),
                conversationId: targetConversationId,
              };
        chatRequest.current = request;
        const saved = await api<Conversation>(
          "/conversations/" + request.conversationId + "/messages",
          "POST",
          { id: request.id, content: request.content, sourceIds: currentSources },
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
        draftsRef.current[saved.id] = "";
        draftsRef.current["new"] = "";
        setChatText("");
        chatRequest.current = null;
        setSummaryStatus(saved.summary ? "saved" : "idle");
        void loadUsage();
      });
    } catch (err) {
      if (alive.current) {
        setSendError((err as Error).message || "Message could not be sent.");
        setSummaryStatus("failed");
      }
    } finally {
      chatSending.current = false;
    }
  }

  function retrySend() {
    setSendError("");
    void send();
  }

  async function handleSummarize(targetId: string) {
    if (!targetId || summaryBusy || busy) return;
    setSummaryBusy(true);
    setSummaryStatus("generating");
    try {
      await run(async () => {
        requireLive();
        const updated = await api<Conversation>(
          "/conversations/" + targetId + "/summary",
          "POST",
        );
        if (!alive.current) return;
        setData((d) => ({
          ...d,
          conversations: [
            updated,
            ...d.conversations.filter((c) => c.id !== updated.id),
          ],
        }));
        setSummaryStatus("saved");
        void loadUsage();
      });
    } catch {
      if (alive.current) {
        setSummaryStatus("failed");
      }
    } finally {
      if (alive.current) setSummaryBusy(false);
    }
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
            onClick={() => {
              setTab("Settings");
              void loadUsage();
            }}
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
              <TodayView
                memories={data.memories}
                recommendations={data.recommendations}
                latestRecap={latestRecap || null}
                demo={demo}
                card={card}
                setCapture={setCapture}
                setTab={setTab}
                setRecap={setRecap}
                setSelected={setSelected}
              />
            )}
            {tab === "Memories" && (
              <MemoriesView
                visible={visible}
                filter={filter}
                search={search}
                card={card}
                setFilter={setFilter}
                setSearch={setSearch}
                setCapture={setCapture}
              />
            )}
            {tab === "Conversations" && (
              <ConversationsView
                conversations={data.conversations}
                conversation={conversation}
                chatId={chatId}
                sources={sources}
                chatText={chatText}
                memories={data.memories}
                busy={busy}
                sendError={sendError}
                summaryStatus={summaryStatus}
                summaryBusy={summaryBusy}
                setSources={setSources}
                setChatText={(text) => {
                  setChatText(text);
                  draftsRef.current[chatId || "new"] = text;
                }}
                send={send}
                retrySend={retrySend}
                selectConversation={selectConversation}
                deleteConversation={(c) => {
                  if (confirm("Delete this conversation and its summary?")) {
                    void run(async () => {
                      requireLive();
                      await api("/conversations/" + c.id, "DELETE");
                      if (chatId === c.id) {
                        setChatId("");
                        setChatText("");
                        delete draftsRef.current[c.id];
                      }
                      await load();
                    });
                  }
                }}
                summarizeConversation={handleSummarize}
              />
            )}
            {tab === "For you" && (
              <ForYouView
                recommendations={data.recommendations}
                preferences={data.preferences}
                memories={data.memories}
                busy={busy}
                setTab={setTab}
                setSelected={setSelected}
                onThinkThrough={(r) => {
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
                onRefreshRecommendations={() => {
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
              />
            )}
            {tab === "Recaps" && (
              <RecapsTab
                recaps={data.recaps}
                recap={recap}
                latestRecap={latestRecap || null}
                memories={data.memories}
                preferences={data.preferences}
                period={period}
                busy={busy}
                demo={demo}
                setPeriod={setPeriod}
                setRecap={setRecap}
                setTab={setTab}
                onCreateRecap={() => {
                  void run(async () => {
                    requireLive();
                    const r = await api<Recap>(
                      "/recaps/" + encodeURIComponent(period),
                      "POST",
                      {},
                    );
                    setRecap(r);
                    await load();
                  });
                }}
                setSelected={setSelected}
                onReflect={(r) => {
                  setTab("Conversations");
                  setChatId("");
                  setSources(r.sourceIds.slice(0, 5));
                  setChatText(
                    "What would I like to carry forward from " +
                      r.title +
                      "?",
                  );
                }}
                onUpdateClosingLine={handleUpdateClosingLine}
              />
            )}
            {tab === "Settings" && (
              <>
                <section className="page-heading">
                  <div className="eyebrow">MAKE YOURSELF AT HOME</div>
                  <h1>A journal that knows your pace.</h1>
                  <p>
                    You choose what to keep, what to share with Gemini, and what
                    comes back to you.
                  </p>
                </section>
                <SettingsPanel
                  preferences={data.preferences}
                  usage={usage}
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
        <MemoryDetailModal
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
