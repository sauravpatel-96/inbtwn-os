import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { ClientInsert, ClientRow } from "@/lib/queries";
import { CLIENT_TYPES, type ClientType } from "@/lib/constants";
import { Field, TextInput, SelectInput, TextArea, PrimaryButton, StickyActions } from "./bits";

const schema = z
  .object({
    client_type: z.enum(["individual", "corporate", "agency", "venue", "other"]),
    company_name: z.string().trim().max(200),
    first_name: z.string().trim().max(100),
    last_name: z.string().trim().max(100),
    email: z.string().trim().max(255).email("Enter a valid email").or(z.literal("")),
    phone: z.string().trim().max(40),
    billing_address: z.string().trim().max(500),
    default_event_address: z.string().trim().max(500),
    notes: z.string().trim().max(2000),
  })
  .refine((v) => v.company_name || v.first_name || v.last_name, {
    message: "Add a company name or a person's name",
    path: ["company_name"],
  });

export type ClientFormValues = z.infer<typeof schema>;

const empty: ClientFormValues = {
  client_type: "individual",
  company_name: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  billing_address: "",
  default_event_address: "",
  notes: "",
};

const nn = (s: string) => (s.trim() ? s.trim() : null);

export function toInsert(v: ClientFormValues): ClientInsert {
  return {
    client_type: v.client_type,
    company_name: nn(v.company_name),
    first_name: nn(v.first_name),
    last_name: nn(v.last_name),
    email: nn(v.email),
    phone: nn(v.phone),
    billing_address: nn(v.billing_address),
    default_event_address: nn(v.default_event_address),
    notes: nn(v.notes),
  };
}

export function ClientForm({
  initial,
  onSaved,
  compact = false,
  submitLabel = "Save client",
}: {
  initial?: ClientRow | undefined;
  onSaved: (client: ClientRow) => void;
  compact?: boolean;
  submitLabel?: string;
}) {
  const [v, setV] = useState<ClientFormValues>(
    initial
      ? {
          client_type: initial.client_type,
          company_name: initial.company_name ?? "",
          first_name: initial.first_name ?? "",
          last_name: initial.last_name ?? "",
          email: initial.email ?? "",
          phone: initial.phone ?? "",
          billing_address: initial.billing_address ?? "",
          default_event_address: initial.default_event_address ?? "",
          notes: initial.notes ?? "",
        }
      : empty,
  );
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ClientFormValues>(k: K, val: ClientFormValues[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const parsed = schema.safeParse(v);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setBusy(true);
    const payload = toInsert(parsed.data);
    const res = initial
      ? await supabase.from("clients").update(payload).eq("id", initial.id).select().single()
      : await supabase.from("clients").insert(payload).select().single();
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    onSaved(res.data);
  };

  const isCompany = v.client_type !== "individual";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Client type">
        <SelectInput value={v.client_type} onChange={(e) => set("client_type", e.target.value as ClientType)}>
          {CLIENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Company name" required={isCompany}>
        <TextInput value={v.company_name} onChange={(e) => set("company_name", e.target.value)} autoComplete="organization" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" required={!isCompany}>
          <TextInput value={v.first_name} onChange={(e) => set("first_name", e.target.value)} autoComplete="given-name" />
        </Field>
        <Field label="Last name">
          <TextInput value={v.last_name} onChange={(e) => set("last_name", e.target.value)} autoComplete="family-name" />
        </Field>
      </div>
      <Field label="Email">
        <TextInput type="email" inputMode="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Phone">
        <TextInput type="tel" inputMode="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      {!compact ? (
        <>
          <Field label="Billing address">
            <TextArea value={v.billing_address} onChange={(e) => set("billing_address", e.target.value)} />
          </Field>
          <Field label="Default event address">
            <TextArea value={v.default_event_address} onChange={(e) => set("default_event_address", e.target.value)} />
          </Field>
          <Field label="Notes">
            <TextArea value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </>
      ) : null}
      {compact ? (
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </PrimaryButton>
      ) : (
        <StickyActions>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </PrimaryButton>
        </StickyActions>
      )}
    </form>
  );
}
