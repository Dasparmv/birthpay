export type EventStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "FINISHED";
export type OrderCondition = "NA" | "CUMPLEANERO" | "PRACTICANTE";
export type PaymentMethod = "YAPE" | "PLIN" | "EFECTIVO";

export interface EventRow {
  id: string;
  restaurant: string;
  event_date: string; // ISO date
  order_deadline: string | null; // timestamptz
  status: EventStatus;
  shared_tip: number;
  shared_cake: number;
  shared_other: number;
  letter_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  event_id: string;
  full_name: string;
  phone: string;
  food_desc: string;
  food_amount: number | null;
  drink_desc: string | null;
  drink_amount: number | null;
  pay_method: PaymentMethod;
  notes: string | null;
  condition: OrderCondition;
  paid: boolean;
  paid_at: string | null;
  is_void: boolean;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComputedOrder extends OrderRow {
  ownTotal: number;
  quota: number;
  finalTotal: number;
}
