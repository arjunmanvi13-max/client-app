export const GROUND_SPORTS = ["Cricket", "Football"] as const;
export const TIME_SLOTS = ["half_day", "full_day", "custom"] as const;
export const EVENT_TYPES = ["Friendly Match", "Tournament", "Scouting", "Social Event"] as const;
export const BALL_TYPES = ["Tennis Ball", "Leather Ball"] as const;
export const BALL_COLORS = ["Red", "White"] as const;
export const BOOKING_STATUSES = ["Tentative", "Confirmed", "Cancelled"] as const;

export const SLOT_LABELS: Record<(typeof TIME_SLOTS)[number], string> = {
  half_day: "Half Day (4 hrs)",
  full_day: "Full Day (6 hrs)",
  custom: "Custom",
};

export const SLOT_RATES: Record<"half_day" | "full_day", number> = {
  half_day: 6000,
  full_day: 10000,
};

export type GroundSport = (typeof GROUND_SPORTS)[number];
export type TimeSlot = (typeof TIME_SLOTS)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type LastBookingSummary = {
  id?: string;
  sport?: string;
  startDate?: string;
  endDate?: string;
  timeSlot?: TimeSlot;
  eventType?: string;
  numberOfPeople?: number;
  status?: string;
  totalRevenue?: number;
  addOns?: string[];
  customerName?: string;
  organization?: string | null;
};

export type GroundCustomer = {
  id?: string | null;
  name: string;
  organization?: string;
  phone: string;
  address: string;
  kind?: string;
  lastBooking?: LastBookingSummary | null;
};

export type GroundBooking = {
  id: string;
  entity: "ALPHA";
  sport: GroundSport;
  customer: {
    name: string;
    organization?: string | null;
    phone: string;
    address: string;
    sourcePersonId?: string | null;
  };
  dates: {
    startDate: string;
    endDate: string;
    timeSlot: TimeSlot;
    customHours?: number | null;
  };
  eventDetails: { type: EventType; numberOfPeople: number };
  addOns: {
    food: { enabled: boolean; ratePerPlate: number; people?: number | null };
    transport: { enabled: boolean; ratePerPerson: number; people?: number | null };
    umpire: { enabled: boolean; ratePerDay: number; people?: number | null };
    balls: {
      enabled: boolean;
      type?: string | null;
      color?: string | null;
      quantity: number;
      ratePerBall: number;
    };
  };
  pricing: {
    groundRate: number;
    listGroundRate: number;
    addOnTotal: number;
    totalRevenue: number;
    foodCost?: number;
    transportCost?: number;
    umpireCost?: number;
    ballCost?: number;
    discountAmount?: number;
    discountPending?: boolean;
  };
  status: BookingStatus;
  isPast?: boolean;
  calendarTone?: "tentative" | "confirmed" | "past";
  discount_submitted?: boolean;
  created_by_name?: string;
  created_by_email?: string;
  created_by_role?: string;
  created_at?: string;
  updated_by?: string;
  updated_by_name?: string;
  updated_by_email?: string;
  updated_by_role?: string;
  updated_at?: string;
  edit_history?: {
    user_id?: string;
    name?: string;
    email?: string;
    role?: string;
    at: string;
    action?: string;
  }[];
};

export type BookingPayload = {
  sport: GroundSport;
  customer: {
    name: string;
    organization?: string;
    phone: string;
    address: string;
    sourcePersonId?: string | null;
  };
  startDate: string;
  endDate: string;
  timeSlot: TimeSlot;
  customHours?: number | null;
  eventType: EventType;
  numberOfPeople: number;
  groundRate: number;
  food: { enabled: boolean; ratePerPlate: number; people?: number };
  transport: { enabled: boolean; ratePerPerson: number; people?: number };
  umpire: { enabled: boolean; ratePerDay: number; people?: number };
  balls: {
    enabled: boolean;
    type?: string | null;
    color?: string | null;
    quantity: number;
    ratePerBall: number;
  };
};
