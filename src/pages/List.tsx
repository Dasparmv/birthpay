import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import type { EventRow, OrderRow } from "../types";
import { computeTotals, round2 } from "../calc";

function money(n: number) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function List() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

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
    const t = setInterval(() => void load(), 12000);
    return () => clearInterval(t);
  }, []);

  const sharedTotal = useMemo(() => {
    if (!event) return 0;
    return round2((event.shared_tip ?? 0) + (event.shared_cake ?? 0) + (event.shared_other ?? 0));
  }, [event]);

  const computed = useMemo(() => {
    if (!event) return null;
    return computeTotals(orders, sharedTotal);
  }, [event, orders]);

  if (loading) {
    return (
      <div className="card">
        <div className="small">Cargando…</div>
      </div>
    );
  }

  if (!event || !computed) {
    return (
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Lista del evento</h2>
          <Link className="btn btnGhost" to="/">Volver</Link>
        </div>
        <div className="small">No hay evento activo.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0 }}>Lista — {event.restaurant}</h2>
          <div className="small">
            Cuota N.A: <b>S/ {money(computed.quota)}</b> (N.A: {computed.counts.na}) — Cumpleañeros: <b>S/ {money(computed.cumpleTotal)}</b>
          </div>
        </div>
        <Link className="btn btnGhost" to="/">Volver</Link>
      </div>

      <div className="tableWrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>Condición</th>
              <th>Pedido</th>
              <th>Total (S/)</th>
              <th>Pago</th>
            </tr>
          </thead>
          <tbody>
            {computed.computed.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.full_name}</td>
                <td>
                  <span className="badge badgeGray">
                    {r.condition === "NA" ? "N.A" : r.condition === "CUMPLEANERO" ? "Cumpleañero" : "Practicante"}
                  </span>
                </td>
                <td className="small">
                  <div><b>{r.food_desc}</b> {r.food_amount != null ? `— S/ ${money(r.food_amount)}` : ""}</div>
                  {r.drink_desc ? <div>{r.drink_desc} {r.drink_amount != null ? `— S/ ${money(r.drink_amount)}` : ""}</div> : null}
                  {r.condition === "NA" ? <div className="small">+ cuota: S/ {money(computed.quota)}</div> : null}
                </td>
                <td><b>{money(r.finalTotal)}</b></td>
                <td>
                  <span className={"badge " + (r.paid ? "badgeGreen" : "badgeOrange")}>{r.paid ? "Pagado" : "Pendiente"}</span>
                </td>
              </tr>
            ))}
            {computed.computed.length === 0 ? (
              <tr>
                <td colSpan={6} className="small">Aún no hay pedidos.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}