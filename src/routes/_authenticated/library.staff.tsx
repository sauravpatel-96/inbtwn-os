import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle, Field, TextInput, TextArea, PrimaryButton, GhostButton, EmptyNote, Chip } from "@/components/inbtwn/bits";
import { fmtMoney } from "@/lib/format";
import { staffMembersQuery, type StaffMemberRow } from "@/lib/staff";

export const Route = createFileRoute("/_authenticated/library/staff")({
  head: () => ({
    meta: [
      { title: "Staff — INBTWN OS" },
      { name: "description", content: "Your casual staff: names, contact details and default hourly rates." },
      { property: "og:title", content: "Staff — INBTWN OS" },
      { property: "og:description", content: "Casual staff pool for prep and events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffPage,
});

type Draft = { name: string; phone: string; email: string; rate: string; notes: string; active: boolean };
const blank: Draft = { name: "", phone: "", email: "", rate: "15", notes: "", active: true };

function StaffPage() {
  const qc = useQueryClient();
  const staff = useQuery(staffMembersQuery);
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMemberRow | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [busy, setBusy] = useState(false);

  const rows = (staff.data ?? []).filter((m) => (showArchived ? !m.active : m.active));

  const openEdit = (m?: StaffMemberRow) => {
    setEditing(m ?? null);
    setDraft(
      m
        ? { name: m.name, phone: m.phone ?? "", email: m.email ?? "", rate: String(Number(m.default_hourly_rate)), notes: m.notes ?? "", active: m.active }
        : blank,
    );
    setOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim()) return void toast.error("Name is required");
    const payload = {
      name: draft.name.trim(),
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      default_hourly_rate: Math.max(0, Number(draft.rate) || 0),
      notes: draft.notes.trim() || null,
      active: draft.active,
    };
    setBusy(true);
    const { error } = editing
      ? await supabase.from("staff_members").update(payload).eq("id", editing.id)
      : await supabase.from("staff_members").insert(payload);
    setBusy(false);
    if (error) return void toast.error(error.message);
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["staff-members"] });
    toast.success(editing ? "Saved" : `${payload.name} added`);
  };

  return (
    <div>
      <div className="mb-1">
        <Link to="/library" className="font-mono text-[11px] text-ink-soft">
          ← Library
        </Link>
      </div>
      <PageTitle title="Staff" aside="casual helpers" />
      <div className="mb-3 flex gap-2">
        <Chip active={!showArchived} onClick={() => setShowArchived(false)}>Active</Chip>
        <Chip active={showArchived} onClick={() => setShowArchived(true)}>Inactive</Chip>
      </div>
      {staff.isLoading ? (
        <p className="font-mono text-[12px] text-ink-soft">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyNote>{showArchived ? "No inactive staff." : "No staff yet."}</EmptyNote>
      ) : (
        <div className="border border-ink/15 bg-cream">
          {rows.map((m) => (
            <button key={m.id} type="button" onClick={() => openEdit(m)} className="flex w-full items-baseline justify-between gap-3 border-b border-ink/10 px-4 py-3 text-left last:border-0">
              <div className="min-w-0">
                <div className="font-display text-[18px] uppercase leading-none">{m.name}</div>
                <div className="mt-1 font-mono text-[11px] text-ink-soft">{[m.phone, m.email].filter(Boolean).join(" · ") || "No contact details"}</div>
              </div>
              <span className="shrink-0 font-mono text-[13px]">{fmtMoney(Number(m.default_hourly_rate), "GBP")}/hr</span>
            </button>
          ))}
        </div>
      )}
      <PrimaryButton className="mt-4" onClick={() => openEdit()}>+ Add staff member</PrimaryButton>

      <Drawer open={open} onOpenChange={(o) => !o && setOpen(false)} shouldScaleBackground={false}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">{editing ? "Edit staff member" : "Add staff member"}</DrawerTitle>
            <div className="mt-3 space-y-3 overflow-y-auto pb-3">
              <Field label="Name" required>
                <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Default rate £ / hour">
                <TextInput inputMode="decimal" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <TextInput type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                </Field>
                <Field label="Email">
                  <TextInput type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </Field>
              </div>
              <Field label="Notes">
                <TextArea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </Field>
              <label className="flex items-center gap-3">
                <input type="checkbox" className="size-5" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                <span className="font-semibold">Active</span>
              </label>
            </div>
            <div className="mt-1 space-y-2 pb-3">
              <PrimaryButton disabled={busy} onClick={save}>{editing ? "Save" : "Add staff member"}</PrimaryButton>
              <GhostButton className="w-full" onClick={() => setOpen(false)}>Cancel</GhostButton>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
