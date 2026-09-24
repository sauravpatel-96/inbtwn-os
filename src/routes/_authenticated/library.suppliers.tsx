import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle, TornCard, Field, TextInput, PrimaryButton, EmptyNote } from "@/components/inbtwn/bits";
import { suppliersQuery, type Supplier } from "@/lib/costing";

export const Route = createFileRoute("/_authenticated/library/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — INBTWN OS" },
      { name: "description", content: "Where you buy ingredients: suppliers, delivery and preferences." },
      { property: "og:title", content: "Suppliers — INBTWN OS" },
      { property: "og:description", content: "Your ingredient suppliers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuppliersPage,
});

function SupplierEditor({ s, onDone }: { s: Supplier | null; onDone: () => void }) {
  const [name, setName] = useState(s?.name ?? "");
  const [delivery, setDelivery] = useState(s?.delivery_available ?? false);
  const [pref, setPref] = useState(s?.preference_notes ?? "");
  const [notes, setNotes] = useState(s?.notes ?? "");
  const save = async () => {
    if (!name.trim()) return void toast.error("Enter a name");
    const values = { name: name.trim(), delivery_available: delivery, preference_notes: pref.trim() || null, notes: notes.trim() || null };
    const { error } = s
      ? await supabase.from("suppliers").update(values).eq("id", s.id)
      : await supabase.from("suppliers").insert(values as never);
    if (error) return void toast.error(error.message);
    toast.success("Supplier saved");
    onDone();
  };
  return (
    <div className="mt-3 space-y-3">
      <Field label="Name" required>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 font-mono text-[12px]">
        <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} /> Delivery available
      </label>
      <Field label="Convenience / preference">
        <TextInput value={pref} onChange={(e) => setPref(e.target.value)} placeholder="e.g. good for small top-ups" />
      </Field>
      <Field label="Notes">
        <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <PrimaryButton type="button" onClick={() => void save()}>Save supplier</PrimaryButton>
    </div>
  );
}

function SuppliersPage() {
  const q = useQuery(suppliersQuery);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const done = () => {
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    qc.invalidateQueries({ queryKey: ["purchase-options"] });
  };
  const toggle = async (s: Supplier) => {
    const { error } = await supabase.from("suppliers").update({ active: !s.active }).eq("id", s.id);
    if (error) return void toast.error(error.message);
    done();
  };
  return (
    <div>
      <div className="mb-1">
        <Link to="/library" className="font-mono text-[11px] text-ink-soft">← Library</Link>
      </div>
      <PageTitle title="Suppliers" aside={`${q.data?.length ?? 0}`} />
      <button type="button" onClick={() => setEditing(editing === "new" ? null : "new")} className="tap mb-3 w-full bg-ink px-4 py-3 font-semibold text-cream">
        + New supplier
      </button>
      {editing === "new" ? (
        <TornCard className="mb-3 px-4 py-3 shadow-card"><SupplierEditor s={null} onDone={done} /></TornCard>
      ) : null}
      {!q.data?.length ? (
        <EmptyNote>No suppliers yet.</EmptyNote>
      ) : (
        <div className="space-y-2">
          {q.data.map((s) => (
            <TornCard key={s.id} className="px-4 py-3 shadow-card">
              <div className="flex items-baseline justify-between gap-3">
                <span className={s.active ? "font-semibold" : "font-semibold text-ink-soft line-through"}>{s.name}</span>
                <span className="font-mono text-[10px] text-ink-soft">{s.delivery_available ? "Delivers" : "Collect"}</span>
              </div>
              {s.preference_notes ? <div className="mt-1 text-[12px] text-ink-soft">{s.preference_notes}</div> : null}
              <div className="mt-2 flex gap-3 font-mono text-[11px]">
                <button type="button" className="text-flame" onClick={() => setEditing(editing === s.id ? null : s.id)}>Edit</button>
                <button type="button" className="text-ink-soft" onClick={() => void toggle(s)}>{s.active ? "Deactivate" : "Reactivate"}</button>
              </div>
              {editing === s.id ? <SupplierEditor s={s} onDone={done} /> : null}
            </TornCard>
          ))}
        </div>
      )}
    </div>
  );
}
