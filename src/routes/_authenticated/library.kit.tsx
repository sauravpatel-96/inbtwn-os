import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { PageTitle, SectionHeading, TornCard, EmptyNote, Field, TextInput, SelectInput, PrimaryButton, GhostButton, Chip } from "@/components/inbtwn/bits";
import { KIT_CATEGORIES, KIT_TEMPLATES, isReusable, kitItemsQuery, type KitCategory, type KitItemRow } from "@/lib/kit";

export const Route = createFileRoute("/_authenticated/library/kit")({
  head: () => ({
    meta: [
      { title: "Event Kit — INBTWN OS" },
      { name: "description", content: "Equipment, reusable serveware and consumables you take to events." },
      { property: "og:title", content: "Event Kit — INBTWN OS" },
      { property: "og:description", content: "What you own and what you take to events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KitLibraryPage,
});

type Draft = {
  name: string;
  category: KitCategory;
  unit: string;
  notes: string;
  owned: string;
  perGuest: string;
  active: boolean;
  tpl: Record<string, string>; // "" = not included, "0" = per guest, n = fixed
};

const empty = (): Draft => ({
  name: "",
  category: "equipment",
  unit: "each",
  notes: "",
  owned: "0",
  perGuest: "",
  active: true,
  tpl: { buffet: "", drop_off: "", table: "" },
});

function KitLibraryPage() {
  const qc = useQueryClient();
  const items = useQuery(kitItemsQuery);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KitItemRow | null>(null);
  const [d, setD] = useState<Draft>(empty());
  const [showInactive, setShowInactive] = useState(false);

  const openSheet = (i?: KitItemRow) => {
    if (i) {
      setEditing(i);
      setD({
        name: i.name,
        category: i.category as KitCategory,
        unit: i.unit,
        notes: i.notes ?? "",
        owned: String(i.owned_quantity ?? 0),
        perGuest: i.per_guest == null ? "" : String(Number(i.per_guest)),
        active: i.active,
        tpl: Object.fromEntries(KIT_TEMPLATES.map((t) => [t.key, i[t.column] == null ? "" : String(i[t.column])])),
      });
    } else {
      setEditing(null);
      setD(empty());
    }
    setOpen(true);
  };

  const save = async () => {
    if (!d.name.trim()) return toast.error("Give the item a name");
    const reusable = isReusable(d.category);
    const int = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s) || 0)));
    const payload = {
      name: d.name.trim(),
      category: d.category,
      unit: d.unit.trim() || "each",
      notes: d.notes.trim() || null,
      active: d.active,
      owned_quantity: reusable ? (int(d.owned) ?? 0) : null,
      per_guest: !reusable && d.perGuest.trim() !== "" ? Math.max(0, Number(d.perGuest) || 0) : null,
      template_buffet: int(d.tpl.buffet ?? ""),
      template_drop_off: int(d.tpl.drop_off ?? ""),
      template_table: int(d.tpl.table ?? ""),
    };
    const { error } = editing
      ? await supabase.from("kit_items").update(payload).eq("id", editing.id)
      : await supabase.from("kit_items").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Saved" : `${payload.name} added`);
    qc.invalidateQueries({ queryKey: ["kit-items"] });
    setOpen(false);
  };

  const list = (items.data ?? []).filter((i) => showInactive || i.active);
  const reusable = isReusable(d.category);

  return (
    <div>
      <PageTitle title="Event Kit" aside="library" />
      <p className="mb-3 font-mono text-[11px] text-ink-soft">
        What you own and take to events. Buffet is your normal set-up; templates are just starting points.
      </p>
      <PrimaryButton onClick={() => openSheet()}>+ Add kit item</PrimaryButton>
      <div className="mt-3">
        <Chip active={showInactive} onClick={() => setShowInactive((s) => !s)}>
          Show inactive
        </Chip>
      </div>
      {items.isLoading ? (
        <p className="mt-4 font-mono text-[12px] text-ink-soft">Loading…</p>
      ) : list.length === 0 ? (
        <div className="mt-4">
          <EmptyNote>No kit yet. Add your buffet units, leads, serving spoons, plates and napkins.</EmptyNote>
        </div>
      ) : (
        KIT_CATEGORIES.map((c) => {
          const rows = list.filter((i) => i.category === c.value);
          if (!rows.length) return null;
          return (
            <div key={c.value} className="mt-5">
              <SectionHeading title={c.plural} />
              <TornCard className="px-4 py-1 shadow-card">
                {rows.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => openSheet(i)}
                    className={`tap flex w-full items-center justify-between gap-3 border-b border-ink/10 py-2.5 text-left last:border-0 ${
                      i.active ? "" : "opacity-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] leading-tight">{i.name}</div>
                      <div className="font-mono text-[11px] text-ink-soft">
                        {KIT_TEMPLATES.filter((t) => i[t.column] != null)
                          .map((t) => t.label.split(" ")[0])
                          .join(" · ") || "No template"}
                        {i.active ? "" : " · inactive"}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[13px]">
                      {isReusable(i.category)
                        ? `Own ${i.owned_quantity ?? 0}`
                        : i.per_guest != null
                          ? `${Number(i.per_guest)}/guest`
                          : i.unit}
                    </span>
                  </button>
                ))}
              </TornCard>
            </div>
          );
        })
      )}

      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">{editing ? "Edit kit item" : "Add kit item"}</DrawerTitle>
            <div className="mt-3 space-y-3 overflow-y-auto pb-3">
              <Field label="Name" required>
                <TextInput value={d.name} placeholder="Electric buffet unit" onChange={(e) => setD({ ...d, name: e.target.value })} />
              </Field>
              <Field label="Category">
                <SelectInput value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as KitCategory })}>
                  {KIT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unit">
                  <TextInput value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value })} />
                </Field>
                {reusable ? (
                  <Field label="Own">
                    <TextInput type="number" inputMode="numeric" min={0} value={d.owned} onChange={(e) => setD({ ...d, owned: e.target.value })} />
                  </Field>
                ) : (
                  <Field label="Per guest" hint="optional">
                    <TextInput
                      type="number"
                      inputMode="decimal"
                      step="0.05"
                      min={0}
                      placeholder="1.1"
                      value={d.perGuest}
                      onChange={(e) => setD({ ...d, perGuest: e.target.value })}
                    />
                  </Field>
                )}
              </div>
              <Field label="Notes">
                <TextInput value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
              </Field>
              <div>
                <div className="label-mono mb-1.5 text-ink-soft">Templates · blank = not included</div>
                <div className="grid grid-cols-3 gap-2">
                  {KIT_TEMPLATES.map((t) => (
                    <Field key={t.key} label={t.label.split(" ")[0]!}>
                      <TextInput
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="—"
                        value={d.tpl[t.key] ?? ""}
                        onChange={(e) => setD({ ...d, tpl: { ...d.tpl, [t.key]: e.target.value } })}
                      />
                    </Field>
                  ))}
                </div>
                {!reusable ? (
                  <p className="mt-1 font-mono text-[10px] text-ink-soft">Enter 0 to use the per-guest rule.</p>
                ) : null}
              </div>
              <label className="flex items-center gap-2 font-mono text-[12px]">
                <input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} />
                Active
              </label>
            </div>
            <div className="space-y-2 pb-3">
              <PrimaryButton onClick={save}>{editing ? "Save" : "Add item"}</PrimaryButton>
              <GhostButton className="w-full" onClick={() => setOpen(false)}>
                Cancel
              </GhostButton>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
