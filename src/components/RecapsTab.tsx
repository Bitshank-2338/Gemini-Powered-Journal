import { LoaderCircle, Sparkles, Settings } from "lucide-react";
import type { Memory, Preferences, Recap, Tab } from "../../shared/journal";
import { PageHeading } from "./PageHeading";
import { Empty } from "./Empty";
import { RecapView, periodLabel } from "./RecapView";

export function RecapsTab({
  recaps,
  recap,
  latestRecap,
  memories,
  preferences,
  period,
  busy,
  demo,
  setPeriod,
  setRecap,
  setTab,
  onCreateRecap,
  setSelected,
  onReflect,
  onUpdateClosingLine,
}: {
  recaps: Recap[];
  recap: Recap | null;
  latestRecap: Recap | null;
  memories: Memory[];
  preferences: Preferences;
  period: string;
  busy: boolean;
  demo: boolean;
  setPeriod: (p: string) => void;
  setRecap: (r: Recap | null) => void;
  setTab: (t: Tab) => void;
  onCreateRecap: () => void;
  setSelected: (m: Memory | null) => void;
  onReflect: (r: Recap) => void;
  onUpdateClosingLine: (period: string, line?: string) => void;
}) {
  const activeRecap = recap || latestRecap;

  return (
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
          <button disabled={busy} onClick={onCreateRecap}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            Create recap
          </button>
        </div>
        <button className="text-button" onClick={() => setTab("Settings")}>
          <span
            className={
              "tiny-dot " + (!preferences.automaticRecaps ? "muted-dot" : "")
            }
          />
          Automatic recaps {preferences.automaticRecaps ? "on" : "off"}
          <Settings size={16} />
        </button>
      </div>
      <div className="recap-tabs">
        {recaps.map((r) => (
          <button
            className={activeRecap?.id === r.id ? "selected" : ""}
            key={r.id}
            onClick={() => setRecap(r)}
          >
            {periodLabel(r.period)}
          </button>
        ))}
      </div>
      {activeRecap ? (
        <RecapView
          recap={activeRecap}
          memories={memories}
          demo={demo}
          open={setSelected}
          reflect={onReflect}
          onUpdateClosingLine={onUpdateClosingLine}
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
  );
}
