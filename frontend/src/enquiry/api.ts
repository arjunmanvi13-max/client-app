import { api } from "../auth";
import type { Enquiry, EnquiryPayload, EnquiryStaff } from "./types";

export async function fetchEnquiries(params: Record<string, string | boolean | undefined>): Promise<Enquiry[]> {
  const { data } = await api.get("/enquiries", { params });
  return Array.isArray(data) ? data : [];
}

export async function fetchEnquiryOptions(): Promise<{ staff: EnquiryStaff[] }> {
  const { data } = await api.get("/enquiries/options");
  return data;
}

export async function createEnquiry(payload: EnquiryPayload): Promise<Enquiry> {
  const { data } = await api.post("/enquiries", payload);
  return data;
}

export async function updateEnquiry(id: string, payload: EnquiryPayload): Promise<Enquiry> {
  const { data } = await api.put(`/enquiries/${id}`, payload);
  return data;
}

export async function assignEnquiry(id: string, assignee_id: string, action_note: string): Promise<Enquiry> {
  const { data } = await api.post(`/enquiries/${id}/assign`, { assignee_id, action_note });
  return data;
}

export async function completeEnquiryAssignment(id: string, remarks: string): Promise<Enquiry> {
  const { data } = await api.post(`/enquiries/${id}/complete-assignment`, { remarks });
  return data;
}

export async function markEnquiryFollowUp(id: string, body: { remarks?: string; next_follow_up_at?: string }): Promise<Enquiry> {
  const { data } = await api.post(`/enquiries/${id}/follow-up-done`, body);
  return data;
}

export async function requestEnquiryClose(id: string, reason: string, lost_reason?: string): Promise<Enquiry> {
  const { data } = await api.post(`/enquiries/${id}/close`, { reason, lost_reason });
  return data;
}

export async function convertEnquiry(id: string): Promise<{
  enquiry: Enquiry;
  person: { id: string };
  directory_kind: "students" | "players";
  already_converted?: boolean;
}> {
  const { data } = await api.post(`/enquiries/${id}/convert`);
  return data;
}
