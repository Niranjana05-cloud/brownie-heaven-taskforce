"use client";
import { useEffect, useRef, useState } from "react";
import { playCrackSound } from "@/lib/crackSound";

// Fires a short brownie-breaking animation + sound whenever `tick` changes.
// Only meant to be mounted once (in the dashboard shell) and only shown
// when Brownie mode is on — the parent decides that, this just reacts to
// `tick` incrementing.
export default function BrownieLoader({ tick }: { tick: number }) {
  const [visible, setVisible] = useState(false);
  const [cracked, setCracked] = useState(false);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; } // don't fire on initial mount
    setVisible(true);
    setCracked(false);
    const crackTimer = setTimeout(() => {
      setCracked(true);
      playCrackSound();
    }, 260);
    const hideTimer = setTimeout(() => setVisible(false), 950);
    return () => { clearTimeout(crackTimer); clearTimeout(hideTimer); };
  }, [tick]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/70 backdrop-blur-sm pointer-events-none">
      <div className="relative w-40 h-40 md:w-52 md:h-52">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/whole.png"
          alt=""
          className="absolute inset-0 w-full h-full object-contain transition-all duration-150"
          style={{ opacity: cracked ? 0 : 1, transform: cracked ? "scale(0.9)" : "scale(1)" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/broken.png"
          alt=""
          className="absolute inset-0 w-full h-full object-contain transition-all duration-300"
          style={{
            opacity: cracked ? 1 : 0,
            transform: cracked ? "scale(1.08) translateY(4px)" : "scale(0.85)",
          }}
        />
      </div>
    </div>
  );
}
