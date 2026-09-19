import webpush from "web-push";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    "mailto:niranjana@brownieheaven.example",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

export type PushSubscriptionRow = {
  staff_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

// Sends to one subscription. Returns "ok", or "gone" if the subscription is
// dead (uninstalled app, revoked permission etc.) so the caller can clean it
// up — a stale subscription just fails silently otherwise.
export async function sendPushToSubscription(
  sub: PushSubscriptionRow,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<"ok" | "gone" | "error"> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return "ok";
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.statusCode === 410) return "gone";
    console.error("Push send failed:", err?.message || err);
    return "error";
  }
}
