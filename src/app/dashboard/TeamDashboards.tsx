"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import MyOutletsDashboard from "./MyOutletsDashboard";

type StaffLite = { id: string; name: string; role: string; outlets?: string[] };
type Task = { id: string; title: string; description: string; status: string; priority: string; due_at: string };

const HAS_OUTLETS = new Set(["vishnu", "ahila"]);

export default function TeamDashboards({ staffList }: { staffList: StaffLite[] }) {
  const [selectedId, setSelectedId] = useState<string>(staffList[0]?.id || "");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const selected = staffList.find((s) => s.id === selectedId) || null;
  const showsOutlets = selected && HAS_OUTLETS.has(selected.id);

  useEffect(() => {
    if (!selected || showsOutlets) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_at")
        .eq("assigned_to", selected.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setTasks(data || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div>
      <div className="mb-6 pb-5 border-b border-zinc-800">
        <h2 className="text-2xl font-black tracking-tight">Team Dashboards</h2>
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">View only — no editing from here</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {staffList.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            className={`text-xs font-mono uppercase px-4 py-2 border transition-colors ${selectedId === s.id ? "border-yellow-400 text-yellow-400 bg-yellow-400/5" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {!selected ? (
        <p className="text-sm text-zinc-500">Pick someone above.</p>
      ) : showsOutlets ? (
        <MyOutletsDashboard user={selected} />
      ) : (
        <div>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-4">
            {selected.name} — {selected.role} — no outlet dashboard yet, showing their task list
          </p>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-zinc-500">No tasks found for {selected.name}.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="border border-zinc-800 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{t.title}</p>
                    {t.description && <p className="text-xs text-zinc-500 mt-0.5">{t.description}</p>}
                    <p className="text-[10px] font-mono text-zinc-600 uppercase mt-1">Due {new Date(t.due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                  </div>
                  <span className={`text-[10px] font-mono uppercase px-2 py-1 shrink-0 ${t.status === "completed" ? "bg-green-400/10 text-green-400" : t.status === "overdue" ? "bg-red-500/10 text-red-400" : "bg-zinc-800 text-zinc-400"}`}>
                    {t.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
