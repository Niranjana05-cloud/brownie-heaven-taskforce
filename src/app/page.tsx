"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Staff = { id: string; name: string; role: string; report_time: string | null };
type Task = { id: string; title: string; description: string; status: string; priority: string; due_at: string; assigned_to: string; assigned_by: string };

const ALL_STAFF = [
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
  const [user, setUser] = useState<Staff | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("arun");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueHours, setTaskDueHours] = useState("4");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (!stored) { router.push("/"); return; }
    let parsed;
try { 
  parsed = JSON.parse(stored);
  if (typeof parsed === 'string') {
    localStorage.removeItem("currentUser");
    router.push("/");
    return;
  }
} catch { 
  localStorage.removeItem("currentUser");
  router.push("/"); 
  return; 
}
    
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

  const assignTask = async () => {
    if (!taskTitle.trim() || !user) return;
    setSubmitting(true);
    const dueAt = new Date(Date.now() + parseFloat(taskDueHours) * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("tasks").insert({
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      assigned_to: taskAssignee,
      assigned_by: user.id,
      priority: taskPriority,
      status: "assigned",
      due_at: dueAt,
    });
    setSubmitting(false);
    if (error) { alert("Error: " + error.message); return; }
    setShowModal(false);
    setTaskTitle(""); setTaskDesc(""); setTaskPriority("medium"); setTaskDueHours("4");
    fetchTasks(user);
  };

  const updateStatus = async (taskId: string, status: string) => {
    await supabase.from("tasks").update({ status, ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}) }).eq("id", taskId);
    if (user) fetchTasks(user);
  };

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const overdue = tasks.filter(t => t.status === "overdue").length;
  const rate = total > 0 ? Math.round(completed / total * 100) : 0;

  const canAssign = user?.role === "Owner" || user?.role === "Manager";

  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex">
      {/* Sidebar */}
      <aside className="w-60 bg-[#131316] border-r border-zinc-800 flex flex-col shrink-0">
        <div className="px-6 py-6 border-b border-zinc-800">
          <h1 className="text-xl font-black tracking-tight">TASK<span className="text-yellow-400">FORCE</span></h1>
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mt-1">Brownie Heaven</p>
        </div>
        <nav className="flex-1 px-3 py-4">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest px-3 pb-2">Workspace</p>
          <div className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white bg-zinc-900 border-l-2 border-yellow-400 cursor-pointer">
            <span>▣</span> Dashboard
          </div>
          {canAssign && (
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
          <button onClick={() => { localStorage.removeItem("currentUser"); router.push("/"); }} className="text-[11px] font-mono text-zinc-600 uppercase hover:text-red-500 transition-colors shrink-0">Exit</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-10 overflow-auto">
        <div className="flex justify-between items-end mb-8 pb-5 border-b border-zinc-800">
          <div>
            <h2 className="text-3xl font-black tracking-tight">{canAssign ? "Command Center" : "My Tasks"}</h2>
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Welcome back, {user.name.split(" ")[0]} — system online</p>
          </div>
          {canAssign && (
            <button onClick={() => setShowModal(true)} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-5 py-3 hover:opacity-90 transition-opacity uppercase">
              + Assign Task
            </button>
          )}
        </div>

        {/* Stats */}
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

        {/* Task List */}
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
            {tasks.map((t) => {
              const assigneeName = ALL_STAFF.find(s => s.id === t.assigned_to)?.name || t.assigned_to;
              const isOverdue = t.status !== "completed" && new Date(t.due_at) < new Date();
              return (
                <div key={t.id} className={`grid grid-cols-[8px_1fr_140px_110px_110px] gap-4 items-center px-5 py-4 border-b border-zinc-800 last:border-0 hover:bg-zinc-900 transition-colors ${isOverdue ? "border-l-2 border-l-red-500" : ""}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${t.priority === "critical" ? "bg-red-500" : t.priority === "high" ? "bg-orange-400" : t.priority === "medium" ? "bg-yellow-400" : "bg-zinc-600"}`} />
                  <div>
                    <p className="font-semibold text-sm">{t.title}</p>
                    <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{assigneeName} · {t.due_at ? new Date(t.due_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "No deadline"}</p>
                  </div>
                  <p className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 text-center ${t.status === "completed" ? "bg-green-400/10 text-green-400" : isOverdue ? "bg-red-500/10 text-red-500" : t.status === "in_progress" ? "bg-yellow-400/10 text-yellow-400" : "bg-zinc-800 text-zinc-500"}`}>
                    {isOverdue && t.status !== "completed" ? "overdue" : t.status.replace("_", " ")}
                  </p>
                  <p className={`font-mono text-[10px] uppercase tracking-widest text-center ${t.priority === "critical" ? "text-red-500" : t.priority === "high" ? "text-orange-400" : t.priority === "medium" ? "text-yellow-400" : "text-zinc-600"}`}>{t.priority}</p>
                  <div className="flex gap-2 justify-end">
                    {t.status !== "completed" && (
                      <>
                        {t.status === "assigned" && (
                          <button onClick={() => updateStatus(t.id, "in_progress")} className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 border border-zinc-700 hover:border-yellow-400 hover:text-yellow-400 transition-colors">Start</button>
                        )}
                        <button onClick={() => updateStatus(t.id, "completed")} className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 border border-zinc-700 hover:border-green-400 hover:text-green-400 transition-colors">Done</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Assign Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="w-[500px] bg-[#131316] border border-zinc-800 p-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
              <h3 className="text-xl font-black tracking-tight">Assign New Task</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Task Title *</label>
                <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Check outlet stock" className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Description</label>
                <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Optional details..." rows={3} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Assign To</label>
                  <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm">
                    {ALL_STAFF.filter(s => s.id !== "nishant").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Priority</label>
                  <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Due In</label>
                <select value={taskDueHours} onChange={(e) => setTaskDueHours(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm">
                  <option value="1">1 hour</option>
                  <option value="2">2 hours</option>
                  <option value="4">4 hours</option>
                  <option value="8">8 hours</option>
                  <option value="24">1 day</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-5 border-t border-zinc-800">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-zinc-700 text-sm font-medium hover:border-zinc-500 transition-colors">Cancel</button>
              <button onClick={assignTask} disabled={submitting || !taskTitle.trim()} className="px-5 py-2.5 bg-yellow-400 text-black font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50">
                {submitting ? "Assigning..." : "Assign Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
