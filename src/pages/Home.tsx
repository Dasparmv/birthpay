import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

  async function load() {
    setLoading(true);
    const { data: ev } = await supabase
      .from("events")
      .select("*")
      .in("status", ["ACTIVE", "CLOSED"])
      .order("updated_at", { ascending: false })
      .limit(1);

    const active = ev?.[0] ?? null;
    setEvent(active);

    if (active) {
      const { data: o } = await supabase
        .from("orders")
        .select("*")
        .eq("event_id", active.id)
        .order("created_at", { ascending: true });
      setOrders((o as any) ?? []);
    } else {
      setOrders([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const sharedTotal = useMemo(() => {
    if (!event) return 0;
    return round2((event.shared_tip ?? 0) + (event.shared_cake ?? 0) + (event.shared_other ?? 0));
  }, [event]);
  const computed = useMemo(() => {
    if (!event) return null;
    return computeTotals(orders, sharedTotal);
  }, [event, orders]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!event || event.status !== "ACTIVE") {
      setMsg({ type: "err", text: "No hay evento activo para registrar pedidos." });
      return;
    }
    if (!form.full_name.trim() || !form.phone.trim() || !form.food_desc.trim()) {
      setMsg({ type: "err", text: "Completa nombre, celular y pedido." });
      return;
    }

    const food_amount = form.food_amount.trim() === "" ? null : Number(form.food_amount);
    const drink_amount = form.drink_amount.trim() === "" ? null : Number(form.drink_amount);

    const payload = {
      event_id: event.id,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      food_desc: form.food_desc.trim(),
      food_amount: Number.isFinite(food_amount as any) ? food_amount : null,
      drink_desc: form.drink_desc.trim() || null,
      drink_amount: Number.isFinite(drink_amount as any) ? drink_amount : null,
      pay_method: form.pay_method,
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase.from("orders").insert(payload as any);

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

    void load();
  }

  return (
    <div>
      <div className="heroCard">
        <img className="heroLogo" src={ollitaLogo} alt="OllitaComun" />
        <div>
          <h1 style={{ margin: "0 0 6px 0" }}>OllitaComun</h1>
          <div className="small">Pide, reparte y controla pagos sin caos.</div>
          {event ? (
            <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
              <span className={"badge " + (event.status === "ACTIVE" ? "badgeGreen" : "badgeOrange")}>
                {event.status === "ACTIVE" ? "Evento activo" : "Pedidos cerrados"}
              </span>
              {computed ? <span className="badge">Cuota N.A actual: S/ {money(computed.quota)}</span> : null}
              <Link className="btn" to="/lista">Ver lista</Link>
            </div>
          ) : (
            <div className="row" style={{ marginTop: 10 }}>
              <span className="badge badgeGray">Sin evento activo</span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        {loading ? <div className="small">Cargando…</div> : null}

        {!event ? (
          <div className="small">Aún no hay evento activo. Vuelve más tarde.</div>
        ) : (
          <>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ margin: 0 }}>{event.restaurant}</h2>
                <div className="small">
                  Fecha: <b>{event.event_date}</b>
                  {event.order_deadline ? (
                    <> — Límite: <b>{new Date(event.order_deadline).toLocaleString("es-PE")}</b></>
                  ) : null}
                </div>
                {event.letter_url ? (
                  <div style={{ marginTop: 10 }}>
                    <a className="btn btnGhost" href={event.letter_url} target="_blank" rel="noreferrer">
                      Descargar carta / pedido
                    </a>
                  </div>
                ) : null}
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span className="badge">Compartido: S/ {money(sharedTotal)}</span>
                {computed ? <span className="badge">Cumpleañeros: S/ {money(computed.cumpleTotal)}</span> : null}
              </div>
            </div>

            {msg ? <div className={msg.type === "ok" ? "alertOk" : "alertErr"}>{msg.text}</div> : null}

            {event.status === "ACTIVE" ? (
              <form onSubmit={submit} className="form">
                <div className="grid2">
                  <div>
                    <label>Nombre</label>
                    <input value={form.full_name} onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))} />
                  </div>
                  <div>
                    <label>Celular</label>
                    <input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
                  </div>
                </div>

                <div className="grid2">
                  <div>
                    <label>Pedido</label>
                    <input value={form.food_desc} onChange={(e) => setForm((s) => ({ ...s, food_desc: e.target.value }))} />
                  </div>
                  <div>
                    <label>Monto (S/)</label>
                    <input
                      inputMode="decimal"
                      placeholder="Ej: 31.90"
                      value={form.food_amount}
                      onChange={(e) => setForm((s) => ({ ...s, food_amount: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid2">
                  <div>
                    <label>Bebida (opcional)</label>
                    <input value={form.drink_desc} onChange={(e) => setForm((s) => ({ ...s, drink_desc: e.target.value }))} />
                  </div>
                  <div>
                    <label>Monto bebida (S/)</label>
                    <input
                      inputMode="decimal"
                      placeholder="Ej: 6.90"
                      value={form.drink_amount}
                      onChange={(e) => setForm((s) => ({ ...s, drink_amount: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid2">
                  <div>
                    <label>Medio de pago</label>
                    <select value={form.pay_method} onChange={(e) => setForm((s) => ({ ...s, pay_method: e.target.value as PaymentMethod }))}>
                      <option value="YAPE">Yape</option>
                      <option value="PLIN">Plin</option>
                      <option value="EFECTIVO">Efectivo</option>
                    </select>
                  </div>
                  <div>
                    <label>Observación (opcional)</label>
                    <input value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
                  </div>
                </div>

                <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn" type="submit">Registrar pedido</button>
                  <Link className="btn btnGhost" to="/lista">Ver lista</Link>
                </div>

                {computed ? (
                  <>
                    <div className="hr" />
                    <div className="small">
                      Cuota (solo N.A) = (propina+torta+otros + total cumpleañeros) / #N.A
                      {computed.counts.na > 0 ? (
                        <> → <b>S/ {money(computed.quota)}</b> (N.A: {computed.counts.na})</>
                      ) : (
                        <> → <b>S/ 0.00</b> (aún no hay N.A)</>
                      )}
                    </div>
                  </>
                ) : null}
              </form>
            ) : (
              <div className="small">Este evento está cerrado. Solo lectura.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}