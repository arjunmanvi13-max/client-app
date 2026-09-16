import { SLOT_RATES, type TimeSlot } from "./types";

export function inclusiveDays(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 1;
  const a = new Date(`${startIso}T12:00:00`);
  const b = new Date(`${endIso}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 1;
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export function listGroundRate(slot: TimeSlot, days: number, customRate: number): number {
  if (slot === "custom") return Math.max(customRate, 0);
  const per = SLOT_RATES[slot];
  return per * Math.max(days, 1);
}

export function computeLocalPricing(input: {
  slot: TimeSlot;
  startIso: string;
  endIso: string;
  groundRate: number;
  people: number;
  foodOn: boolean;
  foodRate: number;
  foodPeople: number;
  transportOn: boolean;
  transportRate: number;
  transportPeople: number;
  umpireOn: boolean;
  umpireRate: number;
  umpirePeople: number;
  ballsOn: boolean;
  ballQty: number;
  ballRate: number;
}) {
  const days = inclusiveDays(input.startIso, input.endIso);
  const list = listGroundRate(input.slot, days, input.groundRate);
  const ground = Math.max(Number(input.groundRate) || 0, 0);
  const foodPeople = Math.max(Number(input.foodPeople) || 0, 0);
  const transportPeople = Math.max(Number(input.transportPeople) || 0, 0);
  const umpirePeople = Math.max(Number(input.umpirePeople) || 0, 0);
  const food = input.foodOn ? Math.max(input.foodRate, 0) * foodPeople : 0;
  const transport = input.transportOn ? Math.max(input.transportRate, 0) * transportPeople : 0;
  const umpire = input.umpireOn ? Math.max(input.umpireRate, 0) * days * umpirePeople : 0;
  const balls = input.ballsOn ? Math.max(input.ballQty, 0) * Math.max(input.ballRate, 0) : 0;
  const addOnTotal = food + transport + umpire + balls;
  const discountAmount = Math.max(list - ground, 0);
  return {
    days,
    listGroundRate: list,
    groundRate: ground,
    foodCost: food,
    transportCost: transport,
    umpireCost: umpire,
    ballCost: balls,
    addOnTotal,
    totalRevenue: ground + addOnTotal,
    discountAmount,
    discountRequested: discountAmount > 0.009 && input.slot !== "custom",
  };
}

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return monthKey(dt);
}

export function daysInMonthGrid(month: string): { iso: string; inMonth: boolean }[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startWeekday = first.getDay();
  const dim = new Date(y, m, 0).getDate();
  const cells: { iso: string; inMonth: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(y, m - 1, i - startWeekday + 1);
    cells.push({
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      inMonth: false,
    });
  }
  for (let day = 1; day <= dim; day++) {
    cells.push({
      iso: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      inMonth: true,
    });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const d = new Date(`${last.iso}T12:00:00`);
    d.setDate(d.getDate() + 1);
    cells.push({
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      inMonth: false,
    });
  }
  return cells;
}

export function bookingOverlapsDay(start: string, end: string, iso: string): boolean {
  return iso >= start && iso <= end;
}
