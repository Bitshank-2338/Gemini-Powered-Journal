import {
  Plus,
  MessagesSquare,
  Volume2,
  Sparkles,
  ArrowUpRight,
  BookOpen,
  X,
  Send,
  LoaderCircle,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { Conversation, Memory } from "../../shared/journal";
import { PageHeading } from "./PageHeading";

export function ConversationsView({
  conversations,
  conversation,
  chatId,
  sources,
  chatText,
  memories,
  busy,
  sendError,
  summaryStatus,
  summaryBusy,
  setSources,
  setChatText,
  send,
  retrySend,
  selectConversation,
  deleteConversation,
  summarizeConversation,
}: {
  conversations: Conversation[];
  conversation: Conversation | undefined;
  chatId: string;
  sources: string[];
  chatText: string;
  memories: Memory[];
  busy: boolean;
  sendError?: string;
  summaryStatus?: "idle" | "generating" | "saved" | "failed";
  summaryBusy?: boolean;
  setSources: React.Dispatch<React.SetStateAction<string[]>>;
  setChatText: (text: string) => void;
  send: (e?: React.FormEvent) => void;
  retrySend?: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (c: Conversation) => void;
  summarizeConversation: (id: string) => void;
}) {
  const isComposing = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    return e.nativeEvent.isComposing || e.keyCode === 229;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      if (isComposing(e)) return;
      e.preventDefault();
      if (!busy && chatText.trim()) {
        send();
      }
    }
  };

  return (
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
            onClick={() => selectConversation("")}
          >
            <Plus size={16} />
            New conversation
          </button>
          {conversations.map((c) => (
            <button
              key={c.id}
              className={c.id === chatId ? "selected" : ""}
              onClick={() => selectConversation(c.id)}
            >
              <MessagesSquare size={16} />
              <span>{c.title}</span>
            </button>
          ))}
          {!conversations.length && (
            <p className="fineprint">Your reflections will appear here.</p>
          )}
        </aside>
        <section className="chat-panel">
          <div className="chat-messages" aria-live="polite">
            {conversation?.messages.length ? (
              conversation.messages.map((m) => (
                <div key={m.id} className={"chat-message " + m.role}>
                  <span>{m.role === "user" ? "YOU" : "GEMINI"}</span>
                  <p>{m.content}</p>
                  {m.role === "assistant" && "speechSynthesis" in window && (
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
                  Untangle an idea, revisit a memory, or simply talk about your
                  day.
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
                  {memories.find((m) => m.id === id)?.title}
                  <button
                    aria-label={"Remove " + (memories.find((m) => m.id === id)?.title || "memory") + " from context"}
                    onClick={() => setSources((s) => s.filter((x) => x !== id))}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {sendError && (
            <div className="composer-error-bar" role="alert">
              <span>{sendError}</span>
              {retrySend && (
                <button type="button" onClick={retrySend}>
                  <RotateCcw size={14} /> Retry send
                </button>
              )}
            </div>
          )}

          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              send(e);
            }}
          >
            <label htmlFor="chat-message-input" className="sr-only">
              Your message to Gemini
            </label>
            <textarea
              id="chat-message-input"
              aria-label="Your message to Gemini"
              rows={3}
              value={chatText}
              maxLength={6000}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Say what’s on your mind… (Ctrl+Enter to send)"
            />
            <div className="chat-composer-footer">
              <div className="chat-shortcut-hint">
                <span>Press</span>
                <kbd>Ctrl</kbd>+<kbd>Enter</kbd>
                <span>or</span>
                <kbd>Cmd</kbd>+<kbd>Enter</kbd>
                <span>to send</span>
              </div>
              <button
                type="submit"
                className="chat-send-button"
                disabled={busy || !chatText.trim()}
                aria-label={busy ? "Sending to Gemini…" : "Send to Gemini"}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
                <span>{busy ? "Sending to Gemini…" : "Send to Gemini"}</span>
              </button>
            </div>
          </form>
          <div className="chat-footnote">
            Messages and selected memories are sent to Gemini. Check its
            reflections against your own experience.
          </div>
        </section>
        <aside className="summary-panel" aria-label="Conversation summary">
          <div className="summary-panel-header">
            <span className="eyebrow">THE THREAD OF YOUR THOUGHTS</span>
            <h2>Summary</h2>
            <div className="summary-status-row">
              {summaryStatus === "generating" && (
                <span className="summary-badge generating">
                  <LoaderCircle className="spin" size={13} /> Generating…
                </span>
              )}
              {summaryStatus === "saved" && (
                <span className="summary-badge saved">
                  <CheckCircle2 size={13} /> Summary saved
                </span>
              )}
              {summaryStatus === "failed" && (
                <span className="summary-badge failed">
                  <AlertCircle size={13} /> Summary incomplete
                </span>
              )}
            </div>
          </div>

          <p>
            {conversation?.summary ||
              (conversation?.messages.length
                ? "A summary will appear here after Gemini replies."
                : "Start a conversation to see Gemini’s summary.")}
          </p>

          <p className="summary-explanation">
            Your conversation is summarized and saved after each reply. You can also request an immediate summary below.
          </p>

          {conversation && conversation.messages.length > 0 && (
            <div className="summary-actions">
              <button
                className="secondary small"
                disabled={busy || summaryBusy}
                onClick={() => summarizeConversation(conversation.id)}
              >
                {summaryBusy ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <Sparkles size={14} />
                )}
                {summaryBusy
                  ? "Summarizing…"
                  : conversation.summary
                    ? "Update summary"
                    : "Summarize conversation"}
              </button>
            </div>
          )}

          {conversation && (
            <button
              className="text-button danger"
              onClick={() => deleteConversation(conversation)}
            >
              <Trash2 size={15} />
              Delete conversation
            </button>
          )}
        </aside>
      </div>
    </>
  );
}
