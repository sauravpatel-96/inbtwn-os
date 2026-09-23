import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PageTitle,
  SectionHeading,
  Field,
  TextInput,
  TextArea,
  SelectInput,
  PrimaryButton,
  StickyActions,
} from "@/components/inbtwn/bits";
import { businessSettingsQuery, saveBusinessSettings, type BusinessSettings } from "@/lib/business";

export const Route = createFileRoute("/_authenticated/settings/business")({
  head: () => ({
    meta: [
      { title: "Business & Documents — INBTWN OS" },
      {
        name: "description",
        content: "Business identity, bank details and the defaults used on quotes and invoices.",
      },
      { property: "og:title", content: "Business & Documents — INBTWN OS" },
      { property: "og:description", content: "Details that appear on client quotes and invoices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BusinessSettingsPage,
  errorComponent: () => <p className="font-mono text-[12px]">Could not load your business settings.</p>,
  notFoundComponent: () => <p className="font-mono text-[12px]">Not found.</p>,
});

type FormState = Record<string, string | boolean>;

const TEXT_FIELDS = [
  "trading_name",
  "legal_name",
  "address_line1",
  "address_line2",
  "city",
  "postcode",
  "country",
  "email",
  "phone",
  "company_number",
  "currency",
  "default_payment_method",
  "bank_account_name",
  "bank_sort_code",
  "bank_account_number",
  "card_fee_percentage",
  "deposit_percentage",
  "balance_due_days_before",
  "quote_validity_days",
  "vat_rate",
  "card_wording",
  "quote_terms",
  "invoice_payment_terms",
] as const;

const BOOL_FIELDS = [
  "card_payments_available",
  "bank_details_on_invoices",
  "bank_details_on_quotes",
  "vat_registered",
] as const;

function toForm(s: BusinessSettings): FormState {
  const f: FormState = {};
  for (const k of TEXT_FIELDS) f[k] = (s as unknown as Record<string, unknown>)[k] == null ? "" : String((s as unknown as Record<string, unknown>)[k]);
  for (const k of BOOL_FIELDS) f[k] = Boolean((s as unknown as Record<string, unknown>)[k]);
  return f;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="tap flex w-full items-center justify-between gap-3 border border-ink/15 bg-cream px-3 py-3 text-left"
    >
      <span className="text-[14px]">{label}</span>
      <span className={`label-mono rounded-sm px-2 py-1 ${value ? "bg-ink text-cream" : "bg-ink/8 text-ink-soft"}`}>
        {value ? "On" : "Off"}
      </span>
    </button>
  );
}

function BusinessSettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery(businessSettingsQuery());
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data && !form) setForm(toForm(settings.data));
  }, [settings.data, form]);

  const set = (k: string, v: string | boolean) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const str = (k: string) => String(form?.[k] ?? "");
  const bool = (k: string) => Boolean(form?.[k]);

  const save = async () => {
    if (!settings.data || !form) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      for (const k of TEXT_FIELDS) {
        const raw = String(form[k] ?? "").trim();
        if (["card_fee_percentage", "deposit_percentage", "vat_rate"].includes(k)) {
          patch[k] = raw === "" ? 0 : Number(raw);
        } else if (["balance_due_days_before", "quote_validity_days"].includes(k)) {
          patch[k] = raw === "" ? 0 : Math.round(Number(raw));
        } else if (["trading_name", "currency", "default_payment_method"].includes(k)) {
          patch[k] = raw || (k === "currency" ? "GBP" : k === "default_payment_method" ? "bank_transfer" : "INBTWN");
        } else {
          patch[k] = raw || null;
        }
      }
      for (const k of BOOL_FIELDS) patch[k] = Boolean(form[k]);
      await saveBusinessSettings(settings.data.id, patch);
      await qc.invalidateQueries({ queryKey: ["business-settings"] });
      toast.success("Business details saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  if (settings.isLoading || !form) {
    return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;
  }

  return (
    <div>
      <PageTitle title="Business" aside="documents">
        <p className="mt-1 font-mono text-[11px] text-ink-soft">
          These details appear on every quote and invoice you send.
        </p>
      </PageTitle>

      <div className="space-y-5">
        <section>
          <SectionHeading title="Identity" />
          <div className="space-y-3 border border-ink/15 bg-cream px-4 py-4">
            <Field label="Trading name" required>
              <TextInput value={str("trading_name")} onChange={(e) => set("trading_name", e.target.value)} />
            </Field>
            <Field label="Legal name">
              <TextInput value={str("legal_name")} onChange={(e) => set("legal_name", e.target.value)} />
            </Field>
            <Field label="Address">
              <TextInput
                placeholder="Street"
                value={str("address_line1")}
                onChange={(e) => set("address_line1", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <TextInput value={str("city")} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="Postcode">
                <TextInput value={str("postcode")} onChange={(e) => set("postcode", e.target.value)} />
              </Field>
            </div>
            <Field label="Country">
              <TextInput value={str("country")} onChange={(e) => set("country", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <TextInput inputMode="email" value={str("email")} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Phone">
                <TextInput inputMode="tel" value={str("phone")} onChange={(e) => set("phone", e.target.value)} />
              </Field>
            </div>
            <Field label="Company number">
              <TextInput value={str("company_number")} onChange={(e) => set("company_number", e.target.value)} />
            </Field>
          </div>
        </section>

        <section>
          <SectionHeading title="Payment" />
          <div className="space-y-3 border border-ink/15 bg-cream px-4 py-4">
            <Field label="Default method">
              <SelectInput
                value={str("default_payment_method")}
                onChange={(e) => set("default_payment_method", e.target.value)}
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="platform">Platform</option>
              </SelectInput>
            </Field>
            <Field label="Account name">
              <TextInput value={str("bank_account_name")} onChange={(e) => set("bank_account_name", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sort code">
                <TextInput value={str("bank_sort_code")} onChange={(e) => set("bank_sort_code", e.target.value)} />
              </Field>
              <Field label="Account number">
                <TextInput
                  inputMode="numeric"
                  value={str("bank_account_number")}
                  onChange={(e) => set("bank_account_number", e.target.value)}
                />
              </Field>
            </div>
            <Toggle
              label="Card payments available"
              value={bool("card_payments_available")}
              onChange={(v) => set("card_payments_available", v)}
            />
            <Field label="Card fee %">
              <TextInput
                inputMode="decimal"
                value={str("card_fee_percentage")}
                onChange={(e) => set("card_fee_percentage", e.target.value)}
              />
            </Field>
            <Toggle
              label="Show bank details on invoices"
              value={bool("bank_details_on_invoices")}
              onChange={(v) => set("bank_details_on_invoices", v)}
            />
            <Toggle
              label="Show bank details on quotes"
              value={bool("bank_details_on_quotes")}
              onChange={(v) => set("bank_details_on_quotes", v)}
            />
          </div>
        </section>

        <section>
          <SectionHeading title="Defaults" />
          <div className="space-y-3 border border-ink/15 bg-cream px-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Deposit %">
                <TextInput
                  inputMode="decimal"
                  value={str("deposit_percentage")}
                  onChange={(e) => set("deposit_percentage", e.target.value)}
                />
              </Field>
              <Field label="Balance days before">
                <TextInput
                  inputMode="numeric"
                  value={str("balance_due_days_before")}
                  onChange={(e) => set("balance_due_days_before", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Quote valid for (days)">
              <TextInput
                inputMode="numeric"
                value={str("quote_validity_days")}
                onChange={(e) => set("quote_validity_days", e.target.value)}
              />
            </Field>
            <Toggle label="VAT registered" value={bool("vat_registered")} onChange={(v) => set("vat_registered", v)} />
            <Field label="VAT rate %" hint="Used only when VAT is on">
              <TextInput inputMode="decimal" value={str("vat_rate")} onChange={(e) => set("vat_rate", e.target.value)} />
            </Field>
            <Field label="Card wording">
              <TextArea value={str("card_wording")} onChange={(e) => set("card_wording", e.target.value)} />
            </Field>
            <Field label="Quote terms" hint="One per line">
              <TextArea
                className="min-h-[120px]"
                value={str("quote_terms")}
                onChange={(e) => set("quote_terms", e.target.value)}
              />
            </Field>
            <Field label="Invoice payment terms" hint="One per line">
              <TextArea
                value={str("invoice_payment_terms")}
                onChange={(e) => set("invoice_payment_terms", e.target.value)}
              />
            </Field>
          </div>
        </section>
      </div>

      <StickyActions>
        <PrimaryButton type="button" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save business details"}
        </PrimaryButton>
        <Link to="/library" className="mt-2 block text-center font-mono text-[11px] text-ink-soft underline">
          Back to Library
        </Link>
      </StickyActions>
    </div>
  );
}
