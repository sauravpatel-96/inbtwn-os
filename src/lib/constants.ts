import type { Database } from "@/integrations/supabase/types";

export type EventStatus = Database["public"]["Enums"]["event_status"];
export type EventSource = Database["public"]["Enums"]["event_source"];
export type GuestCountStatus = Database["public"]["Enums"]["guest_count_status"];
export type ClientType = Database["public"]["Enums"]["client_type"];

export const EVENT_STATUSES: { value: EventStatus; label: string; tone: string }[] = [
  { value: "enquiry", label: "Enquiry", tone: "s-enq" },
  { value: "quoting", label: "Quoting", tone: "s-quote" },
  { value: "awaiting_client", label: "Awaiting Client", tone: "s-await" },
  { value: "confirmed", label: "Confirmed", tone: "s-conf" },
  { value: "in_progress", label: "In Progress", tone: "s-prog" },
  { value: "completed", label: "Completed", tone: "s-done" },
  { value: "lost", label: "Lost", tone: "s-lost" },
  { value: "cancelled", label: "Cancelled", tone: "s-lost" },
];

export const statusLabel = (s: EventStatus) =>
  EVENT_STATUSES.find((x) => x.value === s)?.label ?? s;

export const ACTIVE_STATUSES: EventStatus[] = [
  "enquiry",
  "quoting",
  "awaiting_client",
  "confirmed",
  "in_progress",
];

export const EVENT_SOURCES: { value: EventSource; label: string }[] = [
  { value: "togather", label: "Togather" },
  { value: "poptop", label: "Poptop" },
  { value: "direct", label: "Direct" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "repeat_client", label: "Repeat Client" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "other", label: "Other" },
];

export const sourceLabel = (s: EventSource) =>
  EVENT_SOURCES.find((x) => x.value === s)?.label ?? s;

export const EVENT_TYPES = [
  "Corporate Catering",
  "Private Dinner",
  "Wedding",
  "Birthday",
  "Office Lunch",
  "Buffet",
  "Canapé Reception",
  "BBQ",
  "Drop-Off Catering",
  "Market / Festival",
  "Private Chef",
  "Other",
];

export const SERVICE_STYLES = [
  "Drop-Off",
  "Buffet",
  "Family Style",
  "Plated",
  "Sharing",
  "Canapés",
  "Bowl Food",
  "BBQ",
  "Stall Service",
  "Other",
];

export const GUEST_COUNT_STATUSES: { value: GuestCountStatus; label: string }[] = [
  { value: "estimated", label: "Estimated" },
  { value: "booked", label: "Booked" },
  { value: "confirmed", label: "Confirmed" },
  { value: "final", label: "Final" },
];

export const CLIENT_TYPES: { value: ClientType; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "corporate", label: "Corporate" },
  { value: "agency", label: "Agency" },
  { value: "venue", label: "Venue" },
  { value: "other", label: "Other" },
];

export const DIETARY_TYPES = [
  "Vegetarian",
  "Vegan",
  "Gluten Free",
  "Dairy Free",
  "Nut Allergy",
  "Peanut Allergy",
  "Sesame Allergy",
  "Shellfish Allergy",
  "Other Allergy",
  "Other Dietary Requirement",
];

export const DIETARY_SEVERITIES = ["preference", "intolerance", "allergy", "severe"];

export const DEFAULT_CURRENCY = "GBP";
