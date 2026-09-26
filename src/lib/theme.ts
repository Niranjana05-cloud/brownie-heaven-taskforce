"use client";
import { useEffect, useState } from "react";

// Personal, per-device theme — saved in this browser only, not synced
// across devices or staff (each person picks their own on each device).
export type ThemeMode = "dark" | "light";
export type ThemeAccent = "yellow" | "blue" | "green" | "pink" | "orange";

const THEME_KEY = "tf_theme";
const ACCENT_KEY = "tf_accent";
const EVENT = "tf_theme_change";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(THEME_KEY) as ThemeMode) || "dark";
}
export function getStoredAccent(): ThemeAccent {
  if (typeof window === "undefined") return "yellow";
  return (localStorage.getItem(ACCENT_KEY) as ThemeAccent) || "yellow";
}

function applyToDocument(theme: ThemeMode, accent: ThemeAccent) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-accent", accent);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [accent, setAccentState] = useState<ThemeAccent>("yellow");

  useEffect(() => {
    const t = getStoredTheme();
    const a = getStoredAccent();
    setThemeState(t);
    setAccentState(a);
    applyToDocument(t, a);

    const onChange = () => {
      setThemeState(getStoredTheme());
      setAccentState(getStoredAccent());
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setTheme = (t: ThemeMode) => {
    localStorage.setItem(THEME_KEY, t);
    setThemeState(t);
    applyToDocument(t, accent);
    window.dispatchEvent(new Event(EVENT));
  };
  const setAccent = (a: ThemeAccent) => {
    localStorage.setItem(ACCENT_KEY, a);
    setAccentState(a);
    applyToDocument(theme, a);
    window.dispatchEvent(new Event(EVENT));
  };

  return { theme, accent, setTheme, setAccent };
}
