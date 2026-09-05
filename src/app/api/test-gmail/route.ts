import { ImapFlow } from "imapflow";
import { NextResponse } from "next/server";

export async function GET() {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    logger: false,
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    const results: { subject: string; from: string; date: string }[] = [];

    try {
      // Grab the 5 most recent messages
      const mailbox = client.mailbox;
      const total = typeof mailbox === "object" ? mailbox.exists : 0;
      const start = Math.max(1, total - 4);

      for await (const msg of client.fetch(`${start}:${total}`, { envelope: true })) {
        results.push({
          subject: msg.envelope?.subject || "(no subject)",
          from: msg.envelope?.from?.[0]?.address || "(unknown)",
          date: msg.envelope?.date?.toString() || "(no date)",
        });
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return NextResponse.json({ success: true, count: results.length, messages: results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
