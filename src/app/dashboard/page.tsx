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
    setRepor
