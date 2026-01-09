import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import type { EventRow, OrderRow, PaymentMethod } from "../types";
import { computeTotals, round2 } from "../calc";
import ollitaLogo from "../assets/ollita-logo.jpg";

function money(n: number) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Home() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    food_desc: "",
    food_amount: "",
    drink_desc: "",
    drink_amount: "",
    pay_method: "YAPE" as PaymentMethod,
    notes: "",
  });

  const sharedTotal = useMemo(() => {
    if (!event) return 0;
    return round2((event.shared_tip ?? 0) + (event.shared_cake ?? 0) + (event.shared_other ?? 0));
  }, [event]);

  const computed = useMemo(() => {
    if (!event) return null;
    return computeTotals(orders, sharedTotal);
  }, [orders, sharedTotal, event]);

  async function load() {
    setLoading(true);
    setMsg(null);
    const { data: ev, error } = await supabase
      .from("events")
      .select("*")
      .in("status", ["ACTIVE", "CLOSED"])
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      setMsg({ type: "err", text: error.message });
      setLoading(false);
      return;
    }

    const current = ev?.[0] ?? null;
    setEvent(current);

    if (current) {
      const { data: od, error: e2 } = await supabase
        .from("orders")
        .select("*")
        .eq("event_id", current.id)
        .eq("is_void", false)
        .order("created_at", { ascending: true });

      if (e2) setMsg({ type: "err", text: e2.message });
      setOrders((od as any) ?? []);
    } else {
      setOrders([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
    // simple polling each 12s for list freshness
    const t = setInterval(() => {
      if (showList) void load();
    }, 12000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showList]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!event || event.status !== "ACTIVE") {
      setMsg({ type: "err", text: "No hay evento activo para registrar." });
      return;
    }
    if (!form.full_name.trim() || !form.phone.trim() || !form.food_desc.trim()) {
      setMsg({ type: "err", text: "Completa nombre, celular y pedido." });
      return;
    }

    const food_amount = form.food_amount.trim() === "" ? null : Number(form.food_amount);
    const drink_amount = form.drink_amount.trim() === "" ? null : Number(form.drink_amount);

    const { error } = await supabase.from("orders").insert({
      event_id: event.id,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      food_desc: form.food_desc.trim(),
      food_amount: food_amount,
      drink_desc: form.drink_desc.trim() || null,
      drink_amount: drink_amount,
      pay_method: form.pay_method,
      notes: form.notes.trim() || null,
      condition: "NA",
      is_void: false,
    });

    if (error) {
      setMsg({ type: "err", text: error.message });
      return;
    }

    setMsg({ type: "ok", text: "Pedido registrado ✅" });
    setForm({
      full_name: "",
      phone: "",
      food_desc: "",
      food_amount: "",
      drink_desc: "",
      drink_amount: "",
      pay_method: "YAPE",
      notes: "",
    });

    await load();
    setShowList(true);
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card heroCard">
        <img src={ollitaLogo} alt="OllitaComun" className="heroLogo" />
        <div>
          <h1 className="heroTitle">OllitaComun</h1>
          <p className="heroSubtitle">Organizador de almuerzos.</p>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="small">Cargando…</div>
        ) : !event ? (
          <>
            <div className="row">
              <span className="badge warn">Sin evento</span>
            </div>
            <h2 style={{ margin: "10px 0 6px 0" }}>Aún no hay evento activo</h2>
            <div className="small">Cuando el admin lo active, aquí aparecerá el formulario.</div>
          </>
        ) : (
          <>
            <div className="row">
              <span className={`badge ${event.status === "ACTIVE" ? "ok" : "warn"}`}>
                {event.status === "ACTIVE" ? "Evento activo" : "Evento cerrado"}
              </span>
              <span className="badge">{event.restaurant}</span>
              <span className="badge">Fecha: {event.event_date}</span>
              {event.order_deadline ? <span className="badge">Límite: {new Date(event.order_deadline).toLocaleString("es-PE")}</span> : null}
            </div>

            <div className="hr" />

            {msg ? (
              <div className={msg.type === "ok" ? "success" : "error"} style={{ marginBottom: 12 }}>
                {msg.text}
              </div>
            ) : null}

            {event.status === "ACTIVE" ? (
              <form onSubmit={submit} className="grid two">
                <div>
                  <label>Nombre completo</label>
                  <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ej: Daniel Solis" />
                </div>
                <div>
                  <label>Celular</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Ej: 999999999" />
                </div>
                <div>
                  <label>Pedido (plato)</label>
                  <input value={form.food_desc} onChange={(e) => setForm({ ...form, food_desc: e.target.value })} placeholder="Ej: Cuarto Tinajas (parte pierna)" />
                </div>
                <div>
                  <label>Monto plato (S/)</label>
                  <input type="number" step="0.01" value={form.food_amount} onChange={(e) => setForm({ ...form, food_amount: e.target.value })} placeholder="Ej: 31.90" />
                </div>
                <div>
                  <label>Bebida (opcional)</label>
                  <input value={form.drink_desc} onChange={(e) => setForm({ ...form, drink_desc: e.target.value })} placeholder="Ej: Limonada" />
                </div>
                <div>
                  <label>Monto bebida (S/)</label>
                  <input type="number" step="0.01" value={form.drink_amount} onChange={(e) => setForm({ ...form, drink_amount: e.target.value })} placeholder="Ej: 6.90" />
                </div>
                <div>
                  <label>Medio de pago</label>
                  <select value={form.pay_method} onChange={(e) => setForm({ ...form, pay_method: e.target.value as PaymentMethod })}>
                    <option value="YAPE">Yape</option>
                    <option value="PLIN">Plin</option>
                    <option value="EFECTIVO">Efectivo</option>
                  </select>
                </div>
                <div>
                  <label>Observación</label>
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opcional" />
                </div>

                <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "space-between" }}>
                  <button className="btn primary" type="submit">Registrar pedido</button>
                  <button className="btn" type="button" onClick={() => setShowList(v => !v)}>
                    {showList ? "Ocultar lista" : "Ver lista del evento"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small">Este evento está cerrado. Solo lectura.</div>
                <button className="btn" type="button" onClick={() => setShowList(v => !v)}>
                  {showList ? "Ocultar lista" : "Ver lista del evento"}
                </button>
              </div>
            )}

            {computed ? (
              <>
                <div className="hr" />
                <div className="small">
                  Cuota actual (solo para N.A): <b>S/ {money(computed.quota)}</b> — compartido = propina+torta+otros + total cumpleañeros.
                </div>
              </>
            ) : null}
          </>
        )}
      </div>

      {event && showList && computed ? (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Lista del evento</h3>
            <span className="badge">Cuota N.A: S/ {money(computed.quota)}</span>
          </div>

          <div className="hr" />

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Condición</th>
                  <th>Pedido</th>
                  <th>Plato</th>
                  <th>Bebida</th>
                  <th>Cuota</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {computed.computed.map(o => (
                  <tr key={o.id}>
                    <td>{o.full_name}</td>
                    <td>{o.condition}</td>
                    <td>{o.food_desc}{o.drink_desc ? ` + ${o.drink_desc}` : ""}</td>
                    <td>S/ {money(o.food_amount ?? 0)}</td>
                    <td>S/ {money(o.drink_amount ?? 0)}</td>
                    <td>S/ {money(o.quota)}</td>
                    <td><b>S/ {money(o.finalTotal)}</b></td>
                    <td>
                      <span className={`badge ${o.paid ? "ok" : "bad"}`}>{o.paid ? "Pagado" : "Pendiente"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}><b>Total evento</b></td>
                  <td><b>S/ {money(computed.totalEvent)}</b></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
