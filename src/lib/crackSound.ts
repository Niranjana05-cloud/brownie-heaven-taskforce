"use client";
import { getStoredMuted } from "./theme";

// A synthesized "snap/crack" sound — no audio file needed. Built with the
// Web Audio API: a short burst of filtered noise (the "crack") plus a quick
// low thump underneath (the "weight" of the pieces landing). Good enough as
// a placeholder; swap in a real recorded sound later by replacing this file
// with an <audio> based player if you get a proper sound effect.
let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const AC = window.AudioContext || w.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function playCrackSound() {
  if (getStoredMuted()) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Noise burst — the "crack"
  const bufferSize = audioCtx.sampleRate * 0.15;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // sharp decay envelope so it reads as a snap, not static
    const decay = Math.pow(1 - i / bufferSize, 6);
    data[i] = (Math.random() * 2 - 1) * decay;
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const bandpass = audioCtx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(1800, now);
  bandpass.frequency.exponentialRampToValueAtTime(500, now + 0.12);
  bandpass.Q.value = 0.8;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  noise.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);

  // Low thump underneath — pieces settling
  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);
  const oscGain = audioCtx.createGain();
  oscGain.gain.setValueAtTime(0.35, now + 0.02);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(oscGain);
  oscGain.connect(audioCtx.destination);

  noise.start(now);
  noise.stop(now + 0.16);
  osc.start(now + 0.02);
  osc.stop(now + 0.26);
}
