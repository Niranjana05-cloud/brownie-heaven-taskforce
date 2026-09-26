"use client";
import { useState, useRef, useEffect } from "react";
import { useTheme, ThemeAccent } from "@/lib/theme";

const ACCENTS: { id: ThemeAccent; label: string; swatch: string }[] = [
  { id: "yellow", label: "Yellow", swatch: "#facc15" },
  { id: "blue", label: "Blue", swatch: "#60a5fa" },
  { id: "green", label: "Green", swatch: "#4ade80" },
  { id: "pink", label: "Pink", swatch: "#f472b6" },
  { id: "orange", label: "Orange", swatch: "#fb923c" },
];

export default function ThemePicker() {
  const { theme, accent, brownieMode, muted, setTheme, setAccent, setBrownieMode, setMuted } = useTheme();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const currentSwatch = ACCENTS.find((a) => a.id === accent)?.swatch || "#facc15";

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="fixed top-4 right-4 z-[60]">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Change theme"
        className="w-11 h-11 rounded-full bg-surface border-2 flex items-center justify-center text-lg shadow-lg hover:scale-105 transition-transform"
        style={{ borderColor: currentSwatch }}
      >
        🎨
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-surface border border-line shadow-2xl p-4 rounded-md">
          <p className="text-[11px] font-mono text-text-faint uppercase tracking-widest mb-2">Appearance</p>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTheme("dark")}
              className={`flex-1 text-sm font-semibold py-2 border rounded transition-colors ${theme === "dark" ? "border-accent text-accent" : "border-line text-text-muted hover:text-text"}`}
            >
              Dark
            </button>
            <button
              onClick={() => setTheme("light")}
              className={`flex-1 text-sm font-semibold py-2 border rounded transition-colors ${theme === "light" ? "border-accent text-accent" : "border-line text-text-muted hover:text-text"}`}
            >
              Light
            </button>
          </div>
          <p className="text-[11px] font-mono text-text-faint uppercase tracking-widest mb-2">Accent color</p>
          <div className="flex gap-3">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                title={a.label}
                className="w-7 h-7 rounded-full shrink-0"
                style={{ backgroundColor: a.swatch, outline: accent === a.id ? "2px solid var(--color-text)" : "none", outlineOffset: "2px" }}
              />
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-line">
            <button
              onClick={() => setBrownieMode(!brownieMode)}
              className={`w-full flex items-center justify-between text-sm font-semibold py-2 px-2.5 border rounded transition-colors ${brownieMode ? "border-accent text-accent" : "border-line text-text-muted hover:text-text"}`}
            >
              <span>🍫 Brownie mode</span>
              <span className="text-[10px] font-mono uppercase">{brownieMode ? "On" : "Off"}</span>
            </button>
            {brownieMode && (
              <button
                onClick={() => setMuted(!muted)}
                className="w-full flex items-center justify-between text-xs text-text-muted hover:text-text py-2 px-2.5 mt-1"
              >
                <span>{muted ? "🔇" : "🔊"} Sound effects</span>
                <span className="text-[10px] font-mono uppercase">{muted ? "Muted" : "On"}</span>
              </button>
            )}
          </div>
          <p className="text-[10px] text-text-faint mt-3">Saved on this device only.</p>
        </div>
      )}
    </div>
  );
}
