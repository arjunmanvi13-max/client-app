import { api } from "../auth";
import type { BookingPayload, GroundBooking, GroundCustomer, GroundSport } from "./types";

export async function fetchGroundBookings(params: {
  sport?: GroundSport | "";
  month?: string;
  status?: string;
}): Promise<GroundBooking[]> {
  const { data } = await api.get("/ground-bookings", {
    params: {
      sport: params.sport || undefined,
      month: params.month || undefined,
      status: params.status || undefined,
    },
  });
  return Array.isArray(data) ? data : [];
}

export async function searchGroundCustomers(q: string): Promise<GroundCustomer[]> {
  const { data } = await api.get("/ground-bookings/customers", { params: { q } });
  return Array.isArray(data) ? data : [];
}

export async function createGroundBooking(payload: BookingPayload): Promise<GroundBooking> {
  const { data } = await api.post("/ground-bookings", payload);
  return data;
}

export async function updateGroundBooking(id: string, payload: BookingPayload): Promise<GroundBooking> {
  const { data } = await api.put(`/ground-bookings/${id}`, payload);
  return data;
}

export async function updateGroundBookingStatus(id: string, status: string): Promise<GroundBooking> {
  const { data } = await api.patch(`/ground-bookings/${id}/status`, { status });
  return data;
}
