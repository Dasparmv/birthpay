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
      const { data, error } = await sb.from("events").select("*").order("created_at", { ascending: false });
      if (error) return json(400, { error: error.message });
      return json(200, { events: data });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { restaurant, event_date, order_deadline } = body;

      const { data, error } = await sb.from("events").insert({
        restaurant,
        event_date,
        order_deadline: order_deadline ?? null,
        status: "DRAFT",
        shared_tip: 0,
        shared_cake: 0,
        shared_other: 0,
      }).select("*").single();

      if (error) return json(400, { error: error.message });
      return json(200, { event: data });
    }

    if (event.httpMethod === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const { id, patch } = body;
      const { data, error } = await sb.from("events").update(patch).eq("id", id).select("*").single();
      if (error) return json(400, { error: error.message });
      return json(200, { event: data });
    }

    if (event.httpMethod === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const { id, action, status } = body;

      if (action === "set_active") {
        // Set all ACTIVE to CLOSED, then set this one to ACTIVE
        const { error: e1 } = await sb.from("events").update({ status: "CLOSED" }).eq("status", "ACTIVE");
        if (e1) return json(400, { error: e1.message });

        const { error: e2 } = await sb.from("events").update({ status: "ACTIVE" }).eq("id", id);
        if (e2) return json(400, { error: e2.message });

        return json(200, { ok: true });
      }

      if (action === "set_status") {
        const { error } = await sb.from("events").update({ status }).eq("id", id);
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
    // Errores de autenticación/token
    return json(401, { error: msg || "Unauthorized" });
  }
};
