import type { Handler } from "@netlify/functions";
import { json, signToken } from "./_utils";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const { username, password } = JSON.parse(event.body || "{}");

  const u = process.env.ADMIN_USER || "admin";
  const p = process.env.ADMIN_PASS || "admin123";

  if (username !== u || password !== p) {
    return json(401, { error: "Credenciales incorrectas" });
  }

  const token = signToken({ role: "admin", u: username });
  return json(200, { token });
};
