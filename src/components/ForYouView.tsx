import {
  Sparkles,
  LoaderCircle,
  Compass,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import type {
  Memory,
  Preferences,
  Recommendation,
  Tab,
} from "../../shared/journal";
import { PageHeading } from "./PageHeading";
import { Empty } from "./Empty";

export function ForYouView({
  recommendations,
  preferences,
  memories,
  busy,
  setTab,
  setSelected,
  onThinkThrough,
  onRefreshRecommendations,
}: {
  recommendations: Recommendation[];
  preferences: Preferences;
  memories: Memory[];
  busy: boolean;
  setTab: (t: Tab) => void;
  setSelected: (m: Memory | null) => void;
  onThinkThrough: (r: Recommendation) => void;
  onRefreshRecommendations: () => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="INSPIRED BY YOU"
        title="Follow your curiosity."
        subtitle="Small ideas for a life that feels a little more like yours."
      />
      <div className="personalization-bar">
        <p>
          {preferences.personalized
            ? "Based on your chosen interests and your most recent saved words."
            : "Personalized ideas are off. Choose your interests and turn them on in Settings."}
        </p>
        <button
          className="primary small"
          disabled={busy}
          onClick={() => {
            if (!preferences.personalized) {
              setTab("Settings");
              return;
            }
            onRefreshRecommendations();
          }}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Sparkles size={16} />
          )}{" "}
          {preferences.personalized ? "Find new ideas" : "Personalize my journal"}
        </button>
      </div>
      <div className="interest-pills">
        {preferences.interests.map((i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
      <div className="recommendation-grid">
        {recommendations.map((r, i) => (
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
                    setSelected(memories.find((m) => m.id === id) || null)
                  }
                >
                  <BookOpen size={14} />
                  {memories.find((m) => m.id === id)?.title || "Source memory"}
                </button>
              ))}
            </div>
            <button
              className="text-button"
              onClick={() => onThinkThrough(r)}
            >
              Think this through <ArrowUpRight size={16} />
            </button>
          </article>
        ))}
      </div>
      {!recommendations.length && (
        <Empty
          title="Let’s start with what you love."
          text="Ideas appear here after you enable personalization and ask Gemini for inspiration."
          action={() => setTab("Settings")}
          label="Choose my interests"
        />
      )}
    </>
  );
}
