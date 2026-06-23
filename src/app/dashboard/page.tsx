"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { celebrate } from "../celebrate";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Staff = { id: string; name: string; role: string; report_time: string | null; outlets?: string[] };
type Task = { id: string; title: string; description: string; status: string; priority: string; due_at: string; assigned_to: string; assigned_by: string; outlet_id: string | null };
type Report = { id: string; staff_id: string; content: string; submitted_at: string; is_late: boolean; report_data: Record<string, string>; staff_role: string };
type OutletReport = {
  id: string; staff_id: string; outlet_id: string; report_date: string;
  shop_sales_count: number; shop_sales_value: number;
  swiggy_sales_count: number; swiggy_sales_value: number;
  zomato_sales_count: number; zomato_sales_value: number;
  target: number; swiggy_live: boolean; zomato_live: boolean;
  discount_running: string; discount_rate_good: boolean;
  unavailable_items: string; expiry_count: number; expiry_items: string;
  complimentary_count: number; complimentary_reason: string;
issues: string; action_taken: string; submitted_at: string; is_late: boolean; is_edited: boolean;
bh_google_rating: number; bh_swiggy_rating: number; bh_zomato_rating: number;
cbh_google_rating: number; cbh_swiggy_rating: number; cbh_zomato_rating: number;
icbh_google_rating: number; icbh_swiggy_rating: number; icbh_zomato_rating: number;
};

const ALL_STAFF = [
  { id: "nishant", name: "Nishant Vijayakumar", role: "Owner", report_time: null, outlets: [] },
  { id: "arun", name: "Arun Kumar", role: "Manager", report_time: "22:00", outlets: [] },
  { id: "nilani", name: "Nilani Nallamuthu", role: "HR", report_time: "22:00", outlets: ["ra_puram","anna_nagar","pallavaram","vadapalani"] },
  { id: "gowtham", name: "Gowtham", role: "Purchase Manager", report_time: "22:00", outlets: [] },
  { id: "vishnu", name: "Vishnu", role: "Asst. Ops Manager", report_time: "22:00", outlets: ["velachery","perumbakkam","tambaram","porur"] },
  { id: "ahila", name: "Ahila", role: "Custom Cakes & Asst Ops", report_time: "22:00", outlets: ["royapettah","adayar","bsr_mall","besant_nagar"] },
];

const OUTLETS = ["royapettah","adayar","bsr_mall","velachery","ra_puram","anna_nagar","pallavaram","vadapalani","besant_nagar","perumbakkam","tambaram","porur"];
const OUTLET_NAMES: Record<string, string> = {
  royapettah: "Royapettah",
  adayar: "Adyar",
  bsr_mall: "BSR Mall",
  velachery: "Velachery",
  ra_puram: "RA Puram",
  anna_nagar: "Anna Nagar",
  pallavaram: "Pallavaram",
  vadapalani: "Vadapalani",
  besant_nagar: "Besant Nagar",
  perumbakkam: "Perumbakkam",
  tambaram: "Tambaram",
  porur: "Porur",
};
const OUTLET_TARGETS: Record<string, string> = {
  royapettah: "80000",
  adayar: "18333",
  bsr_mall: "35000",
  ra_puram: "21666",
  anna_nagar: "50000",
  porur: "50000",
  perumbakkam: "13000",
  tambaram: "20000",
  velachery: "",
  pallavaram: "",
  vadapalani: "23333",
  besant_nagar: "11667",
};

const REPORT_FIELDS: Record<string, { label: string; key: string; type?: string }[]> = {
  arun: [
    { label: "Total Sales (Rs)", key: "total_sales" },
    { label: "Target (Rs)", key: "target" },
    { label: "Achievement %", key: "achievement" },
    { label: "Best Outlet", key: "best_outlet" },
    { label: "Worst Outlet", key: "worst_outlet" },
    { label: "Swiggy Sales (Rs)", key: "swiggy_sales" },
    { label: "Zomato Sales (Rs)", key: "zomato_sales" },
    { label: "Shop Sales (Rs)", key: "shop_sales" },
    { label: "Cake Sales", key: "cake_sales" },
    { label: "Ice Cream Sales", key: "ice_cream_sales" },
    { label: "Complaints Today", key: "complaints" },
    { label: "Negative Reviews", key: "negative_reviews" },
    { label: "Stock-out Issues", key: "stock_out" },
    { label: "Staff Issues", key: "staff_issues" },
    { label: "Top Issue 1", key: "issue_1" },
    { label: "Top Issue 2", key: "issue_2" },
    { label: "Top Issue 3", key: "issue_3" },
    { label: "Tomorrow Action 1", key: "action_1" },
    { label: "Tomorrow Action 2", key: "action_2" },
    { label: "Tomorrow Action 3", key: "action_3" },
  ],
 nilani: [
    { label: "Replacement Required (Yes/No)", key: "replacement_required" },
    { label: "Training Conducted (Yes/No)", key: "training_conducted" },
    { label: "Training Topic", key: "training_topic" },
    { label: "Outlets Checked/Visited", key: "outlets_checked" },
    { label: "Staff Issues", key: "staff_issues" },
    { label: "Warnings Issued", key: "warnings_issued" },
    { label: "New Candidates Contacted", key: "candidates_contacted" },
    { label: "Interviews Scheduled", key: "interviews_scheduled" },
    { label: "Top Issue 1", key: "issue_1" },
    { label: "Top Issue 2", key: "issue_2" },
    { label: "Top Issue 3", key: "issue_3" },
    { label: "Action Needed 1", key: "action_1" },
    { label: "Action Needed 2", key: "action_2" },
    { label: "Action Needed 3", key: "action_3" },
  ],
  gowtham: [
    { label: "Total Purchase Value (Rs)", key: "purchase_value" },
    { label: "Emergency Purchase Value (Rs)", key: "emergency_purchase" },
    { label: "Purchase as per Plan (Yes/No)", key: "purchase_as_planned" },
    { label: "Supplier Issues", key: "supplier_issues" },
    { label: "Material Rejected", key: "material_rejected" },
    { label: "Stock Shortage", key: "stock_shortage" },
    { label: "Dispatch Delay", key: "dispatch_delay" },
    { label: "High-value Stock Variance (Rs)", key: "stock_variance" },
    { label: "Tomorrow Purchase Requirement (Rs)", key: "tomorrow_purchase" },
    { label: "Top Issue 1", key: "issue_1" },
    { label: "Top Issue 2", key: "issue_2" },
    { label: "Top Issue 3", key: "issue_3" },
    { label: "Action Needed 1", key: "action_1" },
    { label: "Action Needed 2", key: "action_2" },
    { label: "Action Needed 3", key: "action_3" },
  ],
  vishnu: [
    { label: "Total Enquiries Received", key: "total_enquiries" },
    { label: "Orders Confirmed", key: "orders_confirmed" },
    { label: "Conversion %", key: "conversion_pct" },
    { label: "WhatsApp Sales Value (Rs)", key: "whatsapp_sales" },
    { label: "Pending Payments (Rs)", key: "pending_payments" },
    { label: "Custom Cake Orders", key: "custom_cake_orders" },
    { label: "Bulk Enquiries", key: "bulk_enquiries" },
    { label: "Complaints Handled", key: "complaints_handled" },
    { label: "Reviews Requested", key: "reviews_requested" },
    { label: "Reviews Received", key: "reviews_received" },
    { label: "Top Revenue Opportunity 1", key: "opportunity_1" },
    { label: "Top Revenue Opportunity 2", key: "opportunity_2" },
    { label: "Top Revenue Opportunity 3", key: "opportunity_3" },
    { label: "Pending Follow-up 1", key: "followup_1" },
    { label: "Pending Follow-up 2", key: "followup_2" },
    { label: "Pending Follow-up 3", key: "followup_3" },
  ],
  
   ahila: [
    { label: "Total No Of Customizations", key: "total_cakes" },
    { label: "Revenue", key: "revenue" },
    { label: "Confirmed & Placed Today", key: "confirmed_placed" },
    { label: "Pending & Following Leads", key: "pending_following" },
    { label: "Customisations Done Today", key: "cake_orders_today" },
    { label: "Orders Delivered on Time", key: "orders_on_time" },
    { label: "Cake Complaints", key: "cake_complaints" },
    { label: "Cake Wastage/Damage", key: "cake_wastage" },
    { label: "Royapettah Sales/Ops Issue", key: "royapettah_issue" },
    { label: "Swiggy/Zomato Issues", key: "swiggy_zomato_issues" },
    { label: "Negative Reviews", key: "negative_reviews" },
    { label: "Product Unavailable Issues", key: "unavailable_issues" },
    { label: "Tomorrow's Cake Orders", key: "tomorrow_cake_orders" },
    { label: "Top Issue 1", key: "issue_1" },
    { label: "Top Issue 2", key: "issue_2" },
    { label: "Top Issue 3", key: "issue_3" },
    { label: "Action Needed 1", key: "action_1" },
    { label: "Action Needed 2", key: "action_2" },
    { label: "Action Needed 3", key: "action_3" },
  ],
  bharani: [
    { label: "Outlets Audited", key: "outlets_audited" },
    { label: "Total Wastage (Rs)", key: "total_wastage" },
    { label: "Stock Mismatch Found (Yes/No)", key: "stock_mismatch" },
    { label: "Cash Reconciliation Status", key: "cash_reconciliation" },
    { label: "Exceptions Found", key: "exceptions_found" },
    { label: "High-value Discrepancy (Rs)", key: "discrepancy_value" },
    { label: "Outlets with Issues", key: "outlets_with_issues" },
    { label: "Top Issue 1", key: "issue_1" },
    { label: "Top Issue 2", key: "issue_2" },
    { label: "Top Issue 3", key: "issue_3" },
    { label: "Action Needed 1", key: "action_1" },
    { label: "Action Needed 2", key: "action_2" },
    { label: "Action Needed 3", key: "action_3" },
  ],
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Staff | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
 const [activeTab, setActiveTab] = useState<"tasks" | "my_report" | "all_reports" | "analytics" | "outlet_reports" | "owner_outlets" | "history" | "attendance" | "sales_target" | "payout">("tasks");
  const [outletFilter, setOutletFilter] = useState("all");
  const [reportData, setReportData] = useState<Record<string, string>>({});
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportOffDay, setReportOffDay] = useState(false);
  const [attendanceData, setAttendanceData] = useState({ present: "", absent: "", late: "", absent_names: "", late_names: "" });
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [attendanceDate, setAttendanceDate] = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; });
  const [salesTargets, setSalesTargets] = useState<Record<string, any>>({});
  const [stEditing, setStEditing] = useState<string | null>(null);
  const [stEditValues, setStEditValues] = useState<Record<string, string>>({});
  const [stSaving, setStSaving] = useState(false);
  const [todayReport, setTodayReport] = useState<Report | null>(null);
  const [overdueTask, setOverdueTask] = useState<Task | null>(null);
  const [forceAckReason, setForceAckReason] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("arun");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueHours, setTaskDueHours] = useState("4");
  const [taskOutlet, setTaskOutlet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportHistoryDate, setReportHistoryDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [reportByDate, setReportByDate] = useState<Report | null>(null);
  const [activeOutlet, setActiveOutlet] = useState<string>("");
  const [outletReports, setOutletReports] = useState<Record<string, OutletReport>>({});
  const [outletReportData, setOutletReportData] = useState<Record<string, string>>({});
  const [outletSubmitting, setOutletSubmitting] = useState(false);
  const [outletEntryDate, setOutletEntryDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [outletWasOff, setOutletWasOff] = useState(false);
  const [targetCheck, setTargetCheck] = useState<any[] | null>(null);
  const [targetReaction, setTargetReaction] = useState(false);
  const [outletHistoryDate, setOutletHistoryDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [lastOutletRatings, setLastOutletRatings] = useState<Record<string, OutletReport>>({});
  const [allOutletReports, setAllOutletReports] = useState<OutletReport[]>([]);
  const [historyDate, setHistoryDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [historyReports, setHistoryReports] = useState<Report[]>([]);
  const [historyOutletReports, setHistoryOutletReports] = useState<OutletReport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
   fetchAttendance(parsed, new Date(Date.now() - 86400000).toISOString().split("T")[0]);
   fetchSalesTargets(parsed);
   fetchOutletReports(parsed);
    fetchLastOutletRatings(parsed);
   if (parsed.role === "Owner" || parsed.role === "Manager") fetchAllOutletReports();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => { fetchTasks(user); fetchReports(user); }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchTasks = async (u: Staff) => {
    setLoading(true);
    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
   if (u.role !== "Owner" && u.role !== "Manager") {
  const staffOutlets = (u as Staff & { outlets?: string[] }).outlets || [];
  if (staffOutlets.length > 0) {
    query = query.or(`assigned_to.eq.${u.id},outlet_id.in.(${staffOutlets.join(",")})`);
  } else {
    query = query.eq("assigned_to", u.id);
  }
}
    const { data } = await query;
    setTasks(data || []);
    setLoading(false);
    if (u.role !== "Owner") {
      const overdue = (data || []).find((t: Task) => t.status !== "completed" && new Date(t.due_at) < new Date());
     if (overdue) { setOverdueTask(overdue); playAlert(); }
    }
  };
  const exportCSV = () => {
  if (historyOutletReports.length === 0) { alert("No outlet reports for this date."); return; }
  const headers = ["Outlet", "Manager", "Date", "Shop Sales Value", "Shop Sales Count", "Swiggy Value", "Swiggy Count", "Zomato Value", "Zomato Count", "Total Sales", "Target", "Swiggy Live", "Zomato Live", "Discount Running", "Discount Rate Good", "Unavailable Items", "Expiry Count", "Expiry Items", "Complimentary Count", "Complimentary Reason", "Issues", "Action Taken", "Submitted At", "Late"];
  const rows = historyOutletReports.map(r => {
    const manager = ALL_STAFF.find(s => (s.outlets as string[]).includes(r.outlet_id))?.name || "—";
    const total = Number(r.shop_sales_value) + Number(r.swiggy_sales_value) + Number(r.zomato_sales_value);
    return [
      OUTLET_NAMES[r.outlet_id] || r.outlet_id.replace(/_/g, " "),
      manager,
      r.report_date,
      r.shop_sales_value,
      r.shop_sales_count,
      r.swiggy_sales_value,
      r.swiggy_sales_count,
      r.zomato_sales_value,
      r.zomato_sales_count,
      total,
      r.target,
      r.swiggy_live ? "Yes" : "No",
      r.zomato_live ? "Yes" : "No",
      r.discount_running || "",
      r.discount_rate_good ? "Yes" : "No",
      r.unavailable_items || "",
      r.expiry_count,
      r.expiry_items || "",
      r.complimentary_count,
      r.complimentary_reason || "",
      r.issues || "",
      r.action_taken || "",
      new Date(r.submitted_at).toLocaleString("en-IN"),
      r.is_late ? "Yes" : "No",
    ];
  });
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `brownie-heaven-outlet-reports-${historyDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
  const fetchHistoryReports = async (date: string) => {
  setHistoryLoading(true);
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const [{ data: reps }, { data: outletReps }] = await Promise.all([
    supabase.from("reports").select("*").gte("submitted_at", start).lte("submitted_at", end).order("submitted_at", { ascending: false }),
    supabase.from("outlet_reports").select("*").eq("report_date", date).order("submitted_at", { ascending: false }),
  ]);
  setHistoryReports(reps || []);
  setHistoryOutletReports(outletReps || []);
  setHistoryLoading(false);
};
  const fetchAllOutletReportsByDate = async (date: string) => {
  const { data } = await supabase
    .from("outlet_reports")
    .select("*")
    .eq("report_date", date)
    .order("submitted_at", { ascending: false });
  setAllOutletReports(data || []);
};
 const fetchAllOutletReports = async (date?: string) => {
  const today = date || new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("outlet_reports")
    .select("*")
    .eq("report_date", today)
    .order("submitted_at", { ascending: false });
  setAllOutletReports(data || []);
};
  const fetchOutletReportsByDate = async (date: string) => {
  if (!user) return;
  const { data } = await supabase
    .from("outlet_reports")
    .select("*")
    .eq("staff_id", user.id)
    .eq("report_date", date);
  const map: Record<string, OutletReport> = {};
  (data || []).forEach((r: OutletReport) => { map[r.outlet_id] = r; });
  setOutletReports(map);
};
  const fetchLastOutletRatings = async (u: Staff) => {
  const { data } = await supabase
    .from("outlet_reports")
    .select("outlet_id, bh_google_rating, bh_swiggy_rating, bh_zomato_rating, cbh_google_rating, cbh_swiggy_rating, cbh_zomato_rating, icbh_google_rating, icbh_swiggy_rating, icbh_zomato_rating")
    .eq("staff_id", u.id)
    .not("bh_google_rating", "is", null)
    .order("submitted_at", { ascending: false });
  const map: Record<string, OutletReport> = {};
 (data || []).forEach((r: any) => {
    if (!map[r.outlet_id]) map[r.outlet_id] = r;
  });
 
  setLastOutletRatings(map);
};
const fetchOutletReports = async (u: Staff) => {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("outlet_reports")
    .select("*")
    .eq("staff_id", u.id)
    .eq("report_date", today);
  const map: Record<string, OutletReport> = {};
  (data || []).forEach((r: OutletReport) => { map[r.outlet_id] = r; });
  setOutletReports(map);
  return map;
};
  const fetchReportByDate = async (date: string) => {
  if (!user) return;
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("staff_id", user.id)
    .gte("submitted_at", start)
    .lte("submitted_at", end)
    .single();
  setReportByDate(data || null);
};
  const fetchReports = async (u: Staff) => {
    let query = supabase.from("reports").select("*").order("submitted_at", { ascending: false });
    if (u.role !== "Owner") query = query.eq("staff_id", u.id);
    const { data } = await query;
    setReports(data || []);
    const today = new Date().toDateString();
    const mine = (data || []).find((r: Report) => r.staff_id === u.id && new Date(r.submitted_at).toDateString() === today);
    setTodayReport(mine || null);
  };

 const submitReport = async () => {
    if (!user) return;
    const _fields = REPORT_FIELDS[user.id] || [];
    const _missing = _fields.filter((f) => {
      if (user.id === "arun" && (f.key === "achievement" || f.key === "target")) return false;
      return !reportData[f.key] || !String(reportData[f.key]).trim();
    });
    if (_missing.length) { alert("Please fill all fields before submitting.\n\nMissing: " + _missing.map((f) => f.label).join(", ")); return; }
    setReportSubmitting(true);
    const _today = new Date().toISOString().split("T")[0];
    const _date = reportHistoryDate || _today;
    const _isBackfill = _date < _today;
    const deadline = new Date();
    deadline.setHours(22, 0, 0, 0);
    const isLate = !_isBackfill && new Date() > deadline;
    const { data: _existing } = await supabase.from("reports").select("id").eq("staff_id", user.id).eq("report_date", _date);
    const _isEdit = (_existing?.length || 0) > 0;
    const finalData: Record<string, string> = { ...reportData };
    if (user.id === "arun") {
      if (!finalData.target || !String(finalData.target).trim()) finalData.target = "299666";
      const _ts = parseFloat(finalData.total_sales || "0");
      const _tg = parseFloat(finalData.target || "299666");
      finalData.achievement = _tg ? (_ts / _tg * 100).toFixed(1) + "%" : "";
    }
    const content = Object.entries(finalData).map(([k, v]) => `${k}: ${v}`).join(", ");
    const { data, error } = await supabase.from("reports").insert({
      staff_id: user.id,
      content,
      report_date: _date,
      is_backfill: _isBackfill,
      is_late: reportOffDay ? false : isLate,
      submitted_at: new Date().toISOString(),
      report_data: finalData,
      staff_role: user.role,
      no_points: reportOffDay,
    }).select().single();
    setReportSubmitting(false);
    if (error) { alert("Error: " + error.message); return; }
    if (_date === _today) setTodayReport(data);
    if (!reportOffDay) {
      if (_isEdit) celebrate(0, "Report updated — no extra points");
      else if (_isBackfill) celebrate(-5, "Back-dated report — -5");
      else if (isLate) celebrate(-5, "After 10 PM — -5");
      else celebrate(10);
    }
    setReportData({});
    fetchReports(user);
    if (_date !== _today) fetchReportByDate(_date);
  };

const runTargetCheck = async (u: Staff) => {
    const outlets = (u as Staff & { outlets?: string[] }).outlets || [];
    if (!outlets.length) return;
    const yest = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const { data } = await supabase.from("outlet_reports").select("outlet_id,shop_sales_value,swiggy_sales_value,zomato_sales_value").in("outlet_id", outlets).eq("report_date", yest);
    const byOutlet: Record<string, number> = {};
    (data || []).forEach((r: any) => { byOutlet[r.outlet_id] = (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0); });
    const results = outlets.map((oid) => {
      const target = parseFloat(OUTLET_TARGETS[oid] || "");
      const actual = byOutlet[oid];
      const name = OUTLET_NAMES[oid] || oid;
      if (!target || isNaN(target)) return { oid, name, status: "notarget" };
      if (actual === undefined) return { oid, name, status: "noentry", target };
      return { oid, name, status: actual >= target ? "win" : "miss", target, actual };
    });
    setTargetCheck(results);
  };

  const fetchSalesTargets = async (u: Staff) => {
    const isViewer = u.role === "Owner" || u.role === "Manager";
    const outlets = (u as Staff & { outlets?: string[] }).outlets || [];
    if (!isViewer && !outlets.length) return;
    let query = supabase.from("sales_target").select("*");
    if (!isViewer) query = query.in("outlet_id", outlets);
    const { data } = await query;
    const map: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      if (!map[row.outlet_id]) map[row.outlet_id] = {};
      map[row.outlet_id][row.brand] = row.line_items;
    });
    setSalesTargets(map);
  };

  const saveSalesTarget = async (outletId: string, brand: string, items: any[]) => {
    setStSaving(true);
    const curMonth = new Date().toISOString().slice(0, 7);
    const updated = items.map((it: any) => {
      const v = stEditValues[it.name];
      if (v !== undefined && v !== "") return { ...it, months: { ...it.months, [curMonth]: parseFloat(v.replace(/,/g, "")) || 0 } };
      return it;
    });
    const { error } = await supabase.from("sales_target").upsert({ outlet_id: outletId, brand, line_items: updated, updated_at: new Date().toISOString() }, { onConflict: "outlet_id,brand" });
    setStSaving(false);
    if (error) { alert("Error: " + error.message); return; }
    setStEditing(null); setStEditValues({});
    if (user) fetchSalesTargets(user);
  };

  const fetchAttendance = async (u: Staff, date: string) => {
    const { data } = await supabase.from("attendance").select("*").eq("staff_id", u.id).eq("attendance_date", date).maybeSingle();
    setTodayAttendance(data || null);
    if (!data) setAttendanceData({ present: "", absent: "", late: "", absent_names: "", late_names: "" });
  };

  const submitAttendance = async () => {
    if (!user) return;
    setAttendanceSubmitting(true);
    const { data, error } = await supabase.from("attendance").upsert({
      staff_id: user.id,
      attendance_date: attendanceDate,
     present: parseInt(attendanceData.present) || 0,
      absent: parseInt(attendanceData.absent) || 0,
      late: parseInt(attendanceData.late) || 0,
      absent_names: attendanceData.absent_names.trim() || null,
      late_names: attendanceData.late_names.trim() || null,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "staff_id,attendance_date" }).select().single();
    setAttendanceSubmitting(false);
    if (error) { alert("Error: " + error.message); return; }
    setTodayAttendance(data);
    setAttendanceData({ present: "", absent: "", late: "", absent_names: "", late_names: "" });
  };

  const assignTask = async () => {
    if (!taskTitle.trim() || !user) return;
    setSubmitting(true);
    const dueAt = new Date(Date.now() + parseFloat(taskDueHours) * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("tasks").insert({
      title: taskTitle.trim(), description: taskDesc.trim(),
      assigned_to: taskAssignee, assigned_by: user.id,
      priority: taskPriority, status: "assigned", due_at: dueAt,
      outlet_id: taskOutlet || null,
    });
    setSubmitting(false);
    if (error) { alert("Error: " + error.message); return; }
    setShowModal(false);
    setTaskTitle(""); setTaskDesc(""); setTaskPriority("medium"); setTaskDueHours("4"); setTaskOutlet("");
    fetchTasks(user);
  };

  const updateStatus = async (taskId: string, status: string) => {
    await supabase.from("tasks").update({ status, ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}) }).eq("id", taskId);
    if (user) fetchTasks(user);
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("tasks").delete().eq("id", taskId);
    if (user) fetchTasks(user);
  };

 const updatePin = async () => {
  if (!newPin || newPin.length < 4) { setPinMsg("PIN must be at least 4 digits."); return; }
  if (!user) return;
  const { error } = await supabase
    .from("staff")
    .update({ pin: newPin })
    .eq("id", user.id)
    .select()
    .limit(1);
  if (error) { setPinMsg("Error: " + error.message); return; }
  setPinMsg("PIN updated successfully!");
  setNewPin("");
  setTimeout(() => { setShowPinModal(false); setPinMsg(""); }, 1500);
};
 const editOutletReport = async (outletId: string) => {
  const r = outletReports[outletId];
  if (!r) return;
  setOutletReportData({
    target: String(r.target),
    shop_sales_count: String(r.shop_sales_count),
    shop_sales_value: String(r.shop_sales_value),
    swiggy_sales_count: String(r.swiggy_sales_count),
    swiggy_sales_value: String(r.swiggy_sales_value),
    zomato_sales_count: String(r.zomato_sales_count),
    zomato_sales_value: String(r.zomato_sales_value),
    swiggy_live: r.swiggy_live ? "yes" : "no",
    zomato_live: r.zomato_live ? "yes" : "no",
    discount_running: r.discount_running || "",
    discount_rate_good: r.discount_rate_good ? "yes" : "no",
    unavailable_items: r.unavailable_items || "",
    expiry_count: String(r.expiry_count),
    expiry_items: r.expiry_items || "",
    complimentary_count: String(r.complimentary_count),
    complimentary_reason: r.complimentary_reason || "",
   bh_google_rating: String(r.bh_google_rating || ""),
  bh_swiggy_rating: String(r.bh_swiggy_rating || ""),
  bh_zomato_rating: String(r.bh_zomato_rating || ""),
  cbh_google_rating: String(r.cbh_google_rating || ""),
  cbh_swiggy_rating: String(r.cbh_swiggy_rating || ""),
  cbh_zomato_rating: String(r.cbh_zomato_rating || ""),
 icbh_google_rating: String(r.icbh_google_rating || ""),
 icbh_swiggy_rating: String(r.icbh_swiggy_rating || ""),
 icbh_zomato_rating: String(r.icbh_zomato_rating || ""),
    issues: r.issues || "",
    action_taken: r.action_taken || "",
    is_edited: "true",
    editing_id: r.id,
  });
  setOutletReports(prev => {
    const updated = { ...prev };
    delete updated[outletId];
    return updated;
  });
};
const submitOutletReport = async () => {
  if (!user || !activeOutlet) return;
  const _req = [
    { k: "shop_sales_count", label: "Shop Sales Count" },
    { k: "shop_sales_value", label: "Shop Sales Value" },
    { k: "swiggy_sales_count", label: "Swiggy Sales Count" },
    { k: "swiggy_sales_value", label: "Swiggy Sales Value" },
    { k: "zomato_sales_count", label: "Zomato Sales Count" },
    { k: "zomato_sales_value", label: "Zomato Sales Value" },
  ];
  const _miss = _req.filter((f) => !(outletReportData as any)[f.k] || !String((outletReportData as any)[f.k]).trim());
  if (_miss.length) { alert("Please fill all sales fields before submitting.\n\nMissing: " + _miss.map((f) => f.label).join(", ")); return; }
  setOutletSubmitting(true);
  const deadline = new Date();
  deadline.setHours(12, 0, 0, 0);
  const isLate = new Date() > deadline;
  const d = outletReportData;
  const newRating = parseFloat(d.bh_google_rating) || 0;
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: prevRows } = await supabase.from("outlet_reports")
    .select("bh_google_rating").eq("outlet_id", activeOutlet).lt("report_date", todayStr)
    .order("report_date", { ascending: false }).limit(1);
  const prevRating = prevRows && prevRows[0] ? Number(prevRows[0].bh_google_rating) || 0 : 0;
  const earnedBonus = newRating > 4.5 && newRating > prevRating;
  const isBackfill = outletEntryDate < new Date().toISOString().split("T")[0];
  const payload = {
    shop_sales_count: parseInt(d.shop_sales_count?.replace(/,/g, "")) || 0,
    shop_sales_value: parseFloat(d.shop_sales_value?.replace(/,/g, "")) || 0,
    swiggy_sales_count: parseInt(d.swiggy_sales_count?.replace(/,/g, "")) || 0,
    swiggy_sales_value: parseFloat(d.swiggy_sales_value?.replace(/,/g, "")) || 0,
    zomato_sales_count: parseInt(d.zomato_sales_count?.replace(/,/g, "")) || 0,
    zomato_sales_value: parseFloat(d.zomato_sales_value?.replace(/,/g, "")) || 0,
    target: parseFloat(d.target?.replace(/,/g, "")) || 0,
    swiggy_live: (d.swiggy_live || "yes").toLowerCase() === "yes",
    zomato_live: (d.zomato_live || "yes").toLowerCase() === "yes",
    discount_running: d.discount_running || "",
    discount_rate_good: (d.discount_rate_good || "yes").toLowerCase() === "yes",
    unavailable_items: d.unavailable_items || "",
    expiry_count: parseInt(d.expiry_count) || 0,
    expiry_items: d.expiry_items || "",
    complimentary_count: parseInt(d.complimentary_count) || 0,
    complimentary_reason: d.complimentary_reason || "",
    issues: d.issues || "",
    action_taken: d.action_taken || "",
    bh_google_rating: parseFloat(d.bh_google_rating) || null,
bh_swiggy_rating: parseFloat(d.bh_swiggy_rating) || null,
bh_zomato_rating: parseFloat(d.bh_zomato_rating) || null,
cbh_google_rating: parseFloat(d.cbh_google_rating) || null,
cbh_swiggy_rating: parseFloat(d.cbh_swiggy_rating) || null,
cbh_zomato_rating: parseFloat(d.cbh_zomato_rating) || null,
icbh_google_rating: parseFloat(d.icbh_google_rating) || null,
icbh_swiggy_rating: parseFloat(d.icbh_swiggy_rating) || null,
icbh_zomato_rating: parseFloat(d.icbh_zomato_rating) || null,
    is_late: isLate,
   is_edited: d.is_edited === "true",
    rating_bonus: isBackfill ? false : earnedBonus,
    is_backfill: isBackfill,
    no_points: isBackfill && outletWasOff,
  };
  let error;
  if (d.editing_id) {
    const result = await supabase.from("outlet_reports").update(payload).eq("id", d.editing_id);
    error = result.error;
  } else {
   const _owner = ALL_STAFF.find(s => (s.outlets as string[] | undefined)?.includes(activeOutlet));
    const result = await supabase.from("outlet_reports").upsert({
  ...payload,
  staff_id: _owner ? _owner.id : user.id,
  outlet_id: activeOutlet,
  report_date: outletEntryDate,
}, { onConflict: "staff_id,outlet_id,report_date" });
error = result.error;
  }
  setOutletSubmitting(false);
 if (error) { alert("Error: " + error.message); return; }
setOutletReportData({});
if (isBackfill) { if (!outletWasOff) celebrate(-30); }
else if (isLate) { celebrate(0, "After 12 PM cut-off — 0 points"); }
else {
  const _total = (Number(payload.shop_sales_value) || 0) + (Number(payload.swiggy_sales_value) || 0) + (Number(payload.zomato_sales_value) || 0);
  const _tgt = Number(payload.target) || 0;
  if (_tgt > 0 && _total < _tgt) celebrate(20, "Boo boo! Target missed — only +20 for submitting 😭");
  else if (_tgt > 0) celebrate(50);
  else celebrate(20);
}
await new Promise(resolve => setTimeout(resolve, 500));
await fetchOutletReports(user);
};
  const playAlert = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.log("Audio not supported");
  }
};
  const submitForceAck = async (action: "complete" | "reason") => {
    if (!overdueTask) return;
    if (action === "reason") {
      if (forceAckReason.trim().length < 20) { alert("Please provide at least 20 characters explaining the delay."); return; }
      await supabase.from("tasks").update({ delay_reason: forceAckReason.trim(), status: "overdue" }).eq("id", overdueTask.id);
    } else {
      await supabase.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", overdueTask.id);
    }
    setOverdueTask(null);
    setForceAckReason("");
    if (user) fetchTasks(user);
  };

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const overdue = tasks.filter(t => t.status !== "completed" && new Date(t.due_at) < new Date()).length;
  const rate = total > 0 ? Math.round(completed / total * 100) : 0;
  const canAssign = user?.role === "Owner" || user?.role === "Manager";
  const hasReportDuty = user?.role !== "Owner";
  const reportFields = user ? REPORT_FIELDS[user.id] || [] : [];
  const reportInput = (f: { label: string; key: string }) => {
    if (user && user.id === "arun" && f.key === "achievement") {
      const ts = parseFloat(reportData.total_sales || "0");
      const tg = parseFloat(reportData.target || "299666");
      const pct = tg ? (ts / tg * 100).toFixed(1) + "%" : "";
      return <input type="text" readOnly value={pct} className="w-full bg-zinc-900 border border-zinc-800 text-yellow-400 px-3 py-2 text-sm cursor-not-allowed" placeholder="—" />;
    }
    const val = (user && user.id === "arun" && f.key === "target") ? (reportData.target ?? "299666") : (reportData[f.key] || "");
    return <input type="text" value={val} onChange={(e) => setReportData(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" placeholder="—" />;
  };

  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}
      {targetCheck && targetCheck.length > 0 && !targetReaction && (() => {
        const wins = targetCheck.filter((r: any) => r.status === "win").length;
        const misses = targetCheck.filter((r: any) => r.status === "miss").length;
        const header = misses > 0 ? "Yesterday had some gaps — let's go today! 🔥" : (wins > 0 ? "Yesterday was a win! 👏🎉" : "Fresh start today 🚀");
        const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
        return (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={() => setTargetCheck(null)}>
            <div className="bg-[#131316] border border-yellow-400 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-black mb-4">{header}</h3>
              <div className="space-y-2 mb-5">
                {targetCheck.map((r: any) => (
                  <div key={r.oid} className="text-sm font-mono border-b border-zinc-800 pb-2">
                    {r.status === "win" && <span className="text-green-400">🎉 {r.name}: {fmt(r.actual)} vs {fmt(r.target)} — smashed it!</span>}
                    {r.status === "miss" && <span className="text-yellow-400">💪 {r.name}: {fmt(r.actual)} vs {fmt(r.target)} — bit short, today's the bounce-back!</span>}
                    {r.status === "noentry" && <span className="text-zinc-500">🤔 {r.name}: no entry logged yesterday</span>}
                    {r.status === "notarget" && <span className="text-blue-400">🚀 {r.name}: new outlet — no target yet, every sale counts!</span>}
                  </div>
                ))}
              </div>
             <button onClick={() => setTargetReaction(true)} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-5 py-2.5 uppercase w-full">Next →</button>
            </div>
          </div>
      );
      })()}
      {targetCheck && targetReaction && (() => {
        const misses = targetCheck.filter((r: any) => r.status === "miss").length;
        const wins = targetCheck.filter((r: any) => r.status === "win").length;
        const bad = misses > 0;
        const neutral = wins === 0 && misses === 0;
        const close = () => { setTargetCheck(null); setTargetReaction(false); };
        return (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={close}>
            <style>{`@keyframes bhShake{0%,100%{transform:translateX(0) rotate(0)}20%{transform:translateX(-10px) rotate(-6deg)}40%{transform:translateX(10px) rotate(6deg)}60%{transform:translateX(-8px) rotate(-4deg)}80%{transform:translateX(8px) rotate(4deg)}}@keyframes bhPop{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}`}</style>
            <div className={`max-w-sm w-full p-8 text-center border-2 ${bad ? "bg-[#1a1010] border-red-500" : (neutral ? "bg-[#101418] border-blue-400" : "bg-[#101a12] border-green-400")}`} onClick={(e) => e.stopPropagation()}>
              <div className="text-8xl mb-3" style={{ animation: bad ? "bhShake 0.4s ease-in-out 3" : "bhPop 0.5s ease-out", display: "inline-block" }}>{bad ? "🤚💥" : (neutral ? "🚀" : "👏")}</div>
              {!bad && !neutral && <div className="text-3xl mb-3">🎉 🎊 🎉</div>}
              <h3 className="text-2xl font-black mb-2">{bad ? "SLAP! 🖐️😵‍💫 Target said NO" : (neutral ? "Fresh start, let's roll! 🚀" : "BOOM! You SMASHED it! 👏")}</h3>
              <p className="text-sm font-mono text-zinc-400 mb-6">{bad ? "That's a wake-up smack 😤 Shake it off — today you hit back twice as hard!" : (neutral ? "No target pressure — every sale's a bonus." : "Target crushed. Keep that energy going today!")}</p>
              <button onClick={close} className={`${bad ? "bg-red-500" : (neutral ? "bg-blue-400" : "bg-green-400")} text-black font-bold tracking-widest text-xs px-6 py-3 uppercase w-full`}>Let's go →</button>
            </div>
          </div>
        );
      })()}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="fixed top-4 left-4 z-50 md:hidden bg-zinc-900 border border-zinc-700 p-2 text-white">☰</button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-[#131316] border-r border-zinc-800 flex flex-col shrink-0 transition-transform duration-200 md:relative md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-6 py-6 border-b border-zinc-800">
          <h1 className="text-xl font-black tracking-tight">TASK<span className="text-yellow-400">FORCE</span></h1>
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mt-1">Brownie Heaven</p>
        </div>
        <nav className="flex-1 px-3 py-4">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest px-3 pb-2">Workspace</p>
          <div onClick={() => { setActiveTab("tasks"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "tasks" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
            <span>▣</span> Dashboard
          </div>
        <div onClick={() => { router.push("/leaderboard"); }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors text-zinc-500 hover:text-white">
            <span>🏆</span> Leaderboard
          </div>
         {["nishant","arun","nilani","vishnu","ahila"].includes(user?.id ?? "") && (
            <div onClick={() => { router.push("/orders-race"); }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors text-zinc-500 hover:text-white">
              <span>⚔️</span> Orders Race
            </div>
          )}
          {hasReportDuty && (
            <div onClick={() => { setActiveTab("my_report"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "my_report" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>📋</span> My Report
             {!todayReport && <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full"></span>}
            </div>
          )}
          {user.role === "HR" && (
            <div onClick={() => { setActiveTab("attendance"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "attendance" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>👥</span> Attendance
            </div>
          )}
         {((user.outlets && user.outlets.length > 0) || canAssign) && (
  <div onClick={() => { setActiveTab("outlet_reports"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "outlet_reports" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
    <span>🏪</span> Outlets
  {Object.keys(outletReports).length < (user.outlets?.length || 0) && <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full"></span>}
  </div>
)}
         {((user.outlets && user.outlets.length > 0) || canAssign) && (
            <div onClick={() => { setActiveTab("sales_target"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "sales_target" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>🎯</span> Sales Target
            </div>
          )}
         {((user.outlets && user.outlets.length > 0) || canAssign) && (
            <div onClick={() => { setActiveTab("payout"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "payout" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>💰</span> Payout
            </div>
          )}
          {canAssign && (
            <>
             <div onClick={() => { setActiveTab("all_reports"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "all_reports" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
                <span>📋</span> Reports
              </div>
              <div onClick={() => { setActiveTab("analytics"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "analytics" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
                <span>◬</span> Analytics
              </div>
              <div onClick={() => { setActiveTab("owner_outlets"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "owner_outlets" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>🏪</span> Outlet Reports
              </div>
              <div onClick={() => { setActiveTab("history"); setSidebarOpen(false); fetchHistoryReports(historyDate); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "history" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
             <span>📅</span> History
             </div>
            </>
          )}
        </nav>
        <div className="px-4 py-4 border-t border-zinc-800 flex items-center gap-2">
          <div className="w-9 h-9 bg-yellow-400 text-black flex items-center justify-center font-bold text-sm shrink-0">
            {user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wide">{user.role}</p>
          </div>
          <button onClick={() => setShowPinModal(true)} className="text-[10px] font-mono text-zinc-600 uppercase hover:text-yellow-400 transition-colors shrink-0">PIN</button>
          <button onClick={() => { localStorage.removeItem("currentUser"); router.push("/"); }} className="text-[10px] font-mono text-zinc-600 uppercase hover:text-red-500 transition-colors shrink-0">Exit</button>
        </div>
      </aside>

      <main className="flex-1 px-4 py-4 md:px-8 md:py-8 overflow-auto">

        {activeTab === "tasks" && (
          <div>
            <div className="flex justify-between items-start mb-6 pb-5 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">{canAssign ? "Command Center" : "My Tasks"}</h2>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Welcome back, {user.name.split(" ")[0]}</p>
              </div>
              {canAssign && (
                <button onClick={() => setShowModal(true)} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-4 py-3 hover:opacity-90 transition-opacity uppercase">+ Assign Task</button>
              )}
           </div>
            {user.role !== "Owner" && (
              <div className="flex items-center justify-between bg-[#131316] border border-zinc-800 px-5 py-4 mb-6">
                <div>
                  <p className="text-sm font-semibold">Off day today</p>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">Reports you submit won't earn or lose points</p>
                </div>
                <button onClick={() => setReportOffDay(!reportOffDay)} className={`relative w-12 h-6 rounded-full transition-colors ${reportOffDay ? "bg-yellow-400" : "bg-zinc-700"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform ${reportOffDay ? "translate-x-6" : ""}`}></span>
                </button>
              </div>
            )}
           {canAssign && (
              <div className="flex gap-2 flex-wrap mb-6">
                {["all", ...OUTLETS].map(o => (
                  <button key={o} onClick={() => setOutletFilter(o)} className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${outletFilter === o ? "border-yellow-400 text-yellow-400" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>
                    {o === "all" ? "All" : (OUTLET_NAMES[o] || o.replace(/_/g, " "))}
                  </button>
                ))}
              </div>
            )}
            {canAssign && (
              <div className="bg-[#131316] border border-zinc-800 mb-6">
                <div className="px-5 py-3 border-b border-zinc-800">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Staff Status — Today (report time)</p>
                </div>
                {ALL_STAFF.filter(s => s.id !== "nishant").map(s => {
                  const staffTasks = tasks.filter(t => t.assigned_to === s.id);
                  const staffOverdue = staffTasks.filter(t => t.status !== "completed" && new Date(t.due_at) < new Date()).length;
                  const staffCompleted = staffTasks.filter(t => t.status === "completed").length;
                 const todayReport = reports.find(r => r.staff_id === s.id && new Date(r.submitted_at).toDateString() === new Date().toDateString());
                  const hasReport = !!todayReport;
                  return (
                    <div key={s.id} className="grid grid-cols-[1fr_56px_56px_56px_130px] gap-2 items-center px-5 py-3 border-b border-zinc-800 last:border-0">
                      <div>
                        <p className="font-semibold text-sm">{s.name}</p>
                        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{s.role}</p>
                      </div>
                      <div className="text-center">
                        <p className="font-mono text-sm font-bold">{staffTasks.length}</p>
                        <p className="text-[9px] font-mono text-zinc-600 uppercase">Tasks</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-mono text-sm font-bold ${staffOverdue > 0 ? "text-red-500" : "text-zinc-500"}`}>{staffOverdue}</p>
                        <p className="text-[9px] font-mono text-zinc-600 uppercase">Late</p>
                      </div>
                      <div className="text-center">
                        <p className="font-mono text-sm font-bold text-green-400">{staffCompleted}</p>
                        <p className="text-[9px] font-mono text-zinc-600 uppercase">Done</p>
                      </div>
                      <div className="text-center">
                        <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 ${hasReport ? (todayReport!.is_late ? "bg-red-500/10 text-red-500" : "bg-green-400/10 text-green-400") : "bg-yellow-400/10 text-yellow-400"}`}>
                          {hasReport ? `✓ ${new Date(todayReport!.submitted_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}${todayReport!.is_late ? " late" : ""}` : "Pending"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
           {canAssign && (
              <div className="bg-[#131316] border border-zinc-800 mb-6">
                <div className="px-5 py-3 border-b border-zinc-800">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Outlet Reports — Today{outletFilter !== "all" ? ` · ${OUTLET_NAMES[outletFilter] || outletFilter.replace(/_/g, " ")}` : ""}</p>
                </div>
                {(outletFilter === "all" ? OUTLETS : [outletFilter]).map(o => {
                  const rep = allOutletReports.find(r => r.outlet_id === o);
                  const mgr = ALL_STAFF.find(s => (s.outlets as string[]).includes(o));
                  const oTotal = rep ? (Number(rep.shop_sales_value) || 0) + (Number(rep.swiggy_sales_value) || 0) + (Number(rep.zomato_sales_value) || 0) : 0;
                  const oTgt = rep ? Number(rep.target) || 0 : 0;
                  const hit = oTgt > 0 && oTotal >= oTgt;
                  return (
                    <div key={o} className="border-b border-zinc-800 last:border-0 px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm uppercase tracking-widest">{OUTLET_NAMES[o] || o.replace(/_/g, " ")}</p>
                          <p className="text-[10px] font-mono text-zinc-600">{mgr?.name || "—"}</p>
                        </div>
                        {rep ? (
                          <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 ${rep.is_late ? "bg-red-500/10 text-red-500" : "bg-green-400/10 text-green-400"}`}>✓ {new Date(rep.submitted_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}{rep.is_late ? " late" : ""}</span>
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 bg-yellow-400/10 text-yellow-400">Pending</span>
                        )}
                      </div>
                      {rep && (
                        <div className="text-[11px] font-mono text-zinc-400 space-y-1">
                          <div className="flex flex-wrap gap-x-5 gap-y-1">
                            <span>Shop ₹{rep.shop_sales_value} ({rep.shop_sales_count})</span>
                            <span>Swiggy ₹{rep.swiggy_sales_value} ({rep.swiggy_sales_count})</span>
                            <span>Zomato ₹{rep.zomato_sales_value} ({rep.zomato_sales_count})</span>
                            <span className="text-white">Total ₹{oTotal}</span>
                            {oTgt > 0 && <span className={hit ? "text-green-400" : "text-red-500"}>Target ₹{oTgt} {hit ? "✓ hit" : "✗ miss"}</span>}
                          </div>
                          {(rep.bh_google_rating || rep.expiry_count || rep.issues || rep.action_taken) && (
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-zinc-500">
                              {rep.bh_google_rating ? <span>Google {rep.bh_google_rating}</span> : null}
                              {rep.expiry_count ? <span>Expiry {rep.expiry_count}</span> : null}
                              {rep.issues ? <span>Issues: {rep.issues}</span> : null}
                              {rep.action_taken ? <span>Action: {rep.action_taken}</span> : null}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800 border border-zinc-800 mb-6">
              {[
                { label: "Total Tasks", value: total, sub: "assigned", color: "" },
                { label: "Completed", value: completed, sub: `${rate}% rate`, color: "text-green-400" },
                { label: "In Progress", value: inProgress, sub: "active", color: "text-yellow-400" },
                { label: "Overdue", value: overdue, sub: overdue > 0 ? "action needed" : "all clear", color: overdue > 0 ? "text-red-500" : "" },
              ].map((s) => (
                <div key={s.label} className="bg-[#131316] p-4">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">{s.label}</p>
                  <p className={`text-3xl font-black tracking-tight ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] font-mono text-zinc-600 mt-1">{s.sub}</p>
                </div>
              ))}
            </div>
            {loading ? (
              <div className="bg-[#131316] border border-zinc-800 p-10 text-center">
                <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">Loading...</p>
              </div>
            ) : tasks.filter(t => (outletFilter === "all" || t.outlet_id === outletFilter) && t.status !== "completed").length === 0 ? (
              <div className="bg-[#131316] border border-zinc-800 p-10 text-center">
                <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">No tasks yet</p>
              </div>
            ) : (
              <div className="bg-[#131316] border border-zinc-800">
                {tasks.filter(t => (outletFilter === "all" || t.outlet_id === outletFilter) && t.status !== "completed").map((t) => {
                  const assigneeName = ALL_STAFF.find(s => s.id === t.assigned_to)?.name || t.assigned_to;
                  const isOverdue = t.status !== "completed" && new Date(t.due_at) < new Date();
                  return (
                    <div key={t.id} className={`flex flex-wrap gap-2 items-center px-4 py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-900 transition-colors ${isOverdue ? "border-l-2 border-l-red-500" : ""}`}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${t.priority === "critical" ? "bg-red-500" : t.priority === "high" ? "bg-orange-400" : t.priority === "medium" ? "bg-yellow-400" : "bg-zinc-600"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{t.title}</p>
                        <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{assigneeName} · {t.due_at ? new Date(t.due_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "No deadline"}{t.outlet_id ? ` · ${OUTLET_NAMES[t.outlet_id] || t.outlet_id.replace(/_/g, " ")}` : ""}</p>
                      </div>
                      <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 ${t.status === "completed" ? "bg-green-400/10 text-green-400" : isOverdue ? "bg-red-500/10 text-red-500" : t.status === "in_progress" ? "bg-yellow-400/10 text-yellow-400" : "bg-zinc-800 text-zinc-500"}`}>
                        {isOverdue && t.status !== "completed" ? "overdue" : t.status.replace("_", " ")}
                      </span>
                      <div className="flex gap-2">
                        {t.status !== "completed" && (
                          <>
                            {t.status === "assigned" && <button onClick={() => updateStatus(t.id, "in_progress")} className="text-[10px] font-mono uppercase px-2 py-1 border border-zinc-700 hover:border-yellow-400 hover:text-yellow-400 transition-colors">Start</button>}
                            <button onClick={() => updateStatus(t.id, "completed")} className="text-[10px] font-mono uppercase px-2 py-1 border border-zinc-700 hover:border-green-400 hover:text-green-400 transition-colors">Done</button>
                          </>
                        )}
                        {user.role === "Owner" && <button onClick={() => deleteTask(t.id)} className="text-[10px] font-mono uppercase px-2 py-1 border border-zinc-700 hover:border-red-500 hover:text-red-500 transition-colors">✕</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      {activeTab === "sales_target" && (
          <div>
            <div className="flex justify-between items-start mb-6 pb-5 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Sales Target</h2>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Average updates as you enter {new Date().toLocaleString("en-IN", { month: "long" })}</p>
              </div>
            </div>
            {(canAssign ? OUTLETS : (user.outlets || [])).map((oid: string) => (
              <div key={oid} className="mb-8">
                <h3 className="text-lg font-bold mb-3">{OUTLET_NAMES[oid] || oid}</h3>
                {["BH", "CBH"].map((brand) => {
                  const items = salesTargets[oid]?.[brand];
                  if (!items) return null;
                  const key = `${oid}_${brand}`;
                  const editing = stEditing === key;
                  const curMonth = new Date().toLocaleString("en-IN", { month: "short" });
                  return (
                    <div key={brand} className="bg-[#131316] border border-zinc-800 mb-5 overflow-x-auto">
                      <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-800">
                        <span className="font-mono text-xs uppercase tracking-widest text-yellow-400">{brand}</span>
                        {editing ? (
                          <div className="flex gap-2">
                            <button onClick={() => saveSalesTarget(oid, brand, items)} disabled={stSaving} className="bg-yellow-400 text-black font-bold text-[10px] px-3 py-1.5 uppercase tracking-widest disabled:opacity-50">{stSaving ? "Saving..." : "Save"}</button>
                            <button onClick={() => { setStEditing(null); setStEditValues({}); }} className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-2">Cancel</button>
                          </div>
                        ) : (
                         (user.outlets || []).includes(oid) ? <button onClick={() => { setStEditing(key); setStEditValues({}); }} className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest border border-zinc-700 px-3 py-1.5 hover:border-yellow-400 hover:text-yellow-400">Edit {curMonth}</button> : <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">View only</span>
                        )}
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[10px] font-mono text-zinc-500 uppercase">
                            <th className="text-left px-4 py-2">Line item</th>
                            <th className="text-right px-4 py-2">Average</th>
                            <th className="text-right px-4 py-2">{curMonth}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it: any) => {
                            const vals = Object.values(it.months || {}).map(Number);
                            const avg = vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
                            const curKey = new Date().toISOString().slice(0, 7);
                            const curVal = it.months?.[curKey];
                            return (
                              <tr key={it.name} className="border-t border-zinc-800/60">
                                <td className="px-4 py-2 text-zinc-300">{it.name}</td>
                                <td className="px-4 py-2 text-right font-mono">{Math.round(avg).toLocaleString("en-IN")}</td>
                                <td className="px-4 py-2 text-right font-mono">
                                  {editing ? (
                                    <input type="number" defaultValue={curVal ?? ""} onChange={(e) => setStEditValues(prev => ({ ...prev, [it.name]: e.target.value }))} className="w-28 bg-black border border-zinc-700 text-white px-2 py-1 text-right focus:outline-none focus:border-yellow-400" placeholder="—" />
                                  ) : (curVal !== undefined ? Math.round(curVal).toLocaleString("en-IN") : "—")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
                {!salesTargets[oid] && <p className="text-zinc-600 font-mono text-xs">No data loaded yet for this outlet.</p>}
              </div>
            ))}
          </div>
        )}
       {activeTab === "payout" && (
          <div>
            <div className="flex justify-between items-start mb-6 pb-5 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Payout</h2>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Updated Fridays</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-5 max-w-3xl">
              <div className="bg-[#131316] border border-zinc-800 p-5">
                <p className="font-mono text-xs uppercase tracking-widest text-orange-400 mb-2">Swiggy</p>
                <p className="text-zinc-600 font-mono text-xs">Coming soon — fields to be added.</p>
              </div>
              <div className="bg-[#131316] border border-zinc-800 p-5">
                <p className="font-mono text-xs uppercase tracking-widest text-red-400 mb-2">Zomato</p>
                <p className="text-zinc-600 font-mono text-xs">Coming soon — fields to be added.</p>
              </div>
            </div>
          </div>
        )}
       {activeTab === "attendance" && (
          <div>
            <div className="flex justify-between items-start mb-6 pb-5 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Attendance</h2>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Today's staff count</p>
              </div>
            </div>
           <div className="bg-[#131316] border border-zinc-800 p-6 max-w-md">
              <div className="mb-5">
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Date</label>
               <input type="date" value={attendanceDate} onChange={(e) => { setAttendanceDate(e.target.value); if (user) fetchAttendance(user, e.target.value); }} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" />
                <p className="text-[11px] font-mono text-yellow-400/80 uppercase tracking-widest mt-1.5">
                  {(() => {
                    const today = new Date().toISOString().split("T")[0];
                    const y = new Date(Date.now() - 86400000).toISOString().split("T")[0];
                    const pretty = new Date(attendanceDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
                    const tag = attendanceDate === today ? "Today" : attendanceDate === y ? "Yesterday" : null;
                    return tag ? `${tag} • ${pretty}` : pretty;
                  })()}
                </p>
              </div>
              {todayAttendance ? (
                <div>
                  <p className="text-green-400 font-mono text-sm uppercase tracking-widest mb-4">✓ Submitted for today</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div><p className="text-3xl font-black">{todayAttendance.present}</p><p className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Present</p></div>
                    <div><p className="text-3xl font-black">{todayAttendance.absent}</p><p className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Absent</p></div>
                    <div><p className="text-3xl font-black">{todayAttendance.late}</p><p className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Late</p></div>
                  </div>
                  {(todayAttendance.absent_names || todayAttendance.late_names) && (
                    <div className="mt-4 space-y-2 text-sm">
                      {todayAttendance.absent_names && <p><span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Absent:</span> {todayAttendance.absent_names}</p>}
                      {todayAttendance.late_names && <p><span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Late:</span> {todayAttendance.late_names}</p>}
                    </div>
                  )}
                  <button onClick={() => { setAttendanceData({ present: String(todayAttendance.present), absent: String(todayAttendance.absent), late: String(todayAttendance.late), absent_names: todayAttendance.absent_names || "", late_names: todayAttendance.late_names || "" }); setTodayAttendance(null); }} className="mt-5 text-[10px] font-mono text-zinc-500 uppercase tracking-widest hover:text-yellow-400">Edit</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {[{ k: "present", l: "Total Staff Present" }, { k: "absent", l: "Total Absent" }, { k: "late", l: "Total Late" }].map(f => (
                    <div key={f.k}>
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{f.l}</label>
                      <input type="number" value={(attendanceData as any)[f.k]} onChange={(e) => setAttendanceData(prev => ({ ...prev, [f.k]: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" placeholder="0" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Absent — Names</label>
                    <textarea value={attendanceData.absent_names} onChange={(e) => setAttendanceData(prev => ({ ...prev, absent_names: e.target.value }))} rows={2} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" placeholder="e.g. Ravi, Priya" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Late — Names</label>
                    <textarea value={attendanceData.late_names} onChange={(e) => setAttendanceData(prev => ({ ...prev, late_names: e.target.value }))} rows={2} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" placeholder="e.g. Kumar" />
                  </div>
                  <button onClick={submitAttendance} disabled={attendanceSubmitting} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-6 py-3 hover:opacity-90 transition-opacity uppercase disabled:opacity-50">
                    {attendanceSubmitting ? "Submitting..." : "Submit Attendance →"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {(activeTab === "my_report" || activeTab === "all_reports") && (
      
          <div>
           <div className="flex justify-between items-end mb-6 pb-5 border-b border-zinc-800">
        <div>
    <h2 className="text-2xl font-black tracking-tight">{canAssign ? "All Reports" : "Daily Report"}</h2>
    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
      {canAssign ? "Staff submissions overview" : `Due by ${ALL_STAFF.find(s => s.id === user.id)?.report_time || "--:--"} daily`}
    </p>
  </div>
  {hasReportDuty && (
    <input
      type="date"
      value={reportHistoryDate}
      onChange={(e) => { setReportHistoryDate(e.target.value); fetchReportByDate(e.target.value); }}
      className="bg-black border border-zinc-800 text-white px-4 py-2.5 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm"
    />
  )}
</div>
           {(activeTab === "my_report" || activeTab === "all_reports") && hasReportDuty && (
  <div className="mb-8">
    {reportHistoryDate !== new Date().toISOString().split("T")[0] ? (
      <div className="bg-[#131316] border border-zinc-800 p-6">
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">
          Report for {new Date(reportHistoryDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        {reportByDate ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reportFields.map(f => (
              <div key={f.key} className="bg-black/30 px-3 py-2">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
                <p className="text-sm text-white mt-1">{reportByDate.report_data?.[f.key] || "—"}</p>
              </div>
            ))}
          </div>
       ) : (
          <div>
            <p className="text-[10px] font-mono text-yellow-400 uppercase tracking-widest mb-4">Back-dated entry — counts as -5</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {reportFields.map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{f.label}</label>
                  {reportInput(f)}
                </div>
              ))}
            </div>
            <button onClick={submitReport} disabled={reportSubmitting} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-6 py-3 hover:opacity-90 transition-opacity uppercase disabled:opacity-50">
              {reportSubmitting ? "Submitting..." : "Submit Back-dated Report →"}
            </button>
          </div>
        )}
    ) : null
  </div>

    ) : todayReport ? (
  <div className="bg-green-400/5 border border-green-400/30 p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <span className="text-green-400 font-mono text-xs uppercase tracking-widest">✓ Today's report submitted</span>
        {todayReport.is_late && <span className="text-red-500 font-mono text-[10px] uppercase bg-red-500/10 px-2 py-0.5">Late</span>}
      </div>
      <button
        onClick={async () => {
          if (!user) return;
          const data: Record<string, string> = {};
          if (todayReport.report_data) {
            reportFields.forEach(f => { data[f.key] = todayReport.report_data[f.key] || ""; });
          }
          await supabase.from("reports").delete().eq("id", todayReport.id);
          setTodayReport(null);
          setReportData(data);
        }}
        className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-zinc-700 hover:border-yellow-400 hover:text-yellow-400 transition-colors"
      >
        ✏ Edit
      </button>
    </div>
                    {todayReport.report_data && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {reportFields.map(f => (
                          <div key={f.key} className="bg-black/30 px-3 py-2">
                            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
                            <p className="text-sm text-white mt-1">{todayReport.report_data[f.key] || "—"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] font-mono text-zinc-600 mt-4">{new Date(todayReport.submitted_at).toLocaleString("en-IN")}</p>
                  </div>
                ) : (
                  <div className="bg-[#131316] border border-zinc-800 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <p className="text-sm font-bold uppercase tracking-widest">Submit Today's Report</p>
                      <span className="text-yellow-400 font-mono text-xs">Due: {ALL_STAFF.find(s => s.id === user.id)?.report_time}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {reportFields.map(f => (
                        <div key={f.key}>
                          <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{f.label}</label>
                          {reportInput(f)}
                        </div>
                      ))}
                    </div>
                    <button onClick={submitReport} disabled={reportSubmitting} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-6 py-3 hover:opacity-90 transition-opacity uppercase disabled:opacity-50">
                      {reportSubmitting ? "Submitting..." : "Submit Report →"}
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="bg-[#131316] border border-zinc-800">
              {reports.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">No reports yet</p>
                </div>
              ) : reports.map((r) => {
                const staffName = ALL_STAFF.find(s => s.id === r.staff_id)?.name || r.staff_id;
                const staffFields = REPORT_FIELDS[r.staff_id] || [];
                return (
                  <div key={r.id} className="border-b border-zinc-800 last:border-0">
                    <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => setSelectedReport(selectedReport?.id === r.id ? null : r)}>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">{canAssign ? staffName : "My Report"}</span>
                        {r.is_late && <span className="text-red-500 font-mono text-[10px] uppercase bg-red-500/10 px-2 py-0.5">Late</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-zinc-500">{new Date(r.submitted_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="text-zinc-500">{selectedReport?.id === r.id ? "▲" : "▼"}</span>
                      </div>
                    </div>
                    {selectedReport?.id === r.id && r.report_data && (
                      <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {staffFields.map(f => (
                          <div key={f.key} className="bg-black/30 px-3 py-2">
                            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
                            <p className="text-sm text-white mt-1">{r.report_data[f.key] || "—"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {activeTab === "owner_outlets" && (
  <div>
   <div className="flex justify-between items-end mb-6 pb-5 border-b border-zinc-800">
  <div>
    <h2 className="text-2xl font-black tracking-tight">Outlet Reports</h2>
    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">All 12 outlets — daily tracker</p>
  </div>
  <input
    type="date"
    value={historyDate}
   onChange={(e) => { setHistoryDate(e.target.value); fetchAllOutletReports(e.target.value); }}
    className="bg-black border border-zinc-800 text-white px-4 py-2.5 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm"
  />
</div>
    <div className="grid grid-cols-1 gap-4">
      {OUTLETS.map(o => {
        const report = allOutletReports.find(r => r.outlet_id === o);
      const manager = ALL_STAFF.find(s => (s.outlets as string[]).includes(o));
        return (
          <div key={o} className={`bg-[#131316] border ${report ? "border-green-400/30" : "border-zinc-800"} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <div>
               <p className="font-bold text-sm uppercase tracking-widest">{OUTLET_NAMES[o]}</p>
                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{manager?.name || "—"}</p>
              </div>
              {report ? (
                <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 bg-green-400/10 text-green-400">
                 ✓ Submitted {report.is_late ? "· Late" : "· On Time"}{report.is_edited ? " · Edited" : ""}
                 </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 bg-yellow-400/10 text-yellow-400">Pending</span>
              )}
            </div>
            {report && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Shop Sales", value: `₹${report.shop_sales_value} (${report.shop_sales_count})` },
                { label: "Shop AOV", value: report.shop_sales_count > 0 ? `₹${Math.round(Number(report.shop_sales_value) / Number(report.shop_sales_count))}` : "—" },
                { label: "Swiggy", value: `₹${report.swiggy_sales_value} (${report.swiggy_sales_count})` },
                { label: "Swiggy AOV", value: report.swiggy_sales_count > 0 ? `₹${Math.round(Number(report.swiggy_sales_value) / Number(report.swiggy_sales_count))}` : "—" },
                { label: "Zomato", value: `₹${report.zomato_sales_value} (${report.zomato_sales_count})` },
                { label: "Zomato AOV", value: report.zomato_sales_count > 0 ? `₹${Math.round(Number(report.zomato_sales_value) / Number(report.zomato_sales_count))}` : "—" },
                { label: "Total Sales", value: `₹${Number(report.shop_sales_value) + Number(report.swiggy_sales_value) + Number(report.zomato_sales_value)}` },
                { label: "Total AOV", value: (() => { const tv = Number(report.shop_sales_value) + Number(report.swiggy_sales_value) + Number(report.zomato_sales_value); const tc = Number(report.shop_sales_count) + Number(report.swiggy_sales_count) + Number(report.zomato_sales_count); return tc > 0 ? `₹${Math.round(tv/tc)}` : "—"; })() },
                 { label: "Target", value: `₹${report.target}` },
                  { label: "Swiggy Live", value: report.swiggy_live ? "✓ Yes" : "✗ No", color: report.swiggy_live ? "text-green-400" : "text-red-500" },
                  { label: "Zomato Live", value: report.zomato_live ? "✓ Yes" : "✗ No", color: report.zomato_live ? "text-green-400" : "text-red-500" },
                  { label: "Discount", value: report.discount_running || "—" },
                  { label: "Expiry", value: report.expiry_count > 0 ? `${report.expiry_count} items` : "None", color: report.expiry_count > 0 ? "text-red-500" : "" },
                  { label: "Complimentary", value: report.complimentary_count > 0 ? `${report.complimentary_count}` : "None" },
                  { label: "Issues", value: report.issues || "—", color: report.issues ? "text-yellow-400" : "" },
                  { label: "Action Taken", value: report.action_taken || "—" },
                ].map(f => (
                  <div key={f.label} className="bg-black/30 px-3 py-2">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
                    <p className={`text-sm mt-1 ${f.color || "text-white"}`}>{f.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
)}
{activeTab === "outlet_reports" && (
  <div>
    <div className="flex justify-between items-end mb-6 pb-5 border-b border-zinc-800">
  <div>
    <h2 className="text-2xl font-black tracking-tight">Outlet Reports</h2>
    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Daily tracker — fill for each outlet</p>
  </div>
  <input
    type="date"
    value={outletHistoryDate}
    onChange={(e) => { setOutletHistoryDate(e.target.value); fetchOutletReportsByDate(e.target.value); }}
    className="bg-black border border-zinc-800 text-white px-4 py-2.5 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm"
  />
</div>

    {/* Outlet selector tabs */}
    <div className="flex gap-2 flex-wrap mb-6">
     {(canAssign ? OUTLETS : (user.outlets || [])).map(o => {
        const submitted = !!outletReports[o];
        return (
         <button key={o} onClick={() => { setActiveOutlet(o); const lastRatings = lastOutletRatings[o]; setOutletReportData({ target: OUTLET_TARGETS[o] || "", bh_google_rating: lastRatings ? String(lastRatings.bh_google_rating || "") : "", bh_swiggy_rating: lastRatings ? String(lastRatings.bh_swiggy_rating || "") : "", bh_zomato_rating: lastRatings ? String(lastRatings.bh_zomato_rating || "") : "", cbh_google_rating: lastRatings ? String(lastRatings.cbh_google_rating || "") : "", cbh_swiggy_rating: lastRatings ? String(lastRatings.cbh_swiggy_rating || "") : "", cbh_zomato_rating: lastRatings ? String(lastRatings.cbh_zomato_rating || "") : "", icbh_google_rating: lastRatings ? String(lastRatings.icbh_google_rating || "") : "", icbh_swiggy_rating: lastRatings ? String(lastRatings.icbh_swiggy_rating || "") : "", icbh_zomato_rating: lastRatings ? String(lastRatings.icbh_zomato_rating || "") : "" }); }}
            className={`font-mono text-[10px] uppercase tracking-widest px-4 py-2 border transition-colors relative ${activeOutlet === o ? "border-yellow-400 text-yellow-400" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>
           {OUTLET_NAMES[o] || o.replace(/_/g, " ")}
            {submitted && <span className="ml-2 text-green-400">✓</span>}
          </button>
        );
      })}
    </div>

    {!activeOutlet && (
      <div className="bg-[#131316] border border-zinc-800 p-10 text-center">
        <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">Select an outlet above to fill today's report</p>
      </div>
    )}

   {activeOutlet && outletReports[activeOutlet] && (
  <div className="bg-green-400/5 border border-green-400/30 p-6 mb-4">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
<p className="text-green-400 font-mono text-xs uppercase tracking-widest">✓ Report for {OUTLET_NAMES[activeOutlet] || activeOutlet.replace(/_/g, " ")} — {(() => { const d = new Date(outletHistoryDate); d.setDate(d.getDate() - 1); return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); })()}</p>
  {outletReports[activeOutlet]?.is_edited && (
    <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-yellow-400/10 text-yellow-400">Edited</span>
  )}
</div>
      <button
        onClick={() => editOutletReport(activeOutlet)}
        className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-zinc-700 hover:border-yellow-400 hover:text-yellow-400 transition-colors"
      >
        ✏ Edit
      </button>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {[
        { label: "Shop Sales", value: `₹${outletReports[activeOutlet].shop_sales_value} (${outletReports[activeOutlet].shop_sales_count} orders)` },
        { label: "Shop AOV", value: outletReports[activeOutlet].shop_sales_count > 0 ? `₹${Math.round(Number(outletReports[activeOutlet].shop_sales_value) / Number(outletReports[activeOutlet].shop_sales_count))}` : "—" },
        { label: "Swiggy", value: `₹${outletReports[activeOutlet].swiggy_sales_value} (${outletReports[activeOutlet].swiggy_sales_count} orders)` },
        { label: "Swiggy AOV", value: outletReports[activeOutlet].swiggy_sales_count > 0 ? `₹${Math.round(Number(outletReports[activeOutlet].swiggy_sales_value) / Number(outletReports[activeOutlet].swiggy_sales_count))}` : "—" },
        { label: "Zomato", value: `₹${outletReports[activeOutlet].zomato_sales_value} (${outletReports[activeOutlet].zomato_sales_count} orders)` },
        { label: "Zomato AOV", value: outletReports[activeOutlet].zomato_sales_count > 0 ? `₹${Math.round(Number(outletReports[activeOutlet].zomato_sales_value) / Number(outletReports[activeOutlet].zomato_sales_count))}` : "—" },
        { label: "Total Sales", value: `₹${Number(outletReports[activeOutlet].shop_sales_value) + Number(outletReports[activeOutlet].swiggy_sales_value) + Number(outletReports[activeOutlet].zomato_sales_value)}`, color: "text-yellow-400" },
        { label: "Total AOV", value: (() => { const totalVal = Number(outletReports[activeOutlet].shop_sales_value) + Number(outletReports[activeOutlet].swiggy_sales_value) + Number(outletReports[activeOutlet].zomato_sales_value); const totalCount = Number(outletReports[activeOutlet].shop_sales_count) + Number(outletReports[activeOutlet].swiggy_sales_count) + Number(outletReports[activeOutlet].zomato_sales_count); return totalCount > 0 ? `₹${Math.round(totalVal / totalCount)}` : "—"; })(), color: "text-yellow-400" },
        { label: "Target", value: `₹${outletReports[activeOutlet].target}` },
        { label: "Swiggy Live", value: outletReports[activeOutlet].swiggy_live ? "✓ Yes" : "✗ No", color: outletReports[activeOutlet].swiggy_live ? "text-green-400" : "text-red-500" },
        { label: "Zomato Live", value: outletReports[activeOutlet].zomato_live ? "✓ Yes" : "✗ No", color: outletReports[activeOutlet].zomato_live ? "text-green-400" : "text-red-500" },
        { label: "Discount Running", value: outletReports[activeOutlet].discount_running || "—" },
        { label: "Expiry Items", value: `${outletReports[activeOutlet].expiry_count} — ${outletReports[activeOutlet].expiry_items || "—"}` },
        { label: "Complimentary", value: `${outletReports[activeOutlet].complimentary_count} — ${outletReports[activeOutlet].complimentary_reason || "—"}` },
        { label: "BH Google", value: outletReports[activeOutlet].bh_google_rating ? `⭐ ${outletReports[activeOutlet].bh_google_rating}` : "—" },
        { label: "BH Swiggy", value: outletReports[activeOutlet].bh_swiggy_rating ? `⭐ ${outletReports[activeOutlet].bh_swiggy_rating}` : "—" },
        { label: "BH Zomato", value: outletReports[activeOutlet].bh_zomato_rating ? `⭐ ${outletReports[activeOutlet].bh_zomato_rating}` : "—" },
        { label: "CBH Google", value: outletReports[activeOutlet].cbh_google_rating ? `⭐ ${outletReports[activeOutlet].cbh_google_rating}` : "—" },
        { label: "CBH Swiggy", value: outletReports[activeOutlet].cbh_swiggy_rating ? `⭐ ${outletReports[activeOutlet].cbh_swiggy_rating}` : "—" },
        { label: "CBH Zomato", value: outletReports[activeOutlet].cbh_zomato_rating ? `⭐ ${outletReports[activeOutlet].cbh_zomato_rating}` : "—" },
        { label: "ICBH Google", value: outletReports[activeOutlet].icbh_google_rating ? `⭐ ${outletReports[activeOutlet].icbh_google_rating}` : "—" },
        { label: "ICBH Swiggy", value: outletReports[activeOutlet].icbh_swiggy_rating ? `⭐ ${outletReports[activeOutlet].icbh_swiggy_rating}` : "—" },
        { label: "ICBH Zomato", value: outletReports[activeOutlet].icbh_zomato_rating ? `⭐ ${outletReports[activeOutlet].icbh_zomato_rating}` : "—" },
        { label: "Issues", value: outletReports[activeOutlet].issues || "—" },
        { label: "Action Taken", value: outletReports[activeOutlet].action_taken || "—" },
      ].map(f => (
        <div key={f.label} className="bg-black/30 px-3 py-2">
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
          <p className={`text-sm mt-1 ${f.color || "text-white"}`}>{f.value}</p>
        </div>
      ))}
    </div>
  </div>
)}

    {activeOutlet && !outletReports[activeOutlet] && (
      <div className="bg-[#131316] border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-bold uppercase tracking-widest">{OUTLET_NAMES[activeOutlet] || activeOutlet.replace(/_/g, " ")} — Today's Report</p>
          <span className="text-yellow-400 font-mono text-xs">Due: {ALL_STAFF.find(s => s.id === user.id)?.report_time}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
         {[
  { label: "Yesterday's Target (Rs)", key: "target" },
  { label: "Shop Sales — Orders Count", key: "shop_sales_count" },
  { label: "Shop Sales — Value (Rs)", key: "shop_sales_value" },
  { label: "Swiggy Orders Count", key: "swiggy_sales_count" },
  { label: "Swiggy Sales Value (Rs)", key: "swiggy_sales_value" },
  { label: "Zomato Orders Count", key: "zomato_sales_count" },
  { label: "Zomato Sales Value (Rs)", key: "zomato_sales_value" },
  { label: "Discount/Offer Running", key: "discount_running" },
  { label: "Unavailable Items", key: "unavailable_items" },
  { label: "Expiry Items Count", key: "expiry_count" },
  { label: "Expiry Items (list)", key: "expiry_items" },
  { label: "Complimentary Given (count)", key: "complimentary_count" },
  { label: "Complimentary Reason", key: "complimentary_reason" },
  { label: "BH — Google Rating", key: "bh_google_rating" },
  { label: "BH — Swiggy Rating", key: "bh_swiggy_rating" },
  { label: "BH — Zomato Rating", key: "bh_zomato_rating" },
  { label: "CBH — Google Rating", key: "cbh_google_rating" },
  { label: "CBH — Swiggy Rating", key: "cbh_swiggy_rating" },
 { label: "CBH — Zomato Rating", key: "cbh_zomato_rating" },
 { label: "ICBH — Google Rating", key: "icbh_google_rating" },
 { label: "ICBH — Swiggy Rating", key: "icbh_swiggy_rating" },
 { label: "ICBH — Zomato Rating", key: "icbh_zomato_rating" },
  { label: "Issues Today", key: "issues" },
  { label: "Action Taken", key: "action_taken" },
].map(f => (
  <div key={f.key}>
    <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{f.label}</label>
    <input
      type="text"
      value={outletReportData[f.key] || ""}
      onChange={(e) => setOutletReportData(prev => ({ ...prev, [f.key]: e.target.value }))}
      className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm"
      placeholder="—"
    />
  </div>
))}

{/* Yes/No dropdowns */}
{[
  { label: "Swiggy Live?", key: "swiggy_live" },
  { label: "Zomato Live?", key: "zomato_live" },
  { label: "Discount Rate Good?", key: "discount_rate_good" },
].map(f => (
  <div key={f.key}>
    <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{f.label}</label>
    <select
      value={outletReportData[f.key] || "yes"}
      onChange={(e) => setOutletReportData(prev => ({ ...prev, [f.key]: e.target.value }))}
      className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm"
    >
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  </div>
))}
        </div>
        <div className="mb-4">
          <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Report Date</label>
         <input type="date" max={new Date().toISOString().split("T")[0]} value={outletEntryDate} onChange={(e) => { setOutletEntryDate(e.target.value); setOutletWasOff(false); }} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" />
          {outletEntryDate < new Date().toISOString().split("T")[0] && (
            <div className="mt-3">
              <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5">Were you off on this day?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOutletWasOff(true)} className={`text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 border transition-colors ${outletWasOff ? "border-green-400 text-green-400" : "border-zinc-700 text-zinc-500"}`}>Yes, I was off</button>
                <button type="button" onClick={() => setOutletWasOff(false)} className={`text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 border transition-colors ${!outletWasOff ? "border-red-400 text-red-400" : "border-zinc-700 text-zinc-500"}`}>No</button>
              </div>
              <p className={`text-[11px] font-mono uppercase tracking-widest mt-2 ${outletWasOff ? "text-green-400" : "text-red-400"}`}>{outletWasOff ? "✓ Off day — no points, no penalty" : "⚠️ Back-dated — −30 penalty"}</p>
            </div>
          )}
        </div>
        <button onClick={submitOutletReport} disabled={outletSubmitting} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-6 py-3 hover:opacity-90 transition-opacity uppercase disabled:opacity-50">
          {outletSubmitting ? "Submitting..." : `Submit ${OUTLET_NAMES[activeOutlet] || activeOutlet.replace(/_/g, " ")} Report →`}
        </button>
      </div>
    )}
  </div>
)}
        {activeTab === "history" && (
  <div>
    <div className="flex justify-between items-end mb-6 pb-5 border-b border-zinc-800">
  <div>
    <h2 className="text-2xl font-black tracking-tight">History</h2>
    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">View reports by date</p>
  </div>
 <div className="flex gap-2">
  <button
    onClick={exportCSV}
    className="bg-zinc-800 border border-zinc-700 text-white font-bold tracking-widest text-xs px-5 py-3 hover:border-yellow-400 hover:text-yellow-400 transition-colors uppercase"
  >
    ↓ CSV
  </button>
  <button
    onClick={() => window.print()}
    className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-5 py-3 hover:opacity-90 transition-opacity uppercase"
  >
    ↓ PDF
  </button>
</div>
</div>
    <div className="flex items-center gap-4 mb-8">
      <input
        type="date"
        value={historyDate}
        onChange={(e) => { setHistoryDate(e.target.value); fetchHistoryReports(e.target.value); }}
        className="bg-black border border-zinc-800 text-white px-4 py-2.5 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm"
      />
      <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">{historyLoading ? "Loading..." : `${historyReports.length} reports · ${historyOutletReports.length} outlet reports`}</span>
    </div>

    {/* Staff Reports */}
    <div className="mb-8">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Staff Reports</p>
      <div className="bg-[#131316] border border-zinc-800">
        {historyReports.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">No reports for this date</p>
          </div>
        ) : historyReports.map((r) => {
          const staffName = ALL_STAFF.find(s => s.id === r.staff_id)?.name || r.staff_id;
          const staffFields = REPORT_FIELDS[r.staff_id] || [];
          return (
            <div key={r.id} className="border-b border-zinc-800 last:border-0">
              <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => setSelectedReport(selectedReport?.id === r.id ? null : r)}>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">{staffName}</span>
                  {r.is_late && <span className="text-red-500 font-mono text-[10px] uppercase bg-red-500/10 px-2 py-0.5">Late</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-zinc-500">{new Date(r.submitted_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-zinc-500">{selectedReport?.id === r.id ? "▲" : "▼"}</span>
                </div>
              </div>
              {selectedReport?.id === r.id && r.report_data && (
                <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {staffFields.map(f => (
                    <div key={f.key} className="bg-black/30 px-3 py-2">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
                      <p className="text-sm text-white mt-1">{r.report_data[f.key] || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>

    {/* Outlet Reports */}
    <div>
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Outlet Reports</p>
      <div className="grid grid-cols-1 gap-4">
        {historyOutletReports.length === 0 ? (
          <div className="bg-[#131316] border border-zinc-800 p-8 text-center">
            <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">No outlet reports for this date</p>
          </div>
        ) : historyOutletReports.map((r) => {
          const staffName = ALL_STAFF.find(s => s.id === r.staff_id)?.name || r.staff_id;
          return (
            <div key={r.id} className="bg-[#131316] border border-zinc-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold text-sm uppercase tracking-widest">{OUTLET_NAMES[r.outlet_id] || r.outlet_id.replace(/_/g, " ")}</p>
                  <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{staffName}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.is_late && <span className="font-mono text-[10px] uppercase px-2 py-1 bg-red-500/10 text-red-500">Late</span>}
                  <span className="text-[11px] font-mono text-zinc-500">{new Date(r.submitted_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Shop Sales", value: `₹${r.shop_sales_value} (${r.shop_sales_count})` },
                  { label: "Swiggy", value: `₹${r.swiggy_sales_value} (${r.swiggy_sales_count})` },
                  { label: "Zomato", value: `₹${r.zomato_sales_value} (${r.zomato_sales_count})` },
                  { label: "Target", value: `₹${r.target}` },
                  { label: "Swiggy Live", value: r.swiggy_live ? "✓ Yes" : "✗ No", color: r.swiggy_live ? "text-green-400" : "text-red-500" },
                  { label: "Zomato Live", value: r.zomato_live ? "✓ Yes" : "✗ No", color: r.zomato_live ? "text-green-400" : "text-red-500" },
                  { label: "Expiry", value: r.expiry_count > 0 ? `${r.expiry_count} — ${r.expiry_items}` : "None", color: r.expiry_count > 0 ? "text-red-500" : "" },
                  { label: "Issues", value: r.issues || "—", color: r.issues ? "text-yellow-400" : "" },
                ].map(f => (
                  <div key={f.label} className="bg-black/30 px-3 py-2">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
                    <p className={`text-sm mt-1 ${f.color || "text-white"}`}>{f.value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
)}
        {activeTab === "analytics" && (
          <div>
            <div className="mb-8 pb-5 border-b border-zinc-800">
              <h2 className="text-2xl font-black tracking-tight">Analytics</h2>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Performance overview — all staff</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#131316] border border-zinc-800 p-6">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">Completion Rate by Staff</p>
                {ALL_STAFF.filter(s => s.id !== "nishant").map(s => {
                  const staffTasks = tasks.filter(t => t.assigned_to === s.id);
                  const done = staffTasks.filter(t => t.status === "completed").length;
                  const tot = staffTasks.length || 1;
                  const pct = Math.round(done / tot * 100);
                  return (
                    <div key={s.id} className="mb-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{s.name.split(" ")[0]}</span>
                        <span className="font-mono text-xs text-zinc-500">{done}/{staffTasks.length} · {pct}%</span>
                      </div>
                      <div className="h-2 bg-zinc-800 border border-zinc-700">
                        <div className={`h-full transition-all ${pct >= 70 ? "bg-green-400" : pct >= 40 ? "bg-yellow-400" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-[#131316] border border-zinc-800 p-6">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">Task Breakdown</p>
                {[
                  { label: "Total Assigned", value: tasks.length, color: "text-white" },
                  { label: "Completed", value: tasks.filter(t => t.status === "completed").length, color: "text-green-400" },
                  { label: "In Progress", value: tasks.filter(t => t.status === "in_progress").length, color: "text-yellow-400" },
                  { label: "Not Started", value: tasks.filter(t => t.status === "assigned").length, color: "text-zinc-400" },
                  { label: "Overdue", value: tasks.filter(t => t.status !== "completed" && new Date(t.due_at) < new Date()).length, color: "text-red-500" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center py-3 border-b border-zinc-800 last:border-0">
                    <span className="text-sm text-zinc-400">{s.label}</span>
                    <span className={`font-mono font-bold text-lg ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#131316] border border-zinc-800 p-6">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">Reports Today</p>
                {ALL_STAFF.filter(s => s.id !== "nishant").map(s => {
                  const todayStr = new Date().toDateString();
                  const report = reports.find(r => r.staff_id === s.id && new Date(r.submitted_at).toDateString() === todayStr);
                  return (
                    <div key={s.id} className="flex justify-between items-center py-3 border-b border-zinc-800 last:border-0">
                      <span className="text-sm font-medium">{s.name.split(" ")[0]}</span>
                      <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 ${report ? report.is_late ? "bg-red-500/10 text-red-500" : "bg-green-400/10 text-green-400" : "bg-zinc-800 text-zinc-500"}`}>
                        {report ? report.is_late ? "Late" : "On Time" : "Pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="bg-[#131316] border border-zinc-800 p-6">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">Tasks by Outlet</p>
                {OUTLETS.map(o => {
                  const count = tasks.filter(t => t.outlet_id === o).length;
                  return (
                    <div key={o} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                      <span className="text-sm text-zinc-400 capitalize">{OUTLET_NAMES[o] || o.replace(/_/g, " ")}</span>
                      <span className="font-mono text-sm font-bold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[500px] bg-[#131316] border border-zinc-800 p-6 max-h-[90vh] overflow-y-auto">
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
                <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Optional details..." rows={2} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm resize-none" />
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
                  {OUTLETS.map(o => <option key={o} value={o}>{OUTLET_NAMES[o] || o.replace(/_/g, " ")}</option>)}
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

      {showPinModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[400px] bg-[#131316] border border-zinc-800 p-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
              <h3 className="text-xl font-black tracking-tight">Change PIN</h3>
              <button onClick={() => { setShowPinModal(false); setPinMsg(""); setNewPin(""); }} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">New PIN (min 4 digits)</label>
                <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="Enter new PIN" className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm" />
              </div>
              {pinMsg && <p className={`font-mono text-xs uppercase ${pinMsg.includes("success") ? "text-green-400" : "text-red-500"}`}>{pinMsg}</p>}
              <button onClick={updatePin} className="w-full bg-yellow-400 text-black font-bold tracking-widest text-sm py-3 hover:opacity-90 transition-opacity uppercase">Update PIN</button>
            </div>
          </div>
        </div>
      )}

      {overdueTask && user?.role !== "Owner" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(20,0,0,0.97)" }}>
          <div className="w-full max-w-[560px] bg-[#131316] border-2 border-red-500">
            <div className="bg-red-500 px-6 py-4 text-center font-mono text-xs font-bold uppercase tracking-widest text-white animate-pulse">
              ⚠ Action Required · Overdue Task ⚠
            </div>
            <div className="p-6">
              <h3 className="text-2xl font-black mb-2">You have an overdue task</h3>
              <p className="text-zinc-400 text-sm mb-4 leading-relaxed">This task is past its deadline. You must either complete it or provide a reason.</p>
              <div className="bg-black border border-zinc-800 p-4 mb-4">
                <p className="font-bold text-base mb-1">{overdueTask.title}</p>
                <p className="font-mono text-xs text-red-500 uppercase tracking-widest">
                  Overdue by {Math.round((Date.now() - new Date(overdueTask.due_at).getTime()) / 60000)} min · {overdueTask.priority}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Reason for delay (min 20 characters)</label>
                <textarea value={forceAckReason} onChange={(e) => setForceAckReason(e.target.value)} placeholder="Explain why this task is overdue..." rows={3} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-red-500 transition-colors text-sm resize-none" />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-zinc-800">
                <button onClick={() => submitForceAck("reason")} className="px-5 py-2.5 border border-zinc-700 text-sm font-medium hover:border-zinc-500 transition-colors">Submit Reason</button>
                <button onClick={() => submitForceAck("complete")} className="px-5 py-2.5 bg-yellow-400 text-black font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity">Mark Complete</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
