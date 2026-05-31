"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Staff = { id: string; name: string; role: string; report_time: string | null };
type Task = { id: string; title: string; status: string; priority: string; due_at: string; assigned_to: string; assigned_by: string };

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Staff | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (!stored) { router.push("/"); return; }
    const parsed = JSON.parse(stored);
    setUser(parsed);
    fetchTasks(parsed);
  }, [router]);

  const fetchTasks = async (u: Staff) => {
    setLoading(true);
    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (u.role !== "Owner" && u.role !== "Manager") {
      query = query.eq("assigned_to", u.id);
    }
    const { data } = await query;
    setTasks(data || []);
    setLoading(false);
  };

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const overdue = tasks.filter(t => t.status === "overdue").length;
  const rate = total > 0 ? Math.round(completed / total * 100) : 0;

  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex">
      <aside className="w-60 bg-[#131316] border-r border-zinc-800 flex flex-col shrink-0">
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
          {(user.role === "Owner" || user.role === "Manager") && (
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
          <div className="w-9 h-9 bg-yellow-400 text-black flex items-center justify-center font-bold text-sm shrink-0">
            {user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wide">{user.role}</p>
          </div>
          <button onClick={() => { localStorage.removeItem("currentUser"); router.push("/"); }} className="text-[11px] font-mono text-zinc-600 uppercase hover:text-red-500 transition-colors shrink-0">
            Exit
          </button>
        </div>
      </aside>

      <main className="flex-1 p-10 overflow-auto">
        <div className="flex justify-between items-end mb-8 pb-5 border-b border-zinc-800">
          <div>
            <h2 className="text-3xl font-black tracking-tight">{user.role === "Owner" ? "Command Center" : "My Tasks"}</h2>
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Welcome back, {user.name.split(" ")[0]} — system online</p>
          </div>
          {(user.role === "Owner" || user.role === "Manager") && (
            <button className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-5 py-3 hover:opacity-90 transition-opacity uppercase">
              + Assign Task
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-px bg-zinc-800 border border-zinc-800 mb-8">
          {[
            { label: "Total Tasks", value: total, sub: "assigned", color: "" },
            { label: "Completed", value: completed, sub: `${rate}% rate`, color: "text-green-400" },
            { label: "In Progress", value: inProgress, sub: "active", color: "text-yellow-400" },
            { label: "Overdue", value: overdue, sub: overdue > 0 ? "needs action" : "all clear", color: overdue > 0 ? "text-red-500" : "" },
          ].map((s) => (
            <div key={s.label} className="bg-[#131316] p-5">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">{s.label}</p>
              <p className={`text-4xl font-black tracking-tight ${s.color}`}>{s.value}</p>
              <p className="text-[11px] font-mono text-zinc-600 mt-1.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="bg-[#131316] border border-zinc-800 p-10 text-center">
            <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-[#131316] border border-zinc-800 p-10 text-center">
            <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">No tasks yet</p>
          </div>
        ) : (
          <div className="bg-[#131316] border border-zinc-800">
            {tasks.map((t) => (
              <div key={t.id} className={`grid grid-cols-[8px_1fr_120px_100px] gap-4 items-center px-5 py-4 border-b border-zinc-800 last:border-0 hover:bg-zinc-900 transition-colors ${t.status === "overdue" ? "border-l-2 border-l-red-500" : ""}`}>
                <div className={`w-2 h-2 rounded-full ${t.priority === "critical" ? "bg-red-500" : t.priority === "high" ? "bg-orange-400" : t.priority === "medium" ? "bg-yellow-400" : "bg-zinc-600"}`} />
                <div>
                  <p className="font-semibold text-sm">{t.title}</p>
                  <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{t.due_at ? new Date(t.due_at).toLocaleString() : "No deadline"}</p>
                </div>
                <p className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 text-center ${
                  t.status === "completed" ? "bg-green-400/10 text-green-400" :
                  t.status === "overdue" ? "bg-red-500/10 text-red-500" :
                  t.status === "in_progress" ? "bg-yellow-400/10 text-yellow-400" :
                  "bg-zinc-800 text-zinc-500"
                }`}>{t.status.replace("_", " ")}</p>
                <p className={`font-mono text-[10px] uppercase tracking-widest text-center ${
                  t.priority === "critical" ? "text-red-500" :
                  t.priority === "high" ? "text-orange-400" :
                  t.priority === "medium" ? "text-yellow-400" : "text-zinc-600"
                }`}>{t.priority}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
