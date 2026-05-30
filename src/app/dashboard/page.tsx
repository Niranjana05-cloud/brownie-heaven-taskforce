"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STAFF: Record<string, { name: string; role: string; initials: string }> = {
  nishant: { name: "Nishant Vijayakumar", role: "Owner", initials: "NV" },
  arun: { name: "Arun Kumar", role: "Manager", initials: "AK" },
  nilani: { name: "Nilani Nallamuthu", role: "HR", initials: "NN" },
  gowtham: { name: "Gowtham", role: "Purchase Manager", initials: "GO" },
  vishnu: { name: "Vishnu", role: "Asst. Operation Manager", initials: "VI" },
  ahila: { name: "Ahila", role: "Custom Cakes & Asst Ops", initials: "AH" },
  bharani: { name: "Bharani", role: "Auditor", initials: "BH" },
};

const SAMPLE_TASKS = [
  { id: 1, title: "Previous day sales review", time: "8:30 AM - 9:30 AM", status: "completed", priority: "high" },
  { id: 2, title: "Outlet manager morning calls", time: "9:30 AM - 10:30 AM", status: "in_progress", priority: "high" },
  { id: 3, title: "Online platform audit (Swiggy/Zomato)", time: "10:30 AM - 12:00 PM", status: "assigned", priority: "medium" },
  { id: 4, title: "Outlet visit / sales push", time: "12:00 PM - 2:00 PM", status: "assigned", priority: "medium" },
  { id: 5, title: "Midday sales run-rate review", time: "2:00 PM - 3:00 PM", status: "overdue", priority: "critical" },
  { id: 6, title: "Evening peak readiness", time: "5:00 PM - 7:00 PM", status: "assigned", priority: "high" },
  { id: 7, title: "End-of-day sales report", time: "9:30 PM - 10:30 PM", status: "assigned", priority: "critical" },
];

export default function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (!stored) {
      router.push("/");
      return;
    }
    setUserId(stored);
  }, [router]);

  if (!userId) return null;

  const user = STAFF[userId];

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/");
  };

  const completed = SAMPLE_TASKS.filter((t) => t.status === "completed").length;
  const inProgress = SAMPLE_TASKS.filter((t) => t.status === "in_progress").length;
  const overdue = SAMPLE_TASKS.filter((t) => t.status === "overdue").length;
  const total = SAMPLE_TASKS.length;

  return (
    <div className="min-h-screen bg-black text-white grid grid-cols-[240px_1fr]">
      <aside className="bg-zinc-950 border-r border-zinc-800 p-6 flex flex-col">
        <div className="border-b border-zinc-800 pb-4 mb-4">
          <div className="text-2xl font-black tracking-tight">
            TASK<span className="text-yellow-400">FORCE</span>
          </div>
          <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mt-1">
            Brownie Heaven
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest px-3 py-2">
            Workspace
          </div>
          <div className="bg-zinc-900 border-l-2 border-yellow-400 px-3 py-2.5 text-sm font-medium">
            Dashboard
          </div>
          <div className="px-3 py-2.5 text-sm text-zinc-500 hover:text-white cursor-pointer">
            Tasks
          </div>
          <div className="px-3 py-2.5 text-sm text-zinc-500 hover:text-white cursor-pointer">
            Staff
          </div>
          <div className="px-3 py-2.5 text-sm text-zinc-500 hover:text-white cursor-pointer">
            Analytics
          </div>
        </nav>

        <div className="border-t border-zinc-800 pt-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-yellow-400 text-black flex items-center justify-center font-bold text-xs">
            {user.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{user.name.split(" ")[0]}</div>
            <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider truncate">
              {user.role}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-[10px] font-mono text-zinc-600 hover:text-red-500 uppercase tracking-widest"
          >
            Exit
          </button>
        </div>
      </aside>

      <main className="p-10 overflow-y-auto">
        <div className="border-b border-zinc-800 pb-5 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black tracking-tight">
              {user.role === "Owner" ? "Command Center" : "My Tasks"}
            </h1>
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
              Welcome back, {user.name} // Live operational overview
            </p>
          </div>
          {user.role === "Owner" && (
            <button className="bg-yellow-400 text-black font-bold uppercase text-xs tracking-widest px-5 py-3 hover:opacity-90">
              + Assign Task
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-px bg-zinc-800 border border-zinc-800 mb-8">
          <Stat label="Total Tasks Today" value={total} sub="across all staff" />
          <Stat label="Completed" value={completed} sub={`${Math.round((completed / total) * 100)}% completion`} color="text-green-400" />
          <Stat label="In Progress" value={inProgress} sub="currently active" color="text-yellow-400" />
          <Stat label="Overdue" value={overdue} sub={overdue > 0 ? "requires escalation" : "all clear"} color="text-red-500" />
        </div>

        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
          Active Tasks
        </h2>
        <div className="bg-zinc-950 border border-zinc-800">
          {SAMPLE_TASKS.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, sub, color = "text-white" }: { label: string; value: number; sub: string; color?: string }) {
  return (
    <div className="bg-zinc-950 p-5">
      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-4xl font-black tracking-tight ${color}`}>{value}</div>
      <div className="text-[11px] font-mono text-zinc-600 mt-1.5">{sub}</div>
    </div>
  );
}

function TaskRow({ task }: { task: typeof SAMPLE_TASKS[0] }) {
  const statusStyles: Record<string, string> = {
    completed: "bg-green-400/10 text-green-400",
    in_progress: "bg-yellow-400/15 text-yellow-400",
    assigned: "bg-zinc-900 text-zinc-400",
    overdue: "bg-red-500/10 text-red-500",
  };
  const priorityDot: Record<string, string> = {
    low: "bg-zinc-600",
    medium: "bg-zinc-500",
    high: "bg-yellow-400",
    critical: "bg-red-500",
  };
  const isOverdue = task.status === "overdue";
  return (
    <div className={`grid grid-cols-[20px_1fr_180px_120px] items-center gap-4 px-5 py-4 border-b border-zinc-800 last:border-b-0 ${isOverdue ? "bg-red-500/5 border-l-2 border-l-red-500" : ""}`}>
      <div className={`w-2 h-2 rounded-full ${priorityDot[task.priority]}`} />
      <div className="font-medium text-sm">{task.title}</div>
      <div className="font-mono text-xs text-zinc-500">{task.time}</div>
      <div className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1 text-center ${statusStyles[task.status]}`}>
        {task.status.replace("_", " ")}
      </div>
    </div>
  );
}
