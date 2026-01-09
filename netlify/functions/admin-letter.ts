import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import Busboy from "busboy";
import { json, requireAuth } from "./_utils";

function supa() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    requireAuth(event.headers.authorization);

    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
    const contentType = event.headers["content-type"] || event.headers["Content-Type"];
    if (!contentType?.includes("multipart/form-data")) {
      return json(400, { error: "Expected multipart/form-data" });
    }

    const bb = Busboy({ headers: { "content-type": contentType } });

    let eventId = "";
    let fileBuffer: Buffer | null = null;
    let fileName = "carta";
    let fileMime = "application/octet-stream";

    const body = event.isBase64Encoded ? Buffer.from(event.body || "", "base64") : Buffer.from(event.body || "", "utf8");

    const done = new Promise<void>((resolve, reject) => {
      bb.on("field", (name, val) => {
        if (name === "event_id") eventId = String(val || "");
      });

      bb.on("file", (_name, file, info) => {
        fileName = info.filename || "carta";
        fileMime = info.mimeType || "application/octet-stream";
        const chunks: Buffer[] = [];
        file.on("data", (d) => chunks.push(d));
        file.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      bb.on("error", reject);
      bb.on("finish", () => resolve());
    });

    bb.end(body);
    await done;

    if (!eventId) return json(400, { error: "Missing event_id" });
    if (!fileBuffer || fileBuffer.length === 0) return json(400, { error: "Missing file" });

    const client = supa();

    const ext = (fileName.split(".").pop() || "pdf").toLowerCase();
    const path = `${eventId}/carta.${ext}`;

    const up = await client.storage.from("event-letters").upload(path, fileBuffer, {
      contentType: fileMime,
      upsert: true,
      cacheControl: "3600",
    });

    if (up.error) return json(500, { error: up.error.message });

    const pub = client.storage.from("event-letters").getPublicUrl(path);
    const letter_url = pub.data.publicUrl;

    const upd = await client.from("events").update({ letter_url }).eq("id", eventId).select("*").single();
    if (upd.error) return json(500, { error: upd.error.message });

    return json(200, { ok: true, letter_url });
  } catch (e: any) {
    return json(500, { error: e.message || "Server error" });
  }
};
