import { BookOpen, ArrowRight } from "lucide-react";

export function Empty({
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
