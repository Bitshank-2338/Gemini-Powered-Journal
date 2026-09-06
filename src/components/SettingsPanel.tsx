import { useState, useEffect } from "react";
import { ShieldCheck, Download, Sparkles } from "lucide-react";
import type { Preferences, AiUsage } from "../../shared/journal";

export function SettingsPanel({
  preferences,
  usage,
  busy,
  save,
  exportJournal,
}: {
  preferences: Preferences;
  usage?: AiUsage | null;
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
          <span className="eyebrow">RATE LIMITS &amp; COSTS</span>
          <h2>Daily AI operations</h2>
          <div className="quota-display">
            <div className="quota-bar-wrapper">
              <div
                className="quota-bar-fill"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((usage?.used ?? 0) / (usage?.dailyLimit ?? 20)) * 100,
                    ),
                  )}%`,
                }}
              />
            </div>
            <div className="quota-numbers">
              <span>
                <strong>{usage ? usage.used : 0}</strong> of{" "}
                <strong>{usage ? usage.dailyLimit : 20}</strong> operations used today
              </span>
              <span>
                {usage ? usage.remaining : 20} remaining
              </span>
            </div>
          </div>
          <p className="fineprint">
            Covers Gemini reflections, conversation summaries, recommended ideas, voice transcriptions, and periodic recaps. Resets at midnight UTC.
          </p>
          <p className="fineprint">
            Paid plans and limit increases are not active yet. No billing configuration or payment details are needed.
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
