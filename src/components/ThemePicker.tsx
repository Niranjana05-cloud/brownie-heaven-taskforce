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
  const { theme, accent, setTheme, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Theme"
        className="text-[10px] font-mono text-text-faint uppercase hover:text-accent transition-colors shrink-0"
      >
        🎨
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-52 bg-surface border border-line shadow-xl p-3 z-50">
          <p className="text-[10px] font-mono text-text-faint uppercase tracking-widest mb-2">Appearance</p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTheme("dark")}
              className={`flex-1 text-xs font-semibold py-1.5 border transition-colors ${theme === "dark" ? "border-accent text-accent" : "border-line text-text-muted hover:text-text"}`}
            >
              Dark
            </button>
            <button
              onClick={() => setTheme("light")}
              className={`flex-1 text-xs font-semibold py-1.5 border transition-colors ${theme === "light" ? "border-accent text-accent" : "border-line text-text-muted hover:text-text"}`}
            >
              Light
            </button>
          </div>
          <p className="text-[10px] font-mono text-text-faint uppercase tracking-widest mb-2">Accent</p>
          <div className="flex gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                title={a.label}
                className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center"
                style={{ backgroundColor: a.swatch, outline: accent === a.id ? "2px solid var(--color-text)" : "none", outlineOffset: "2px" }}
              />
            ))}
          </div>
          <p className="text-[10px] text-text-faint mt-3">Saved on this device only.</p>
        </div>
      )}
    </div>
  );
}
