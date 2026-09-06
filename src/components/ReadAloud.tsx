import { useEffect, useRef, useState } from "react";
export function ReadAloud({text}: {text: string}) {
  const [playing, setPlaying] = useState(false);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const stop = () => { speechSynthesis.cancel(); utterance.current = null; setPlaying(false); };
  useEffect(() => () => { if (utterance.current) speechSynthesis.cancel(); }, [text]);
  if (!("speechSynthesis" in window)) return null;
  return <button className="text-button" aria-label={playing ? "Stop reading" : "Listen with device voice"} onClick={() => {
    if (playing) { stop(); return; }
    speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(text);
    utterance.current = speech;
    speech.onend = speech.onerror = () => { if (utterance.current === speech) { utterance.current = null; setPlaying(false); } };
    setPlaying(true); speechSynthesis.speak(speech);
  }}>{playing ? "Stop reading" : "Listen · device voice"}</button>;
}
