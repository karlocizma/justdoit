/**
 * push-send — sends a Web Push notification to all subscriptions for a user.
 *
 * Called internally by reminder-webhook or other edge functions.
 * Requires VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets.
 *
 * Body: { user_id: string, title: string, body: string, url?: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, handleCors } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { user_id, title, body, url } = await req.json()
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title required" }), { status: 400, headers: corsHeaders })
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@justdoit.app"

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id)

    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders })
    }

    const payload = JSON.stringify({ title, body, url: url ?? "/" })
    let sent = 0
    const stale: string[] = []

    for (const sub of subscriptions) {
      try {
        const res = await sendWebPush({
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject,
        })
        if (res.status === 410 || res.status === 404) {
          // Subscription expired — mark for removal
          stale.push(sub.endpoint)
        } else {
          sent++
        }
      } catch {
        // Ignore individual send failures
      }
    }

    // Clean up stale subscriptions
    if (stale.length > 0) {
      await supabase.from("push_subscriptions")
        .delete()
        .eq("user_id", user_id)
        .in("endpoint", stale)
    }

    return new Response(JSON.stringify({ sent }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})

// Minimal VAPID-signed Web Push implementation using Deno WebCrypto
async function sendWebPush({
  endpoint, p256dh, auth, payload,
  vapidPublicKey, vapidPrivateKey, vapidSubject,
}: {
  endpoint: string; p256dh: string; auth: string; payload: string
  vapidPublicKey: string; vapidPrivateKey: string; vapidSubject: string
}) {
  const { default: webpush } = await import("npm:web-push@3")
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  return await webpush.sendNotification(
    { endpoint, keys: { p256dh, auth } },
    payload,
    { TTL: 86400 }
  )
}
