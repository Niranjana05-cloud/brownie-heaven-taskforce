"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STAFF = [
  { id: "nishant", name: "Nishant Vijayakumar", role: "Owner" },
  { id: "arun", name: "Arun Kumar", role: "Manager" },
  { id: "nilani", name: "Nilani Nallamuthu", role: "HR" },
  { id: "gowtham", name: "Gowtham", role: "Purchase Manager" },
  { id: "vishnu", name: "Vishnu", role: "Asst. Ops Manager" },
  { id: "ahila", name: "Ahila", role: "Custom Cakes & Asst Ops" },
  { id: "bharani", name: "Bharani", role: "Auditor" },
];

export default function LoginPage() {
  const [selectedUser, setSelectedUser] = useState("nishant");
  const router = useRouter();

  const handleLogin = () => {
    localStorage.setItem("currentUser", selectedUser);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-yellow-400/8 blur-[100px]" />
      <div className="relative z-10 w-[420px] bg-zinc-950 border border-zinc-800 p-12">
        <div className="border-b border-zinc-800 pb-6 mb-8">
          <h1 className="text-4xl font-black tracking-tight text-white">
            TASK<span className="text-yellow-400">FORCE</span>
          </h1>
          <p className="mt-1 text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
            Brownie Heaven // Staff Accountability System
          </p>
        </div>
        <div className="space-y-5">
          <div>
            <label className="block text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-2">
              Select User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-black border border-zinc-800 text-white px-4 py-3.5 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm"
            >
              {STAFF.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-2">
              Access Code
            </label>
            <input
              type="password"
              defaultValue="123456"
              className="w-full bg-black border border-zinc-800 text-white px-4 py-3.5 focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>
          <button
            onClick={handleLogin}
            className="w-full bg-yellow-400 text-black font-bold tracking-widest text-sm py-4 hover:opacity-90 transition-opacity uppercase mt-2"
          >
            Enter System →
          </button>
        </div>
        <div className="mt-6 p-3 bg-yellow-400/5 border-l-2 border-yellow-400 text-xs text-zinc-400 leading-relaxed">
          <strong className="text-white">BROWNIE HEAVEN.</strong> Internal use only. All actions are logged.
        </div>
      </div>
    </div>
  );
}
