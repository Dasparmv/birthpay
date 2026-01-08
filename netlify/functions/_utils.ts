import jwt from "jsonwebtoken";

export function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

export function requireAuth(authHeader?: string) {
  const secret = process.env.ADMIN_JWT_SECRET || "";
  if (!secret) throw new Error("Missing ADMIN_JWT_SECRET");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing token");
  const token = authHeader.slice("Bearer ".length);
  const decoded = jwt.verify(token, secret);
  return decoded;
}

export function signToken(payload: any) {
  const secret = process.env.ADMIN_JWT_SECRET || "";
  if (!secret) throw new Error("Missing ADMIN_JWT_SECRET");
  return jwt.sign(payload, secret, { expiresIn: "12h" });
}
