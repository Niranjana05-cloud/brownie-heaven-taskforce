"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Question = { id: string; question: string; answer: string; sort_order: number | null; created_at: string };

export default function HelpTab({ canEdit }: { canEdit: boolean }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");

  const fetchQuestions = async () => {
    setLoading(true);
    const { data } = await supabase.from("help_questions").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    setQuestions(data || []);
    setLoading(false);
  };
  useEffect(() => { fetchQuestions(); }, []);

  const addQuestion = async () => {
    if (!newQ.trim() || !newA.trim()) { alert("Fill in both the question and the answer."); return; }
    setSaving(true);
    const nextOrder = questions.length ? Math.max(...questions.map((q) => q.sort_order || 0)) + 1 : 1;
    const { error } = await supabase.from("help_questions").insert({ question: newQ.trim(), answer: newA.trim(), sort_order: nextOrder });
    setSaving(false);
    if (error) { alert("Save failed: " + error.message); return; }
    setNewQ(""); setNewA(""); setAdding(false);
    fetchQuestions();
  };

  const startEdit = (q: Question) => { setEditingId(q.id); setEditQ(q.question); setEditA(q.answer); setOpenId(q.id); };
  const saveEdit = async () => {
    if (!editingId || !editQ.trim() || !editA.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("help_questions").update({ question: editQ.trim(), answer: editA.trim() }).eq("id", editingId);
    setSaving(false);
    if (error) { alert("Save failed: " + error.message); return; }
    setEditingId(null);
    fetchQuestions();
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    await supabase.from("help_questions").delete().eq("id", id);
    fetchQuestions();
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-6 pb-5 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Help</h2>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Answers to common questions</p>
        </div>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="bg-yellow-400 text-black font-bold text-xs px-4 py-2.5 uppercase tracking-widest hover:opacity-90 transition-opacity">
            + Add Question
          </button>
        )}
      </div>

      {canEdit && adding && (
        <div className="mb-6 border border-zinc-800 p-5 max-w-2xl">
          <p className="text-sm font-semibold mb-3">New question</p>
          <div className="mb-3">
            <label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Question</label>
            <input type="text" value={newQ} onChange={(e) => setNewQ(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="e.g. How do I change my PIN?" />
          </div>
          <div className="mb-4">
            <label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Answer</label>
            <textarea value={newA} onChange={(e) => setNewA(e.target.value)} rows={3} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="Write the answer here..." />
          </div>
          <div className="flex gap-2">
            <button onClick={addQuestion} disabled={saving} className="bg-yellow-400 text-black px-5 py-2 text-sm font-semibold hover:bg-yellow-300 disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Save"}</button>
            <button onClick={() => { setAdding(false); setNewQ(""); setNewA(""); }} className="text-zinc-500 text-sm font-mono uppercase px-3">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-zinc-500">No questions yet.</p>
      ) : (
        <div className="max-w-2xl space-y-2">
          {questions.map((q) => {
            const open = openId === q.id;
            const editing = editingId === q.id;
            return (
              <div key={q.id} className="border border-zinc-800 bg-[#131316]">
                <button
                  onClick={() => setOpenId(open ? null : q.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold">{q.question}</span>
                  <span className="text-zinc-600 shrink-0 ml-3">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
                    {editing ? (
                      <div>
                        <input type="text" value={editQ} onChange={(e) => setEditQ(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mb-2" />
                        <textarea value={editA} onChange={(e) => setEditA(e.target.value)} rows={3} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mb-3" />
                        <div className="flex gap-2">
                          <button onClick={saveEdit} disabled={saving} className="bg-yellow-400 text-black px-4 py-1.5 text-xs font-semibold hover:bg-yellow-300 disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Save"}</button>
                          <button onClick={() => setEditingId(null)} className="text-zinc-500 text-xs font-mono uppercase px-2">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-zinc-400 whitespace-pre-wrap">{q.answer}</p>
                        {canEdit && (
                          <div className="flex gap-3 mt-3">
                            <button onClick={() => startEdit(q)} className="text-[10px] font-mono uppercase text-zinc-500 hover:text-yellow-400 transition-colors">Edit</button>
                            <button onClick={() => deleteQuestion(q.id)} className="text-[10px] font-mono uppercase text-zinc-500 hover:text-red-400 transition-colors">Delete</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
