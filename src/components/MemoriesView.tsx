import { Plus } from "lucide-react";
import type { Memory, MemoryKind } from "../../shared/journal";
import { PageHeading } from "./PageHeading";
import { Empty } from "./Empty";

export function MemoriesView({
  visible,
  filter,
  search,
  card,
  setFilter,
  setSearch,
  setCapture,
}: {
  visible: Memory[];
  filter: string;
  search: string;
  card: (m: Memory) => React.ReactNode;
  setFilter: (f: string) => void;
  setSearch: (s: string) => void;
  setCapture: (c: { kind: MemoryKind; initial?: Memory }) => void;
}) {
  return (
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
          text={
            search
              ? "Check your search terms or clear your search to see all memories."
              : "Try a different filter or keep a new moment."
          }
          label={search ? "Clear search" : "Keep a memory"}
          action={() => {
            setSearch("");
            setFilter("all");
            if (!search) setCapture({ kind: "text" });
          }}
        />
      )}
    </>
  );
}
