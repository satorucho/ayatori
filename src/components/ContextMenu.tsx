import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ContextMenuEntry =
  | { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }
  | { type: "divider" };

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const clampedX = Math.min(x, window.innerWidth - 240);
  const clampedY = Math.min(y, window.innerHeight - items.length * 30 - 20);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[200px] py-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-gray-200/80 dark:border-gray-600/80 rounded-lg shadow-lg shadow-black/10 select-none"
      style={{ left: clampedX, top: clampedY }}
    >
      {items.map((item, i) => {
        if ("type" in item && item.type === "divider") {
          return (
            <div key={i} className="my-1 mx-2 h-px bg-gray-200 dark:bg-gray-600" />
          );
        }
        const entry = item as Exclude<ContextMenuEntry, { type: "divider" }>;
        return (
          <button
            key={i}
            disabled={entry.disabled}
            className={`w-full text-left px-3 py-[5px] text-[13px] leading-tight rounded-[4px] hover:bg-blue-500 hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-current transition-colors ${
              entry.danger ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"
            }`}
            onClick={() => {
              entry.onClick();
              onClose();
            }}
          >
            {entry.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
