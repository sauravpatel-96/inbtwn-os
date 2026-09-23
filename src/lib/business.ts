import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type BusinessSettings = Database["public"]["Tables"]["business_settings"]["Row"];
export type BusinessSettingsUpdate = Database["public"]["Tables"]["business_settings"]["Update"];

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/**
 * One settings row per organisation. Created on first read so the document
 * layer always has an identity to print, without any manual setup step.
 */
export const businessSettingsQuery = () =>
  queryOptions({
    queryKey: ["business-settings"],
    queryFn: async (): Promise<BusinessSettings> => {
      const existing = unwrap(
        await supabase.from("business_settings").select("*").limit(1).maybeSingle(),
      ) as BusinessSettings | null;
      if (existing) return existing;
      const created = await supabase.from("business_settings").insert({}).select().single();
      if (created.error) throw new Error(created.error.message);
      return created.data as BusinessSettings;
    },
  });

export async function saveBusinessSettings(id: string, patch: BusinessSettingsUpdate) {
  const { error } = await supabase.from("business_settings").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export function businessAddressLines(s: BusinessSettings): string[] {
  return [s.address_line1, s.address_line2, s.city, s.postcode, s.country].filter(
    (v): v is string => !!v && v.trim().length > 0,
  );
}

export type BankDetails = { accountName: string; sortCode: string; accountNumber: string };

export function bankDetailsOf(s: BusinessSettings): BankDetails | null {
  if (!s.bank_account_name && !s.bank_sort_code && !s.bank_account_number) return null;
  return {
    accountName: s.bank_account_name ?? "",
    sortCode: s.bank_sort_code ?? "",
    accountNumber: s.bank_account_number ?? "",
  };
}

/** Standard terms text, split into lines. Direct and platform bookings differ. */
export function quoteTermsLines(s: BusinessSettings, platform: boolean): string[] {
  if (platform) {
    return [
      "This booking is managed through the booking platform.",
      "Payment is handled by the platform under its own terms.",
      "Final guest numbers are required 7 days before the event.",
    ];
  }
  const text = s.quote_terms?.trim();
  if (text) return text.split("\n").map((l) => l.trim()).filter(Boolean);
  return [
    `${Number(s.deposit_percentage)}% deposit required to secure the booking.`,
    `Final balance due ${s.balance_due_days_before} days before the event.`,
    "Payment by bank transfer.",
  ];
}

export function invoiceTermsLines(s: BusinessSettings): string[] {
  const text = s.invoice_payment_terms?.trim();
  if (text) return text.split("\n").map((l) => l.trim()).filter(Boolean);
  return ["Payment by bank transfer using the details below."];
}
