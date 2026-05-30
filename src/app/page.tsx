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
      {/* Sidebar */}
      <aside className="w-60 bg-[#131316] border-r border-zinc-800 flex flex-col">
        <div className="px-6 py-6 border-b border-zinc-800">
          <h1 className="text-xl font-black tracking-tight">
            TASK<span className="text-yellow-400">FORCE</span>
          </h1>
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mt-1">
            Brownie Heaven
          </p>
        </div>
        <nav className="flex-1 px-3 py-4">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest px-3 pb-2">
            Workspace
          </p>
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
              <div className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-500 hover:text-white cursor-pointer">
                <span>◬</span> Analytics
              </div>
            </>
          )}
        </nav>
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center gap-3">
          <div className="w-9 h-9 bg-yellow-400 text-black flex items-center justify-center font-bold text-sm">
            {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wide">{user.role}</p>
          </div>
          <button
            onClick={() => { localStorage.removeItem("currentUser"); router.push("/"); }}
            className="text-[11px] font-mono text-zinc-600 uppercase hover:text-red-500 transition-colors"
          >
            Exit
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-10">
        <div className="flex justify-between items-end mb-8 pb-5 border-b border-zinc-800">
          <div>
            <h2 className="text-3xl font-black tracking-tight">
              {user.role === "Owner" ? "Command Center" : "My Tasks"}
            </h2>
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
              Welcome back, {user.name.split(" ")[0]} — system online
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-px bg-zinc-800 border border-zinc-800 mb-8">
          {[
            { label: "Total Tasks", value: "0", sub: "today" },
            { label: "Completed", value: "0", sub: "0% rate", color: "text-green-400" },
            { label: "In Progress", value: "0", sub: "active", color: "text-yellow-400" },
            { label: "Overdue", value: "0", sub: "needs action", color: "text-red-500" },
          ].map((s) => (
            <div key={s.label} className="bg-[#131316] p-5">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">{s.label}</p>
              <p className={`text-4xl font-black tracking-tight ${s.color ?? ""}`}>{s.value}</p>
              <p className="text-[11px] font-mono text-zinc-600 mt-1.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Empty state */}
        <div className="bg-[#131316] border border-zinc-800 p-10 text-center">
          <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">
            No tasks yet — database coming next
          </p>
        </div>
      </main>
    </div>
  );
}
