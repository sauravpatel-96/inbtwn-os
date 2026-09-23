import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
export type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
export type DietaryRow = Database["public"]["Tables"]["event_dietaries"]["Row"];
export type DietaryInsert = Database["public"]["Tables"]["event_dietaries"]["Insert"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ContactRow = Database["public"]["Tables"]["client_contacts"]["Row"];

export const CLIENT_SUMMARY = "id, client_type, company_name, first_name, last_name, email, phone";
export type ClientSummary = Pick<
  ClientRow,
  "id" | "client_type" | "company_name" | "first_name" | "last_name" | "email" | "phone"
>;

export type EventWithClient = EventRow & { client: ClientSummary | null };

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("profiles")
        .select("*, organisation:organisations(id, name)")
        .maybeSingle(),
    ) as (ProfileRow & { organisation: { id: string; name: string } | null }) | null,
});

export const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("events")
        .select(`*, client:clients(${CLIENT_SUMMARY})`)
        .order("event_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ) as EventWithClient[],
});

export const eventQuery = (id: string) =>
  queryOptions({
    queryKey: ["events", id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("events")
          .select(`*, client:clients(*)`)
          .eq("id", id)
          .maybeSingle(),
      ) as (EventRow & { client: ClientRow | null }) | null,
  });

export const dietariesQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["dietaries", eventId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("event_dietaries")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at"),
      ) as DietaryRow[],
  });

export type ClientWithRelations = ClientRow & {
  events: { count: number }[];
  contacts: ContactRow[];
};

export const clientsQuery = queryOptions({
  queryKey: ["clients"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("clients")
        .select("*, events(count), contacts:client_contacts(*)")
        .order("company_name", { ascending: true, nullsFirst: false })
        .order("last_name", { ascending: true, nullsFirst: false }),
    ) as ClientWithRelations[],
});

export const clientQuery = (id: string) =>
  queryOptions({
    queryKey: ["clients", id],
    queryFn: async () =>
      unwrap(await supabase.from("clients").select("*").eq("id", id).maybeSingle()) as ClientRow | null,
  });

export const clientEventsQuery = (clientId: string) =>
  queryOptions({
    queryKey: ["events", "client", clientId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("events")
          .select(`*, client:clients(${CLIENT_SUMMARY})`)
          .eq("client_id", clientId)
          .order("event_date", { ascending: false, nullsFirst: false }),
      ) as EventWithClient[],
  });
