import { useEffect, useState } from "react";
import { Mic, Video, FileText, Image } from "lucide-react";
import type { Memory } from "../../shared/journal";
import { mediaBlob } from "../client";
import { Waveform } from "./Capture";
export function MemoryMedia({
  memory,
  demo = false,
  controls = false,
}: {
  memory: Memory;
  demo?: boolean;
  controls?: boolean;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let gone = false,
      u = "";
    setUrl("");
    setError(false);
    if (demo || !memory.media) return;
    mediaBlob(memory.id)
      .then((b) => {
        if (!gone) {
          u = URL.createObjectURL(b);
          setUrl(u);
        }
      })
      .catch(() => {
        if (!gone) setError(true);
      });
    return () => {
      gone = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [memory.id, memory.media?.size, demo]);
  if (demo && memory.kind === "image")
    return (
      <img
        src="/demo/coast.png"
        alt="Illustrative coastal scene for the demo"
      />
    );
  if (url && memory.kind === "image")
    return <img src={url} alt={memory.title} />;
  if (url && controls)
    return memory.kind === "audio" ? (
      <audio controls src={url} />
    ) : (
      <video controls src={url} />
    );
  const Icon =
    memory.kind === "audio"
      ? Mic
      : memory.kind === "video"
        ? Video
        : memory.kind === "image"
          ? Image
          : FileText;
  return (
    <div className={"media-placeholder " + memory.kind}>
      {memory.kind === "audio" ? <Waveform /> : <Icon size={30} />}
      <span>
        {error
          ? "Attachment unavailable"
          : memory.media && !url && !demo
            ? "Loading attachment…"
            : memory.kind === "text"
              ? memory.text.slice(0, 115)
              : demo
                ? "Illustrative " + memory.kind + " memory"
                : memory.media
                  ? "Open to play"
                  : "Attachment not saved"}
      </span>
    </div>
  );
}
