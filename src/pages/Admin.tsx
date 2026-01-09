import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../supabase";
import type { EventRow, OrderRow, OrderCondition, PaymentMethod } from "../types";
import { computeTotals, round2 } from "../calc";
import {
  adminLogin,
  adminGetEvents,
  adminCreateEvent,
  adminUpdateEvent,
  adminSetActiveEvent,
  adminSetEventStatus,
  adminListOrders,
  adminUpdateOrder,
  adminVoidOrder,
  adminTogglePaid,
  adminUploadLetter,
  clearToken,
  getToken,
} from "../apiAdmin";

function money(n: number) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Admin() {
  const [token, setTok] = useState<string | null>(getToken());
  const [loginForm, setLoginForm] = useState({ username: "admin", password: "" });

  // Form de creación de evento
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [newEvent, setNewEvent] = useState<{ restaurant: string; event_date: string; order_deadline: string }>(
    { restaurant: "", event_date: today, order_deadline: "" }
  );

  const [events, setEvents] = useState<EventRow[]>([]);
  const [active, setActive] = useState<EventRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [newLetter, setNewLetter] = useState<File | null>(null);

  const [editOrder, setEditOrder] = useState<OrderRow | null>(null);

  const sharedTotal = useMemo(() => {
    if (!active) return 0;
    return round2((active.shared_tip ?? 0) + (active.shared_cake ?? 0) + (active.shared_other ?? 0));
  }, [active]);

  const computed = useMemo(() => {
    if (!active) return null;
    return computeTotals(orders, sharedTotal);
  }, [orders, sharedTotal, active]);

  async function refreshActivePublic() {
    // get active/closed event quickly (public read)
    const { data } = await supabase
      .from("events")
      .select("*")
      .in("status", ["ACTIVE", "CLOSED"])
      .order("updated_at", { ascending: false })
      .limit(1);
    setActive((data as any)?.[0] ?? null);
  }

  async function refreshAll() {
    if (!token) return;
    setLoading(true);
    setMsg(null);
    try {
      const ev = await adminGetEvents();
      setEvents(ev.events);
      const act = ev.events.find(e => e.status === "ACTIVE") ?? null;
      setActive(act);

      if (act) {
        const od = await adminListOrders(act.id);
        setOrders(od.orders.filter(o => !o.is_void));
      } else {
        setOrders([]);
      }
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshActivePublic();
  }, []);

  useEffect(() => {
    if (token) void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await adminLogin(loginForm.username, loginForm.password);
      const t = getToken();
      setTok(t);
      setMsg({ type: "ok", text: "Sesión iniciada ✅" });
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Credenciales incorrectas" });
    }
  }

  function logout() {
    clearToken();
    setTok(null);
    setEvents([]);
    setOrders([]);
    setActive(null);
    setNewEvent({ restaurant: "", event_date: today, order_deadline: "" });
  }

  async function createEvent() {
    setMsg(null);
    try {
      const payload = {
        restaurant: newEvent.restaurant.trim(),
        event_date: newEvent.event_date,
        order_deadline: newEvent.order_deadline ? new Date(newEvent.order_deadline).toISOString() : null,
      };
      if (!payload.restaurant) {
        setMsg({ type: "err", text: "Ingresa el nombre del restaurante." });
        return;
      }
      const created = await adminCreateEvent(payload);
      if (newLetter) {
        await adminUploadLetter(created.event.id, newLetter);
        setNewLetter(null);
      }
      setNewEvent({ restaurant: "", event_date: payload.event_date, order_deadline: "" });
      await refreshAll();
      setMsg({ type: "ok", text: "Evento creado ✅" });
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Error" });
    }
  }

  async function setActiveEvent(id: string) {
    setMsg(null);
    try {
      await adminSetActiveEvent(id);
      await refreshAll();
      setMsg({ type: "ok", text: "Evento activado ✅" });
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Error" });
    }
  }

  async function setStatus(status: EventRow["status"]) {
    if (!active) return;
    setMsg(null);
    try {
      await adminSetEventStatus(active.id, status);
      await refreshAll();
      setMsg({ type: "ok", text: `Estado cambiado a ${status} ✅` });
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Error" });
    }
  }

  async function saveShared() {
    if (!active) return;
    setMsg(null);
    try {
      await adminUpdateEvent(active.id, {
        shared_tip: active.shared_tip,
        shared_cake: active.shared_cake,
        shared_other: active.shared_other,
      } as any);
      await refreshAll();
      setMsg({ type: "ok", text: "Gastos compartidos guardados ✅" });
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Error" });
    }
  }

  async function togglePaid(orderId: string, paid: boolean) {
    setMsg(null);
    try {
      await adminTogglePaid(orderId, paid);
      await refreshAll();
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Error" });
    }
  }

  async function voidOrder(orderId: string) {
    const reason = prompt("Motivo de anulación (opcional):") ?? "";
    setMsg(null);
    try {
      await adminVoidOrder(orderId, reason || undefined);
      await refreshAll();
      setMsg({ type: "ok", text: "Pedido anulado ✅" });
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Error" });
    }
  }

  async function saveOrderEdit() {
    if (!editOrder) return;
    setMsg(null);
    try {
      await adminUpdateOrder(editOrder.id, {
        full_name: editOrder.full_name,
        phone: editOrder.phone,
        food_desc: editOrder.food_desc,
        food_amount: editOrder.food_amount,
        drink_desc: editOrder.drink_desc,
        drink_amount: editOrder.drink_amount,
        pay_method: editOrder.pay_method,
        notes: editOrder.notes,
        condition: editOrder.condition,
      } as any);
      setEditOrder(null);
      await refreshAll();
      setMsg({ type: "ok", text: "Pedido actualizado ✅" });
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "Error" });
    }
  }

  const canShow = token != null;


  function exportExcel() {
    if (!active || !computed) return;

    const rows = computed.computed.map((o) => ({
      Nombre: o.full_name,
      Celular: o.phone,
      Condición: o.condition === "NA" ? "N.A" : o.condition === "CUMPLEANERO" ? "Cumpleañero" : "Practicante",
      Pedido: o.food_desc,
      "Monto plato": o.food_amount ?? "",
      Bebida: o.drink_desc ?? "",
      "Monto bebida": o.drink_amount ?? "",
      "Cuota N.A": o.condition === "NA" ? computed.quota : 0,
      "Total final": o.finalTotal,
      "Medio pago": o.pay_method,
      Pagado: o.paid ? "SI" : "NO",
      Observación: o.notes ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");

    const safeRestaurant = (active.restaurant || "evento").replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "_");
    const filename = `OllitaComun_${safeRestaurant}_${active.event_date}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <span className="badge">Admin</span>
            {active ? <span className="badge ok">{active.restaurant}</span> : <span className="badge warn">Sin evento activo</span>}
          </div>
          {canShow ? <button className="btn" onClick={logout}>Cerrar sesión</button> : null}
        </div>

        <div className="hr" />

        {msg ? <div className={msg.type === "ok" ? "success" : "error"} style={{ marginBottom: 12 }}>{msg.text}</div> : null}

        {!canShow ? (
          <form onSubmit={onLogin} className="grid two">
            <div>
              <label>Usuario</label>
              <input value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} />
            </div>
            <div>
              <label>Contraseña</label>
              <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
            </div>
            <div className="row" style={{ gridColumn: "1 / -1" }}>
              <button className="btn primary" type="submit">Ingresar</button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid two">
              <div className="card" style={{ padding: 14 }}>
                <h3 style={{ margin: 0 }}>Crear evento</h3>
                <div className="hr" />
                <div className="grid">
                  <div>
                    <label>Restaurante</label>
                    <input value={newEvent.restaurant} onChange={(e) => setNewEvent({ ...newEvent, restaurant: e.target.value })} placeholder="Ej: Tinajas" />
                  </div>
                  <div className="grid two">
                    <div>
                      <label>Fecha</label>
                      <input type="date" value={newEvent.event_date} onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })} />
                    </div>
                    <div>
                      <label>Límite de pedido (opcional)</label>
                      <input type="datetime-local" value={newEvent.order_deadline} onChange={(e) => setNewEvent({ ...newEvent, order_deadline: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label>Carta del restaurante (opcional)</label>
                    <input type="file" accept=".pdf,image/*" onChange={(e) => setNewLetter(e.target.files?.[0] ?? null)} />
                    <div className="small">Los usuarios podrán descargarla desde el formulario.</div>
                  </div>
                  <div className="row">
                    <button className="btn primary" type="button" onClick={createEvent}>Crear</button>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 14 }}>
                <h3 style={{ margin: 0 }}>Eventos</h3>
                <div className="hr" />
                {loading ? <div className="small">Cargando…</div> : (
                  <div className="tableWrap">
                    <table style={{ minWidth: 700 }}>
                      <thead>
                        <tr>
                          <th>Restaurante</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map(ev => (
                          <tr key={ev.id}>
                            <td>{ev.restaurant}</td>
                            <td>{ev.event_date}</td>
                            <td><span className={`badge ${ev.status === "ACTIVE" ? "ok" : ev.status === "CLOSED" ? "warn" : ""}`}>{ev.status}</span></td>
                            <td>
                              {ev.status !== "ACTIVE" ? (
                                <button className="btn" onClick={() => setActiveEvent(ev.id)}>Activar</button>
                              ) : (
                                <span className="small">Activo</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {events.length === 0 ? <tr><td colSpan={4} className="small">No hay eventos aún.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {active ? (
              <>
                <div className="card">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div className="row">
                      <span className="badge ok">Activo</span>
                      <span className="badge">{active.restaurant}</span>
                      <span className="badge">Fecha: {active.event_date}</span>
                    </div>
                    <div className="row">
                      <button className="btn" onClick={() => setStatus("CLOSED")}>Cerrar pedidos</button>
                      <button className="btn danger" onClick={() => setStatus("FINISHED")}>Finalizar</button>
                    </div>
                  </div>

                  <div className="hr" />

                  <h3 style={{ margin: "0 0 8px 0" }}>Gastos compartidos</h3>
                  <div className="grid two">
                    <div>
                      <label>Propina (S/)</label>
                      <input type="number" step="0.01" value={active.shared_tip}
                        onChange={(e) => setActive({ ...active, shared_tip: Number(e.target.value) } as any)} />
                    </div>
                    <div>
                      <label>Torta (S/)</label>
                      <input type="number" step="0.01" value={active.shared_cake}
                        onChange={(e) => setActive({ ...active, shared_cake: Number(e.target.value) } as any)} />
                    </div>
                    <div>
                      <label>Otros (S/)</label>
                      <input type="number" step="0.01" value={active.shared_other}
                        onChange={(e) => setActive({ ...active, shared_other: Number(e.target.value) } as any)} />
                    </div>
                    <div className="row" style={{ alignItems: "flex-end" }}>
                      <button className="btn primary" onClick={saveShared}>Guardar</button>
                    </div>
                  </div>

                  {computed ? (
                    <>
                      <div className="hr" />
                      <div className="kpi">
                        <div className="tile"><div className="val">{computed.counts.pedidos}</div><div className="lab">Pedidos</div></div>
                        <div className="tile"><div className="val">{computed.counts.pagados}</div><div className="lab">Pagados</div></div>
                        <div className="tile"><div className="val">{computed.counts.pendientes}</div><div className="lab">Pendientes</div></div>
                        <div className="tile"><div className="val">S/ {money(computed.quota)}</div><div className="lab">Cuota N.A</div></div>
                        <div className="tile"><div className="val">S/ {money(computed.totalEvent)}</div><div className="lab">Total evento</div></div>
                      </div>
                      <div className="hr" />
                      <div className="row">
                        <span className="badge">Cumpleañeros total: S/ {money(computed.cumpleTotal)}</span>
                        <span className="badge">Compartido (propina+torta+otros): S/ {money(sharedTotal)}</span>
                        <span className="badge">A repartir: S/ {money(computed.toShare)}</span>
                        <span className="badge">Aportantes N.A: {computed.counts.na}</span>
                      </div>
                      <div className="hr" />
                      <div className="row">
                        <span className="badge ok">Pagado: S/ {money(computed.totalPaid)}</span>
                        <span className="badge bad">Pendiente: S/ {money(computed.totalPending)}</span>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="card">
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0 }}>Pedidos</h3>
                    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                      <button className="btn btnGhost" onClick={exportExcel} disabled={!computed}>Exportar a Excel</button>
                      <button className="btn" onClick={refreshAll}>Actualizar</button>
                    </div>
                  </div>
                  <div className="hr" />

                  {!computed ? <div className="small">Aún no hay pedidos.</div> : (
                    <div className="tableWrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Nombre</th>
                            <th>Celular</th>
                            <th>Condición</th>
                            <th>Plato</th>
                            <th>Bebida</th>
                            <th>Total</th>
                            <th>Pago</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {computed.computed.map(o => (
                            <tr key={o.id}>
                              <td>{o.full_name}</td>
                              <td>{o.phone}</td>
                              <td>{o.condition}</td>
                              <td>{o.food_desc} (S/ {money(o.food_amount ?? 0)})</td>
                              <td>{o.drink_desc ?? "-"} (S/ {money(o.drink_amount ?? 0)})</td>
                              <td><b>S/ {money(o.finalTotal)}</b></td>
                              <td>
                                <button className={`btn ${o.paid ? "primary" : ""}`} onClick={() => togglePaid(o.id, !o.paid)}>
                                  {o.paid ? "Pagado" : "Pendiente"}
                                </button>
                              </td>
                              <td className="row" style={{ gap: 8 }}>
                                <button className="btn" onClick={() => setEditOrder(o)}>Editar</button>
                                <button className="btn danger" onClick={() => voidOrder(o.id)}>Anular</button>
                              </td>
                            </tr>
                          ))}
                          {computed.computed.length === 0 ? <tr><td colSpan={8} className="small">Aún no hay pedidos.</td></tr> : null}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="small">Activa un evento para administrar pedidos.</div>
            )}
          </>
        )}
      </div>

      {editOrder ? (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Editar pedido</h3>
            <button className="btn" onClick={() => setEditOrder(null)}>Cerrar</button>
          </div>
          <div className="hr" />
          <div className="grid two">
            <div>
              <label>Nombre</label>
              <input value={editOrder.full_name} onChange={(e) => setEditOrder({ ...editOrder, full_name: e.target.value })} />
            </div>
            <div>
              <label>Celular</label>
              <input value={editOrder.phone} onChange={(e) => setEditOrder({ ...editOrder, phone: e.target.value })} />
            </div>
            <div>
              <label>Plato</label>
              <input value={editOrder.food_desc} onChange={(e) => setEditOrder({ ...editOrder, food_desc: e.target.value })} />
            </div>
            <div>
              <label>Monto plato</label>
              <input type="number" step="0.01" value={editOrder.food_amount ?? 0} onChange={(e) => setEditOrder({ ...editOrder, food_amount: Number(e.target.value) })} />
            </div>
            <div>
              <label>Bebida</label>
              <input value={editOrder.drink_desc ?? ""} onChange={(e) => setEditOrder({ ...editOrder, drink_desc: e.target.value || null })} />
            </div>
            <div>
              <label>Monto bebida</label>
              <input type="number" step="0.01" value={editOrder.drink_amount ?? 0} onChange={(e) => setEditOrder({ ...editOrder, drink_amount: Number(e.target.value) })} />
            </div>

            <div>
              <label>Medio de pago</label>
              <select value={editOrder.pay_method} onChange={(e) => setEditOrder({ ...editOrder, pay_method: e.target.value as PaymentMethod })}>
                <option value="YAPE">Yape</option>
                <option value="PLIN">Plin</option>
                <option value="EFECTIVO">Efectivo</option>
              </select>
            </div>

            <div>
              <label>Condición</label>
              <select value={editOrder.condition} onChange={(e) => setEditOrder({ ...editOrder, condition: e.target.value as OrderCondition })}>
                <option value="NA">N.A</option>
                <option value="CUMPLEANERO">Cumpleañero</option>
                <option value="PRACTICANTE">Practicante</option>
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label>Observación</label>
              <input value={editOrder.notes ?? ""} onChange={(e) => setEditOrder({ ...editOrder, notes: e.target.value || null })} />
            </div>

            <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "space-between" }}>
              <button className="btn primary" onClick={saveOrderEdit}>Guardar cambios</button>
              <button className="btn" onClick={() => setEditOrder(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}