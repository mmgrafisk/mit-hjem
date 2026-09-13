import { useEffect, useRef } from "react";

export function useModalAccessibility(onClose: () => void, blockClose = false, active = true) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const blockCloseRef = useRef(blockClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { blockCloseRef.current = blockClose; }, [blockClose]);

  useEffect(() => {
    if (!active) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    window.setTimeout(() => focusable()[0]?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!blockCloseRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [active]);

  return dialogRef;
}
