"use client";

export default function HelpTab() {
  return (
    <div>
      <div className="mb-6 pb-5 border-b border-zinc-800">
        <h2 className="text-2xl font-black tracking-tight">Help</h2>
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Answers to common questions</p>
      </div>
      <div className="bg-[#131316] border border-zinc-800 p-8 text-center max-w-xl">
        <p className="text-4xl mb-3">🛠️</p>
        <p className="text-sm text-zinc-400">Still under construction — a set of common questions and answers will show up here soon.</p>
      </div>
    </div>
  );
}
