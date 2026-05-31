"use client";
import { useEffect, useState } from "react";
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

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem("currentUser");
    if (!userId) { router.push("/"); return; }
    const found = STAFF.find((s) => s.id === userId);
    if (!found) { router.push("/"); return; }
    setUser(found);
  }, [router]);

  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex">
      <aside className="w-60 bg-[#131316] border-r border-zinc-800 flex flex-col">
        <div className="px-6 py-6 border-b border-zinc-800">
          <h1 className="text-xl font-black tracking-tight">TASK<span className="text-yellow-400">FORCE</span></h1>
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mt-1">Brownie Heaven</p>
        </div>
        <nav className="flex-1 px-3 py-4">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest px-3 pb-2">Workspace</p>
          <div className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white bg-zinc-900 border-l-2 border-yellow-400">
            <span>▣</span> Dashboard
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-500 hover:text-white cursor-pointer">
            <span>≡</span> Tasks
          </div>
          {user.role === "Owner" && (
            <>
              <div className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-500 hover:text-white cursor-pointer">
                <span>◉</span> Staff
              </div>
              <div classNa
