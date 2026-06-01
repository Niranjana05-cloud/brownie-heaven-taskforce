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
type Report = { id: string; staff_id: string; content: string; submitted_at: string; is_late: boolean };

const ALL_STAFF = [
  { id: "nishant", name: "Nishant Vijayakumar", role: "Owner" },
  { id: "arun", name: "Arun Kumar", role: "Manager", report_time: "22:30" },
  { id: "nilani", name: "Nilani Nallamuthu", role: "HR", report_time: "19:00" },
  { id: "gowtham", name: "Gowtham", role: "Purchase Manager", report_time: "19:00" },
  { id: "vishnu", name: "Vishnu", role: "Asst. Ops Manager", report_time: "20:30" },
  { id: "ahila", name: "Ahila", role: "Custom Cakes & Asst Ops", report_time: "20:30" },
  { id: "bharani", name: "Bharani", role: "Auditor", report_time: "22:00" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Staff | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "reports">("tasks");
  const [reportContent, setReportContent] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [todayReport, setTodayReport] = useState<Report | null>(null);
  const [overdueTask, setOverdueTask] = useState<Task | null>(null);
  const [forceAckReason, setForceAckReason] = useState("");

  // Task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("arun");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueHours, setTaskDueHours] = useState("4");
  const [taskOutlet, setTaskOutlet] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (!stored) { router.push("/"); return; }
    let parsed;
    try {
      parsed = JSON.parse(stored);
      if (typeof parsed === "string") { localStorage.removeItem("currentUser"); router.push("/"); return; }
    } catch { localStorage.removeItem("currentUser"); router.push("/"); return; }
    setUser(parsed);
    fetchTasks(parsed);
    fetchReports(parsed);
  }, [router]);

  const fetchTasks = async (u: Staff) => {
    setLoading(true);
    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (u.role !== "Owner" && u.role !== "Manager") query = query.eq("assigned_to", u.id);
    const { data } = await query;
    setTasks(data || []);
    setLoading(false);
    // Check for overdue tasks for non-admin staff
if (u.role !== "Owner" && u.role !== "Manager") {
  const overdue = (data || []).find((t: Task) => 
    t.status !== "completed" && new Date(t.due_at) < new Date()
  );
  if (overdue) setOverdueTask(overdue);
}
  };

  const fetchReports = async (u: Staff) => {
    let query = supabase.from("reports").select("*").order("submitted_at", { ascending: false });
    if (u.role !== "Owner") query = query.eq("staff_id", u.id);
    const { data } = await query;
    setReports(data || []);
    // Check if today's report already submitted
    const today = new Date().toDateString();
    const mine = (data || []).find((r: Report) => r.staff_id === u.id && new Date(r.submitted_at).toDateString() === today);
    setTodayReport(mine || null);
  };

  const submitReport = async () => {
    if (!reportContent.trim() || !user) return;
    setReportSubmitting(true);
    const staffInfo = ALL_STAFF.find(s => s.id === user.id);
    let isLate = false;
    if (staffInfo?.report_time) {
      const [h, m] = staffInfo.report_time.split(":").map(Number);
      const deadline = new Date();
      deadline.setHours(h, m, 0, 0);
      isLate = new Date() > deadline;
    }
    const { data, error } = await supabase.from("reports").insert({
      staff_id: user.id,
      content: reportContent.trim(),
      is_late: isLate,
      submitted_at: new Date().toISOString(),
    }).select().single();
    setReportSubmitting(false);
    if (error) { alert("Error: " + error.message); return; }
    setTodayReport(data);
    setReportContent("");
    fetchReports(user);
  };

  const assignTask = async () => {
    if (!taskTitle.trim() || !user) return;
    setSubmitting(true);
    const dueAt = new Date(Date.now() + parseFloat(taskDueHours) * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("tasks").insert({
      title: taskTitle.trim(), description: taskDesc.trim(),
      assigned_to: taskAssignee, assigned_by: user.id,
      priority: taskPriority, status: "assigned", due_at: dueAt,
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
  const submitForceAck = async (action: "complete" | "reason") => {
  if (!overdueTask) return;
  if (action === "reason") {
    if (forceAckReason.trim().length < 20) {
      alert("Please provide at least 20 characters explaining the delay.");
      return;
    }
    await supabase.from("tasks").update({ 
      delay_reason: forceAckReason.trim(),
      status: "overdue"
    }).eq("id", overdueTask.id);
  } else {
    await supabase.from("tasks").update({ 
      status: "completed",
      completed_at: new Date().toISOString()
    }).eq("id", overdueTask.id);
  }
  setOverdueTask(null);
  setForceAckReason("");
  if (user) fetchTasks(user);
};

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const overdue = tasks.filter(t => t.status === "overdue").length;
  const rate = total > 0 ? Math.round(completed / total * 100) : 0;
  const canAssign = user?.role === "Owner" || user?.role === "Manager";
  const hasReportDuty = user?.role !== "Owner";

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
          <div onClick={() => setActiveTab("tasks")} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "tasks" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
            <span>▣</span> Dashboard
          </div>
          {hasReportDuty && (
            <div onClick={() => setActiveTab("reports")} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "reports" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>📋</span> My Report
              {!todayReport && <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full"></span>}
            </div>
          )}
          {canAssign && (
            <>
              <div onClick={() => setActiveTab("reports")} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "reports" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
                <span>📋</span> Reports
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

        {/* TASKS TAB */}
        {activeTab === "tasks" && (
          <>
            <div className="flex justify-between items-end mb-8 pb-5 border-b border-zinc-800">
              <div>
                <h2 className="text-3xl font-black tracking-tight">{canAssign ? "Command Center" : "My Tasks"}</h2>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Welcome back, {user.name.split(" ")[0]} — system online</p>
              </div>
              {canAssign && (
                <button onClick={() => setShowModal(true)} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-5 py-3 hover:opacity-90 transition-opacity uppercase">+ Assign Task</button>
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
                            {t.status === "assigned" && <button onClick={() => updateStatus(t.id, "in_progress")} className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 border border-zinc-700 hover:border-yellow-400 hover:text-yellow-400 transition-colors">Start</button>}
                            <button onClick={() => updateStatus(t.id, "completed")} className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 border border-zinc-700 hover:border-green-400 hover:text-green-400 transition-colors">Done</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* REPORTS TAB */}
        {activeTab === "reports" && (
          <>
            <div className="mb-8 pb-5 border-b border-zinc-800">
              <h2 className="text-3xl font-black tracking-tight">{canAssign ? "All Reports" : "Daily Report"}</h2>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
                {canAssign ? "Staff submissions overview" : `Due by ${ALL_STAFF.find(s => s.id === user.id)?.report_time || "--:--"} daily`}
              </p>
            </div>

            {/* Staff report submission */}
            {hasReportDuty && !canAssign && (
              <div className="mb-8">
                {todayReport ? (
                  <div className="bg-green-400/5 border border-green-400/30 p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-green-400 font-mono text-xs uppercase tracking-widest">✓ Today's report submitted</span>
                      {todayReport.is_late && <span className="text-red-500 font-mono text-xs uppercase tracking-widest bg-red-500/10 px-2 py-0.5">Late</span>}
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">{todayReport.content}</p>
                    <p className="text-[11px] font-mono text-zinc-600 mt-3">{new Date(todayReport.submitted_at).toLocaleString("en-IN")}</p>
                  </div>
                ) : (
                  <div className="bg-[#131316] border border-zinc-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Submit Today's Report</p>
                      <span className="text-yellow-400 font-mono text-xs">Due: {ALL_STAFF.find(s => s.id === user.id)?.report_time}</span>
                    </div>
                    <textarea
                      value={reportContent}
                      onChange={(e) => setReportContent(e.target.value)}
                      placeholder="What did you accomplish today? Any issues or blockers?"
                      rows={5}
                      className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm resize-none mb-4"
                    />
                    <button onClick={submitReport} disabled={reportSubmitting || !reportContent.trim()} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-6 py-3 hover:opacity-90 transition-opacity uppercase disabled:opacity-50">
                      {reportSubmitting ? "Submitting..." : "Submit Report →"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Reports list - for owner/manager shows all, for staff shows their history */}
            <div className="bg-[#131316] border border-zinc-800">
              {reports.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">No reports yet</p>
                </div>
              ) : reports.map((r) => {
                const staffName = ALL_STAFF.find(s => s.id === r.staff_id)?.name || r.staff_id;
                return (
                  <div key={r.id} className="px-6 py-5 border-b border-zinc-800 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">{canAssign ? staffName : "My Report"}</span>
                        {r.is_late && <span className="text-red-500 font-mono text-[10px] uppercase tracking-widest bg-red-500/10 px-2 py-0.5">Late</span>}
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">{new Date(r.submitted_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">{r.content}</p>
                  </div>
                );
              })}
            </div>
          </>
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
  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Outlet (Optional)</label>
  <select value={taskOutlet} onChange={(e) => setTaskOutlet(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm">
    <option value="">No specific outlet</option>
    <option value="royapettah">Royapettah</option>
    <option value="adayar">Adayar</option>
    <option value="bsr_mall">BSR Mall</option>
    <option value="velachery">Velachery</option>
    <option value="ra_puram">RA Puram</option>
    <option value="anna_nagar">Anna Nagar</option>
    <option value="pallavaram">Pallavaram</option>
    <option value="vadapalani">Vadapalani</option>
    <option value="besant_nagar">Besant Nagar</option>
    <option value="perumbakkam">Perumbakkam</option>
    <option value="tambaram">Tambaram</option>
    <option value="porur">Porur</option>
  </select>
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
      {/* Force-Ack Overdue Modal */}
{overdueTask && user?.role !== "Owner" && user?.role !== "Manager" && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(20,0,0,0.97)" }}>
    <div className="w-[560px] bg-[#131316] border-2 border-red-500">
      <div className="bg-red-500 px-6 py-4 text-center font-mono text-xs font-bold uppercase tracking-widest text-white animate-pulse">
        ⚠ Action Required · Overdue Task ⚠
      </div>
      <div className="p-8">
        <h3 className="text-2xl font-black mb-2">You have an overdue task</h3>
        <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
          This task is past its deadline. You cannot dismiss this alert. You must either complete the task or provide a reason for the delay.
        </p>
        <div className="bg-black border border-zinc-800 p-4 mb-6">
          <p className="font-bold text-base mb-1">{overdueTask.title}</p>
          <p className="font-mono text-xs text-red-500 uppercase tracking-widest">
            Overdue by {Math.round((Date.now() - new Date(overdueTask.due_at).getTime()) / 60000)} minutes · Priority: {overdueTask.priority}
          </p>
        </div>
        <div className="mb-4">
          <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Reason for delay (min 20 characters)</label>
          <textarea
            value={forceAckReason}
            onChange={(e) => setForceAckReason(e.target.value)}
            placeholder="Explain why this task is overdue..."
            rows={3}
            className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-red-500 transition-colors text-sm resize-none"
          />
        </div>
        <div className="flex gap-3 justify-end pt-4 border-t border-zinc-800">
          <button onClick={() => submitForceAck("reason")} className="px-5 py-2.5 border border-zinc-700 text-sm font-medium hover:border-zinc-500 transition-colors">
            Submit Reason
          </button>
          <button onClick={() => submitForceAck("complete")} className="px-5 py-2.5 bg-yellow-400 text-black font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity">
            Mark Complete
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    </div>
  );
}
