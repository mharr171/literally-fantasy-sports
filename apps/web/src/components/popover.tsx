"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

/**
 * A pop-up that opens beside its trigger, centred up and down on the screen
 * so it can be read without scrolling (D155). Taller than the screen, it
 * scrolls inside itself. Opens on hover with a mouse and on tap on touch
 * screens; Escape, a click elsewhere or scrolling the page closes it.
 */
export function Popover({
  label,
  trigger,
  children,
  width = 304,
  triggerClassName = "",
}: {
  /** Accessible name for the pop-up, e.g. "Sam Rivera's card". */
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  width?: number;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(8);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const show = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const r = button.current?.getBoundingClientRect();
    if (r)
      setLeft(Math.max(8, Math.min(r.left, window.innerWidth - width - 8)));
    setOpen(true);
  }, [width]);
  const hideSoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 200);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t))
        setOpen(false);
    };
    // Scrolling the page closes it; scrolling inside it doesn't.
    const onScroll = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) setOpen(false);
          else show();
        }}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={(e) => e.pointerType === "mouse" && hideSoon()}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={label}
          onPointerEnter={(e) => e.pointerType === "mouse" && show()}
          onPointerLeave={(e) => e.pointerType === "mouse" && hideSoon()}
          style={{ left, maxWidth: `calc(100vw - 16px)` }}
          className="fixed top-1/2 z-50 max-h-[calc(100dvh-16px)] -translate-y-1/2 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 bg-white p-3 text-zinc-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {children}
        </div>
      )}
    </>
  );
}
