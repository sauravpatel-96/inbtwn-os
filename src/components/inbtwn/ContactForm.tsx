import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { ContactRow } from "@/lib/queries";
import { Field, TextInput, TextArea, PrimaryButton, GhostButton } from "./bits";

const schema = z
  .object({
    first_name: z.string().trim().max(100),
    last_name: z.string().trim().max(100),
    role: z.string().trim().max(120),
    email: z.string().trim().max(255).email("Enter a valid email").or(z.literal("")),
    phone: z.string().trim().max(40),
    notes: z.string().trim().max(2000),
    is_primary: z.boolean(),
  })
  .refine((v) => v.first_name || v.last_name, {
    message: "Add a contact name",
    path: ["first_name"],
  });

type Values = z.infer<typeof schema>;
const nn = (s: string) => (s.trim() ? s.trim() : null);

export function ContactForm({
  clientId,
  initial,
  onSaved,
  onCancel,
}: {
  clientId: string;
  initial?: ContactRow | undefined;
  onSaved: (c: ContactRow) => void;
  onCancel?: (() => void) | undefined;
}) {
  const [v, setV] = useState<Values>({
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    role: initial?.role ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    notes: initial?.notes ?? "",
    is_primary: initial?.is_primary ?? false,
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const parsed = schema.safeParse(v);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setBusy(true);
    const payload = {
      client_id: clientId,
      first_name: nn(parsed.data.first_name),
      last_name: nn(parsed.data.last_name),
      role: nn(parsed.data.role),
      email: nn(parsed.data.email),
      phone: nn(parsed.data.phone),
      notes: nn(parsed.data.notes),
      is_primary: parsed.data.is_primary,
    };
    // Only one active primary per client — stand the others down first.
    if (payload.is_primary) {
      await supabase
        .from("client_contacts")
        .update({ is_primary: false })
        .eq("client_id", clientId)
        .neq("id", initial?.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const res = initial
      ? await supabase.from("client_contacts").update(payload).eq("id", initial.id).select().single()
      : await supabase.from("client_contacts").insert(payload).select().single();
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    onSaved(res.data as ContactRow);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" required>
          <TextInput value={v.first_name} onChange={(e) => set("first_name", e.target.value)} />
        </Field>
        <Field label="Last name">
          <TextInput value={v.last_name} onChange={(e) => set("last_name", e.target.value)} />
        </Field>
      </div>
      <Field label="Role" hint="optional">
        <TextInput value={v.role} onChange={(e) => set("role", e.target.value)} placeholder="Events Manager" />
      </Field>
      <Field label="Email">
        <TextInput type="email" inputMode="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Phone">
        <TextInput type="tel" inputMode="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="Notes" hint="optional">
        <TextArea value={v.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 font-mono text-[12px] text-ink-soft">
        <input
          type="checkbox"
          checked={v.is_primary}
          onChange={(e) => set("is_primary", e.target.checked)}
          className="size-[18px] accent-flame"
        />
        Primary contact
      </label>
      <div className="flex gap-2">
        <PrimaryButton type="button" onClick={() => submit()} disabled={busy}>
          {busy ? "Saving…" : initial ? "Save contact" : "Add contact"}
        </PrimaryButton>
        {onCancel ? (
          <GhostButton type="button" onClick={onCancel}>
            Cancel
          </GhostButton>
        ) : null}
      </div>
    </div>
  );
}
