import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { json, requireAuth } from "./_utils";

function supa() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    requireAuth(event.headers.authorization);
    const sb = supa();

    if (event.httpMethod === "GET") {
      const eventId = event.queryStringParameters?.eventId;
      if (!eventId) return json(400, { error: "eventId requerido" });

      const { data, error } = await sb
        .from("orders")
        .select("*")
        .eq("event_id", eventId)
        .eq("is_void", false)
        .order("created_at", { ascending: true });

      if (error) return json(400, { error: error.message });
      return json(200, { orders: data });
    }

    if (event.httpMethod === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const { id, patch } = body;
      const { data, error } = await sb.from("orders").update(patch).eq("id", id).select("*").single();
      if (error) return json(400, { error: error.message });
      return json(200, { order: data });
    }

    if (event.httpMethod === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const { id, action, reason, paid } = body;

      if (action === "void") {
        const { error } = await sb.from("orders").update({ is_void: true, void_reason: reason ?? null }).eq("id", id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }

      if (action === "paid") {
        const patch = paid ? { paid: true, paid_at: new Date().toISOString() } : { paid: false, paid_at: null };
        const { error } = await sb.from("orders").update(patch).eq("id", id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }

      return json(400, { error: "Acción inválida" });
    }

    return json(405, { error: "Method not allowed" });
  } catch (e: any) {
    const msg = e?.message || "Error";
    if (msg.includes("Missing SUPABASE_URL") || msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return json(500, { error: msg });
    }
    if (msg.includes("ADMIN_JWT_SECRET")) {
      return json(500, { error: msg });
    }
    return json(401, { error: msg || "Unauthorized" });
  }
};
