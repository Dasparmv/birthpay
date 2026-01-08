import type { EventRow, OrderRow } from "./types";

const TOKEN_KEY = "birthpay_admin_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function call<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { ...opts, headers: { ...headers, ...(opts.headers as any) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data as T;
}

export async function adminLogin(username: string, password: string) {
  const data = await call<{ token: string }>("/.netlify/functions/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
}

export async function adminGetEvents() {
  return call<{ events: EventRow[] }>("/.netlify/functions/admin-events");
}

export async function adminCreateEvent(payload: {
  restaurant: string;
  event_date: string;
  order_deadline?: string | null;
}) {
  return call<{ event: EventRow }>("/.netlify/functions/admin-events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateEvent(id: string, patch: Partial<EventRow>) {
  return call<{ event: EventRow }>("/.netlify/functions/admin-events", {
    method: "PUT",
    body: JSON.stringify({ id, patch }),
  });
}

export async function adminSetActiveEvent(id: string) {
  return call<{ ok: true }>("/.netlify/functions/admin-events", {
    method: "PATCH",
    body: JSON.stringify({ id, action: "set_active" }),
  });
}

export async function adminSetEventStatus(id: string, status: EventRow["status"]) {
  return call<{ ok: true }>("/.netlify/functions/admin-events", {
    method: "PATCH",
    body: JSON.stringify({ id, action: "set_status", status }),
  });
}

export async function adminListOrders(eventId: string) {
  return call<{ orders: OrderRow[] }>(`/.netlify/functions/admin-orders?eventId=${encodeURIComponent(eventId)}`);
}

export async function adminUpdateOrder(id: string, patch: Partial<OrderRow>) {
  return call<{ order: OrderRow }>("/.netlify/functions/admin-orders", {
    method: "PUT",
    body: JSON.stringify({ id, patch }),
  });
}

export async function adminVoidOrder(id: string, reason?: string) {
  return call<{ ok: true }>("/.netlify/functions/admin-orders", {
    method: "PATCH",
    body: JSON.stringify({ id, action: "void", reason }),
  });
}

export async function adminTogglePaid(id: string, paid: boolean) {
  return call<{ ok: true }>("/.netlify/functions/admin-orders", {
    method: "PATCH",
    body: JSON.stringify({ id, action: "paid", paid }),
  });
}
