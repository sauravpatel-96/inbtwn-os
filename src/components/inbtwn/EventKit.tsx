import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SectionHeading, TornCard, EmptyNote, Field, TextInput, SelectInput, PrimaryButton, GhostButton, Chip } from "@/components/inbtwn/bits";
import { Stepper } from "@/components/inbtwn/KitPackRow";
import type { EventRow } from "@/lib/queries";
import {
  KIT_CATEGORIES,
  KIT_TEMPLATES,
  PURCHASE_STATUSES,
  applyTemplate,
  eventKitQuery,
  kitItemsQuery,
  kitLines,
  kitSummary,
  purchaseLabel,
  suggestedTemplate,
  type KitLine,
  type PurchaseStatus,
  type TemplateKey,
} from "@/lib/kit";

type OwnedAction = { line: KitLine; delta: number; kind: "add" | "missing" } | null;

export function EventKit({ event }: { event: EventRow }) {
  const eventId = event.id;
  const qc = useQueryClient();
  const items = useQuery(kitItemsQuery);
  const rows = useQuery(eventKitQuery(eventId));
  const guests = event.guest_count ?? 0;
  const [template, setTemplate] = useState<TemplateKey>(suggestedTemplate(event.service_style));
  const [addOpen, setAddOpen] = useState(false);
  const [addId, setAddId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [edit, setEdit] = useState<KitLine | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [owned, setOwned] = useState<OwnedAction>(null);
  const [ownedQty, setOwnedQty] = useState("1");
  const [busy, setBusy] = useState(false);

  const lines = useMemo(() => kitLines(rows.data ?? [], items.data ?? [], guests), [rows.data, items.data, guests]);
  const sum = kitSummary(lines);
  const onList = new Set(lines.map((l) => l.item.id));
  const addable = (items.data ?? []).filter((i) => i.active && !onList.has(i.id));
  const returnLines = lines.filter((l) => l.reusable && l.packed > 0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["event-kit", eventId] });
    qc.invalidateQueries({ queryKey: ["today-data"] });
  };

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("event_kit_items").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const runTemplate = async () => {
    setBusy(true);
    try {
      const n = await applyTemplate(eventId, template, items.data ?? [], rows.data ?? []);
      toast.success(n ? `${n} item${n === 1 ? "" : "s"} added` : "Nothing new to add from this template");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  const addItem = async () => {
    const item = items.data?.find((i) => i.id === addId);
    if (!item) return toast.error("Pick an item");
    const q = addQty.trim() === "" ? null : Math.max(0, Math.round(Number(addQty) || 0));
    const usePerGuest = q == null && item.per_guest != null && Number(item.per_guest) > 0;
    const { error } = await supabase.from("event_kit_items").insert({
      event_id: eventId,
      kit_item_id: item.id,
      source: "manual",
      base_quantity: usePerGuest ? null : (q ?? 1),
      sort_order: lines.length + 1,
    });
    if (error) return toast.error(error.message);
    toast.success(`${item.name} added`);
    setAddId("");
    setAddQty("");
    setAddOpen(false);
    refresh();
  };

  const openEdit = (l: KitLine) => {
    setEdit(l);
    setEditQty(String(l.required));
    setEditNotes(l.row.notes ?? "");
  };

  const saveEdit = async () => {
    if (!edit) return;
    const q = Math.max(0, Math.round(Number(editQty) || 0));
    const override = q === edit.calculated && !edit.overridden ? null : q;
    await update(edit.row.id, { quantity_override: override, notes: editNotes.trim() || null });
    setEdit(null);
  };

  const removeLine = async () => {
    if (!edit) return;
    const { error } = await supabase.from("event_kit_items").delete().eq("id", edit.row.id);
    if (error) return toast.error(error.message);
    toast.success("Removed from this event");
    setEdit(null);
    refresh();
  };

  const confirmOwned = async () => {
    if (!owned) return;
    const n = Math.max(0, Math.round(Number(ownedQty) || 0));
    const current = owned.line.item.owned_quantity ?? 0;
    const next = owned.kind === "add" ? current + n : Math.max(0, current - n);
    const { error } = await supabase.from("kit_items").update({ owned_quantity: next }).eq("id", owned.line.item.id);
    if (error) return toast.error(error.message);
    toast.success(`You now own ${next} × ${owned.line.item.name}`);
    setOwned(null);
    qc.invalidateQueries({ queryKey: ["kit-items"] });
    qc.invalidateQueries({ queryKey: ["today-data"] });
  };

  if (items.isLoading || rows.isLoading) return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;

  return (
    <div className="pb-6">
      <div className="font-display text-[26px] leading-none">Event Kit</div>
      <div className="mt-1 font-mono text-[11px] text-ink-soft">
        {guests > 0 ? `${guests} guests` : "Guest count not set"} · equipment, serveware, consumables
      </div>

      <TornCard className="mt-4 grid grid-cols-3 gap-2 px-4 py-3 shadow-card">
        <Stat label="Reusable" value={sum.reusable} />
        <Stat label="Consumables" value={sum.consumables} />
        <Stat label="To buy" value={sum.toBuy} flame={sum.toBuy > 0} />
      </TornCard>

      {(items.data ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyNote>Your kit library is empty.</EmptyNote>
          <Link to="/library/kit" className="mt-3 block">
            <GhostButton className="w-full">Set up Event Kit library</GhostButton>
          </Link>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <SelectInput value={template} onChange={(e) => setTemplate(e.target.value as TemplateKey)} className="flex-1">
            {KIT_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} template
              </option>
            ))}
          </SelectInput>
          <GhostButton disabled={busy} onClick={runTemplate} className="shrink-0">
            Add suggestions
          </GhostButton>
        </div>
      )}

      {KIT_CATEGORIES.map((c) => {
        const list = lines.filter((l) => l.category === c.value);
        if (!list.length) return null;
        return (
          <div key={c.value} className="mt-5">
            <SectionHeading title={c.plural} />
            <TornCard className="px-4 py-1 shadow-card">
              {list.map((l) => (
                <div key={l.row.id} className="border-b border-ink/10 py-2.5 last:border-0">
                  <button type="button" onClick={() => openEdit(l)} className="tap flex w-full items-start justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <div className="text-[14px] leading-tight">{l.item.name}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-ink-soft">
                        Required {l.required}
                        {l.reusable ? ` · Own ${l.owned}` : ""}
                        {l.perGuestRule && !l.overridden ? ` · ${Number(l.item.per_guest)}/guest` : ""}
                        {l.overridden ? " · set manually" : ""}
                      </div>
                      {l.row.notes ? <div className="font-mono text-[11px] text-ink-soft">{l.row.notes}</div> : null}
                    </div>
                    {l.reusable ? (
                      <span className={`label-mono shrink-0 ${l.toBuy > 0 ? "text-flame" : "text-s-conf"}`}>
                        {l.toBuy > 0 ? `Buy ${l.toBuy}` : "Ready"}
                      </span>
                    ) : null}
                  </button>
                  {l.reusable && l.toBuy > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOwned({ line: l, delta: l.toBuy, kind: "add" });
                        setOwnedQty(String(l.toBuy));
                      }}
                      className="tap mt-2 border border-ink/30 px-2 py-1 font-mono text-[11px]"
                    >
                      Bought it? Add to owned kit
                    </button>
                  ) : null}
                  {!l.reusable ? (
                    <div className="mt-2 flex gap-1.5">
                      {PURCHASE_STATUSES.map((p) => (
                        <Chip
                          key={p.value}
                          active={l.row.purchase_status === p.value}
                          onClick={() => update(l.row.id, { purchase_status: p.value as PurchaseStatus })}
                          className="min-h-[30px] px-2 py-1 text-[10px]"
                        >
                          {p.label}
                        </Chip>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </TornCard>
          </div>
        );
      })}

      {lines.length === 0 && (items.data ?? []).length > 0 ? (
        <div className="mt-4">
          <EmptyNote>No kit on this event yet. Add template suggestions or add items one by one.</EmptyNote>
        </div>
      ) : null}

      {(items.data ?? []).length > 0 ? (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="tap mt-4 w-full border border-ink bg-ink px-4 py-3 text-center font-semibold text-cream"
        >
          + Add item
        </button>
      ) : null}

      {returnLines.length ? (
        <div className="mt-6">
          <SectionHeading title="Return check" />
          <p className="mb-2 font-mono text-[11px] text-ink-soft">Reusable kit only. Count what came back.</p>
          <TornCard className="px-4 py-1 shadow-card">
            {returnLines.map((l) => {
              const ret = l.returned ?? 0;
              const complete = l.returned != null && l.missing === 0;
              return (
                <div key={l.row.id} className="border-b border-ink/10 py-2.5 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[14px] leading-tight">{l.item.name}</div>
                      <div className="font-mono text-[11px] text-ink-soft">Packed out {l.packed}</div>
                    </div>
                    <Stepper
                      value={ret}
                      total={l.packed}
                      label={l.item.name}
                      onChange={(n) => update(l.row.id, { returned_quantity: n })}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span
                      className={`label-mono ${complete ? "text-s-conf" : l.returned == null ? "text-ink-soft" : "text-flame"}`}
                    >
                      {l.returned == null ? "Not checked" : complete ? "Complete" : `${l.missing} missing`}
                    </span>
                    <div className="flex gap-1.5">
                      {!complete ? (
                        <button
                          type="button"
                          onClick={() => update(l.row.id, { returned_quantity: l.packed })}
                          className="tap border border-ink/30 px-2 py-1 font-mono text-[11px]"
                        >
                          All back
                        </button>
                      ) : null}
                      {l.missing > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setOwned({ line: l, delta: l.missing, kind: "missing" });
                            setOwnedQty(String(l.missing));
                          }}
                          className="tap border border-flame/50 px-2 py-1 font-mono text-[11px] text-flame"
                        >
                          Adjust owned quantity
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </TornCard>
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Link to="/events/$eventId" params={{ eventId }} search={{ s: "packing" }} replace className="flex-1">
          <GhostButton className="w-full">Packing →</GhostButton>
        </Link>
        <Link to="/library/kit" className="flex-1">
          <GhostButton className="w-full">Kit library →</GhostButton>
        </Link>
      </div>

      {/* Add item */}
      <Drawer open={addOpen} onOpenChange={setAddOpen} shouldScaleBackground={false}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto w-full max-w-md px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">Add kit item</DrawerTitle>
            <div className="mt-3 space-y-3 pb-3">
              <Field label="Item">
                <SelectInput value={addId} onChange={(e) => setAddId(e.target.value)}>
                  <option value="">Choose…</option>
                  {KIT_CATEGORIES.map((c) => (
                    <optgroup key={c.value} label={c.plural}>
                      {addable
                        .filter((i) => i.category === c.value)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </SelectInput>
              </Field>
              <Field
                label="Required quantity"
                hint={(() => {
                  const it = items.data?.find((i) => i.id === addId);
                  return it?.per_guest ? `Blank = ${Number(it.per_guest)} per guest` : undefined;
                })()}
              >
                <TextInput type="number" inputMode="numeric" min={0} value={addQty} onChange={(e) => setAddQty(e.target.value)} />
              </Field>
            </div>
            <div className="space-y-2 pb-3">
              <PrimaryButton onClick={addItem}>Add item</PrimaryButton>
              <GhostButton className="w-full" onClick={() => setAddOpen(false)}>
                Cancel
              </GhostButton>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Edit line */}
      <Drawer open={!!edit} onOpenChange={(o) => !o && setEdit(null)} shouldScaleBackground={false}>
        <DrawerContent className="bg-paper border-ink/10">
          {edit ? (
            <div className="mx-auto w-full max-w-md px-5 pb-safe pt-2">
              <DrawerTitle className="font-display text-[24px] leading-none">{edit.item.name}</DrawerTitle>
              <div className="mt-1 font-mono text-[11px] text-ink-soft">
                {edit.row.source === "template" ? "From template" : "Added manually"}
                {edit.perGuestRule ? ` · calculated ${edit.calculated} (${Number(edit.item.per_guest)} per guest)` : ""}
              </div>
              <div className="mt-3 space-y-3 pb-3">
                <Field label="Required quantity">
                  <TextInput type="number" inputMode="numeric" min={0} value={editQty} onChange={(e) => setEditQty(e.target.value)} />
                </Field>
                {edit.overridden ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await update(edit.row.id, { quantity_override: null });
                      setEdit(null);
                    }}
                    className="tap font-mono text-[11px] text-flame underline"
                  >
                    Reset to calculated ({edit.calculated})
                  </button>
                ) : null}
                <Field label="Notes">
                  <TextInput value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                </Field>
                <button
                  type="button"
                  onClick={removeLine}
                  className="tap w-full border border-flame/50 px-3 py-2 font-mono text-[12px] text-flame"
                >
                  Remove from this event
                </button>
              </div>
              <div className="space-y-2 pb-3">
                <PrimaryButton onClick={saveEdit}>Save</PrimaryButton>
                <GhostButton className="w-full" onClick={() => setEdit(null)}>
                  Cancel
                </GhostButton>
              </div>
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>

      {/* Owned quantity confirmation */}
      <AlertDialog open={!!owned} onOpenChange={(o) => !o && setOwned(null)}>
        <AlertDialogContent>
          {owned ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {owned.kind === "add" ? "Add to owned kit?" : "Adjust owned quantity?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {owned.line.item.name} — you currently own {owned.line.item.owned_quantity ?? 0}.{" "}
                  {owned.kind === "add"
                    ? "Only do this once you've actually bought it."
                    : "Only do this if the items are really gone. This changes your Library."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Field label={owned.kind === "add" ? "Bought" : "Remove from owned"}>
                <TextInput type="number" inputMode="numeric" min={0} value={ownedQty} onChange={(e) => setOwnedQty(e.target.value)} />
              </Field>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmOwned}>
                  {owned.kind === "add"
                    ? `Add ${Math.max(0, Math.round(Number(ownedQty) || 0))} to owned kit`
                    : `Reduce owned by ${Math.max(0, Math.round(Number(ownedQty) || 0))}`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, flame }: { label: string; value: number; flame?: boolean }) {
  return (
    <div>
      <div className={`font-display text-[22px] leading-none ${flame ? "text-flame" : ""}`}>{value}</div>
      <div className="label-mono mt-1 text-ink-soft">{label}</div>
    </div>
  );
}

export { purchaseLabel };
