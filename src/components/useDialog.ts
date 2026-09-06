import { useEffect, useRef } from "react";
export function useDialog() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const shell = document.querySelector(".main"),
      nav = document.querySelector(".mobile-nav"),
      sidebar = document.querySelector(".sidebar");
    const background = [shell, nav, sidebar].filter(Boolean) as HTMLElement[];
    background.forEach((el) => (el.inert = true));
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not([type=hidden]):not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length);
    const first = focusable()[0];
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault();
        items.at(-1)!.focus();
      } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
        e.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      background.forEach((el) => (el.inert = false));
      before?.focus();
    };
  }, []);
  return ref;
}
