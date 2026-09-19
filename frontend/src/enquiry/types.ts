export const ENQUIRY_SOURCES = [
  "Phone Call", "Walk-in", "WhatsApp", "Website", "Social Media",
  "Referral", "Existing Parent", "Advertisement", "Other",
] as const;

export const ENQUIRY_STATUSES = [
  "New", "Contacted", "Interested", "Visit Scheduled", "Application Started",
  "Application Submitted", "Admitted", "Not Interested", "Lost", "On Hold",
  "Pending Close",
] as const;

export const FEE_DISCUSSION = ["Not Discussed", "Discussed", "Details Shared"] as const;
export const CONTACT_METHODS = ["Call", "WhatsApp", "Email"] as const;
export const PRIORITIES = ["Low", "Medium", "High"] as const;
export const GENDERS = ["Male", "Female", "Other"] as const;
export const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Other"] as const;
export const ALPHA_SPORTS = ["Cricket", "Football"] as const;
export const ALPHA_CATEGORIES = ["Daily", "Hostel", "Boarding", "Day Boarding"] as const;
export const ALPHA_CAMPUSES = ["Balua", "Harding Park", "Defense Colony"] as const;

export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export type EnquiryInstitution = "PWS" | "ALPHA";

export type EnquiryStaff = { id: string; name: string; role?: string; email?: string };

export type EnquiryHistory = {
  id?: string;
  at: string;
  by_name?: string;
  action: string;
  note?: string;
};

export type Enquiry = {
  id: string;
  enquiry_code: string;
  institution: EnquiryInstitution;
  academic_year?: string;
  enquiry_at: string;
  source: EnquirySource;
  referred_by?: string | null;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  office_queue?: boolean;
  student_name: string;
  dob?: string | null;
  gender?: string | null;
  current_school?: string | null;
  current_class?: string | null;
  applying_for: string;
  preferred_campus?: string | null;
  sibling_enrolled?: boolean;
  sibling_name?: string | null;
  sibling_class?: string | null;
  parent_name: string;
  relationship?: string | null;
  mobile: string;
  alternate_mobile?: string | null;
  email?: string | null;
  locality?: string | null;
  address?: string | null;
  preferred_contact_method?: string | null;
  alpha_sport?: string | null;
  alpha_category?: string | null;
  parent_expectations?: string | null;
  fee_discussion_status?: string | null;
  prospectus_shared?: boolean;
  visit_required?: boolean;
  preferred_visit_at?: string | null;
  interaction_notes?: string | null;
  status: EnquiryStatus;
  last_contacted_at?: string | null;
  next_follow_up_at?: string | null;
  follow_up_remarks?: string | null;
  lost_reason?: string | null;
  priority?: string;
  converted_person_id?: string | null;
  close_approval_id?: string | null;
  follow_up_overdue?: boolean;
  history?: EnquiryHistory[];
  created_by_name?: string;
  created_at?: string;
};

export type EnquiryPayload = {
  institution: EnquiryInstitution;
  academic_year?: string;
  enquiry_at?: string;
  source: string;
  referred_by?: string;
  assigned_to_id?: string | null;
  student_name: string;
  dob?: string;
  gender?: string;
  current_school?: string;
  current_class?: string;
  applying_for: string;
  preferred_campus?: string;
  sibling_enrolled: boolean;
  sibling_name?: string;
  sibling_class?: string;
  parent_name: string;
  relationship?: string;
  mobile: string;
  alternate_mobile?: string;
  email?: string;
  locality?: string;
  address?: string;
  preferred_contact_method?: string;
  alpha_sport?: string;
  alpha_category?: string;
  parent_expectations?: string;
  fee_discussion_status?: string;
  prospectus_shared: boolean;
  visit_required: boolean;
  preferred_visit_at?: string;
  interaction_notes?: string;
  status: string;
  last_contacted_at?: string;
  next_follow_up_at?: string;
  follow_up_remarks?: string;
  lost_reason?: string;
  priority: string;
};

export function statusTone(status: string) {
  if (status === "Admitted") return { bg: "#DCFCE7", fg: "#15803D" };
  if (status === "Lost" || status === "Not Interested") return { bg: "#FEE2E2", fg: "#B91C1C" };
  if (status === "Pending Close") return { bg: "#FEF3C7", fg: "#B45309" };
  if (status === "Interested" || status === "Visit Scheduled" || status === "Application Started" || status === "Application Submitted") {
    return { bg: "#DBEAFE", fg: "#1D4ED8" };
  }
  return { bg: "#FFEDD5", fg: "#C2410C" };
}
