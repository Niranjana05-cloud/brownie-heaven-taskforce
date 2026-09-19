"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type StaffLite = { id: string; name: string; role?: string };
type Msg = { id: string; from_id: string; to_id: string; body: string; created_at: string; read_at: string | null };

export default function MessagesTab({
  mode,
  currentUserId,
  currentUserName,
  staffList,
}: {
  mode: "owner" | "staff";
  currentUserId: string;
  currentUserName: string;
  staffList?: StaffLite[];
}) {
  const [selectedId, setSelectedId] = useState<string>(mode === "owner" ? (staffList?.[0]?.id || "") : "nishant");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [unreadByStaff, setUnreadByStaff] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const counterpartyId = mode === "owner" ? selectedId : "nishant";
  const counterpartyName = mode === "owner" ? (staffList?.find((s) => s.id === selectedId)?.name || selectedId) : "Nishant";

  const fetchUnreadCounts = async () => {
    if (mode !== "owner") return;
    const { data } = await supabase.from("messages").select("from_id").eq("to_id", "nishant").is("read_at", null);
    const counts: Record<string, number> = {};
    (data || []).forEach((m: any) => { counts[m.from_id] = (counts[m.from_id] || 0) + 1; });
    setUnreadByStaff(counts);
  };

  const fetchThread = async () => {
    if (!counterpartyId) { setMessages([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(from_id.eq.${currentUserId},to_id.eq.${counterpartyId}),and(from_id.eq.${counterpartyId},to_id.eq.${currentUserId})`)
      .order("created_at", { ascending: true });
    const rows = data || [];
    setMessages(rows);
    setLoading(false);

    // Mark the other person's messages to me as read, now that I've opened this thread.
    const unreadIds = rows.filter((m) => m.to_id === currentUserId && m.from_id === counterpartyId && !m.read_at).map((m) => m.id);
    if (unreadIds.length > 0) {
      await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
      if (mode === "owner") fetchUnreadCounts();
    }
  };

  useEffect(() => { fetchThread(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedId]);
  useEffect(() => { if (mode === "owner") fetchUnreadCounts(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Staff can only reply once Nishant has actually started this conversation.
  const canSend = mode === "owner" ? !!selectedId : messages.some((m) => m.from_id === "nishant");

  const send = async () => {
    if (!draft.trim() || !canSend) return;
    setSending(true);
    const body = draft.trim();
    const { error } = await supabase.from("messages").insert({ from_id: currentUserId, to_id: counterpartyId, body });
    setSending(false);
    if (error) { alert("Send failed: " + error.message); return; }
    setDraft("");
    fetchThread();
    fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staff_ids: [counterpartyId],
        title: mode === "owner" ? "💬 Message from Nishant" : `💬 Reply from ${currentUserName}`,
        body,
        url: "/dashboard?tab=messages",
        tag: "message",
      }),
    }).catch(() => {});
  };

  return (
    <div>
      <div className="mb-6 pb-5 border-b border-zinc-800">
        <h2 className="text-2xl font-black tracking-tight">Messages</h2>
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
          {mode === "owner" ? "Direct conversations with staff" : "Conversation with Nishant"}
        </p>
      </div>

      {mode === "owner" && staffList && (
        <div className="flex flex-wrap gap-2 mb-6">
          {staffList.map((s) => {
            const on = selectedId === s.id;
            const unread = unreadByStaff[s.id] || 0;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`relative px-3 py-1.5 text-sm font-semibold transition-colors ${on ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}
              >
                {s.name.split(" ")[0]}
                {unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unread}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="max-w-xl border border-zinc-800 bg-[#131316] flex flex-col" style={{ height: "60vh" }}>
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className="text-sm font-semibold">{counterpartyName}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-zinc-600">{mode === "staff" ? "No messages yet from Nishant." : "No messages yet — say hello."}</p>
          ) : (
            messages.map((m) => {
              const mine = m.from_id === currentUserId;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-3 py-2 text-sm ${mine ? "bg-yellow-400 text-black" : "bg-zinc-800 text-white"}`}>
                    <p>{m.body}</p>
                    <p className={`text-[10px] mt-1 font-mono ${mine ? "text-black/60" : "text-zinc-500"}`}>
                      {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      {mine && (m.read_at ? " · Read" : " · Sent")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        <div className="p-3 border-t border-zinc-800 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !sending) send(); }}
            disabled={!canSend}
            placeholder={canSend ? "Type a message..." : "Waiting for Nishant to start this conversation"}
            className="flex-1 bg-black border border-zinc-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-yellow-400 transition-colors disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!canSend || sending || !draft.trim()}
            className="bg-yellow-400 text-black px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-yellow-300 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
