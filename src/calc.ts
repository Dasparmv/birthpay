import type { OrderRow, ComputedOrder } from "./types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeTotals(orders: OrderRow[], sharedTotal: number) {
  const active = orders.filter(o => !o.is_void);
  const na = active.filter(o => o.condition === "NA");
  const cumple = active.filter(o => o.condition === "CUMPLEANERO");

  const cumpleTotal = cumple.reduce((s, o) => s + (o.food_amount ?? 0) + (o.drink_amount ?? 0), 0);
  const toShare = round2(sharedTotal + cumpleTotal);

  const contributors = na.length;
  const quota = contributors > 0 ? round2(toShare / contributors) : 0;

  const computed: ComputedOrder[] = active.map(o => {
    const ownTotal = round2((o.food_amount ?? 0) + (o.drink_amount ?? 0));
    let finalTotal = 0;
    if (o.condition === "CUMPLEANERO") finalTotal = 0;
    else if (o.condition === "PRACTICANTE") finalTotal = ownTotal;
    else finalTotal = round2(ownTotal + quota);

    return { ...o, ownTotal, quota: o.condition === "NA" ? quota : 0, finalTotal };
  });

  const totalEvent = round2(computed.reduce((s, o) => s + o.finalTotal, 0));
  const totalPaid = round2(computed.filter(o => o.paid).reduce((s, o) => s + o.finalTotal, 0));
  const totalPending = round2(totalEvent - totalPaid);

  const counts = {
    pedidos: computed.length,
    na: na.length,
    cumple: cumple.length,
    practicantes: active.filter(o => o.condition === "PRACTICANTE").length,
    pagados: computed.filter(o => o.paid).length,
    pendientes: computed.filter(o => !o.paid).length,
  };

  return { computed, quota, toShare, cumpleTotal: round2(cumpleTotal), totalEvent, totalPaid, totalPending, counts };
}
