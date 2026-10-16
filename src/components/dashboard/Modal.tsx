'use client'

import { useEffect, useState } from "react";

// Shared animated modal wrapper (moved out of the dashboard page so other pages can use it).
export function Modal({
  onClose,
  children,
  panelClassName = "w-full max-w-md",
}: {
  onClose: () => void;
  children: (args: { close: () => void }) => React.ReactNode;
  panelClassName?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 150);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={close}
    >
      <div
        className={`${panelClassName} rounded-xl border bg-card p-6 shadow-xl transition-all duration-200 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children({ close })}
      </div>
    </div>
  );
}
