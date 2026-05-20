import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, handleCors } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // Authenticate the request
    const token = req.headers.get("authorization")?.replace("Bearer ", "")
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })

    const body = await req.json()
    const { endpoint, keys, unsubscribe } = body

    if (!endpoint) return new Response(JSON.stringify({ error: "endpoint required" }), { status: 400, headers: corsHeaders })

    if (unsubscribe) {
      await supabase.from("push_subscriptions").delete()
        .eq("user_id", user.id)
        .eq("endpoint", endpoint)
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    // Upsert subscription
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: "user_id,endpoint" })

    if (error) throw error

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
