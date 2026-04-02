"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface ContextMenuItem {
  label: string;
  onClick: () => void | Promise<void>;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const safe = 8;
      let left = x;
      let top = y;
      if (left + rect.width > vw - safe) left = vw - rect.width - safe;
      if (left < safe) left = safe;
      if (top + rect.height > vh - safe) top = vh - rect.height - safe;
      if (top < safe) top = safe;
      setPosition({ left, top });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClick = () => onClose();
    const handleEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[140px] py-1 bg-gray-800 text-gray-100 border border-gray-700 rounded shadow-lg"
      style={{ left: position.left, top: position.top }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="w-full px-4 py-3 min-h-[44px] text-left text-sm hover:bg-gray-700 active:bg-gray-600 touch-manipulation flex items-center"
          onClick={async (e) => {
            e.stopPropagation();
            await item.onClick();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
