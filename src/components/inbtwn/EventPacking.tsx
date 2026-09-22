import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import {
  SectionHeading,
  TornCard,
  EmptyNote,
  Chip,
  Field,
  TextInput,
  SelectInput,
  PrimaryButton,
  GhostButton,
} from "@/components/inbtwn/bits";
import { graphQuery } from "@/lib/recipe-queries";
import { menuItemsQuery } from "@/lib/menu-queries";
import { versionBuffersQuery } from "@/lib/production";
import {
  PACKING_CATEGORIES,
  packingCategoryLabel,
  packingItemsQuery,
  packingChecksQuery,
  foodLinesFromProduction,
  manualKey,
  type PackingCategory,
  type PackingItemRow,
} from "@/lib/packing";
import { scaleVersion, type ScaleResult } from "@/lib/recipe-calc";
import type { BaseUnit } from "@/lib/units";

type Filter = "all" | "topack" | "packed";

type Row = {
  key: string;
  name: string;
  quantity: string;
  manual: PackingItemRow | null;
};

function PackRow({
  row,
  packed,
  onToggle,
  onEdit,
}: {
  row: Row;
  packed: boolean;
  onToggle: () => void;
  onEdit?: (() => void) | undefined;
}) {
  return (
    <div className="flex items-center border-b border-ink/10 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={packed}
        aria-label={`${packed ? "Unpack" : "Pack"} ${row.name}`}
        className="tap -ml-2 flex size-11 shrink-0 items-center justify-center"
      >
        <span
          className={`flex size-[22px] items-center justify-center border text-[12px] leading-none ${
            packed ? "border-ink bg-ink text-cream" : "border-ink/40 bg-paper"
          }`}
        >
          {packed ? "✓" : ""}
        </span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        className={`tap flex min-h-[40px] flex-1 items-center justify-between gap-3 py-1 text-left ${
          packed ? "text-ink-soft line-through opacity-60" : ""
        }`}
      >
        <span className="text-[14px] leading-tight">{row.name}</span>
        <span className="shrink-0 text-right font-mono text-[14px]">{row.quantity}</span>
      </button>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="tap ml-2 shrink-0 font-mono text-[11px] text-flame underline"
        >
          Edit
        </button>
      ) : null}
    </div>
  );
}

export function EventPacking({ eventId, guestCount }: { eventId: string; guestCount: number | null }) {
  const qc = useQueryClient();
  const menu = useQuery(menuItemsQuery(eventId));
  const graph = useQuery(graphQuery);
  const buffers = useQuery(versionBuffersQuery);
  const manual = useQuery(packingItemsQuery(eventId));
  const checks = useQuery(packingChecksQuery(eventId));

  const [filter, setFilter] = useState<Filter>("topack");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PackingItemRow | null>(null);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [category, setCategory] = useState<PackingCategory>("equipment");
  const [saving, setSaving] = useState(false);
  const scrollY = useRef<number | null>(null);

  const guests = guestCount ?? 0;

  const food = useMemo<Row[]>(() => {
    if (!graph.data || !menu.data) return [];
    const rows: Row[] = [];
    const seen = new Set<string>();
    for (const item of menu.data) {
      const perGuest = Number(item.quantity_per_guest ?? 0);
      const versionId = item.recipe_version_id ?? item.recipe?.active_version_id ?? null;
      if (!versionId || guests <= 0 || perGuest <= 0) continue;
      const buffer = buffers.data?.[versionId] ?? 0;
      const target = guests * perGuest * (1 + buffer / 100);
      let result: ScaleResult | null = null;
      try {
        result = scaleVersion(versionId, target, graph.data);
      } catch {
        result = null;
      }
      if (!result) continue;
      const base = (item.quantity_unit as BaseUnit) ?? "g";
      for (const line of foodLinesFromProduction(item.recipe?.name ?? "Recipe", versionId, base, result)) {
        if (seen.has(line.key)) continue;
        seen.add(line.key);
        rows.push({ key: line.key, name: line.name, quantity: line.quantity, manual: null });
      }
    }
    return rows;
  }, [menu.data, graph.data, buffers.data, guests]);

  const manualRows = manual.data ?? [];
  const packedSet = useMemo(() => new Set(checks.data ?? []), [checks.data]);

  const groups = useMemo(() => {
    const byCategory: { title: string; rows: Row[] }[] = [{ title: "Food", rows: food }];
    for (const c of PACKING_CATEGORIES) {
      const rows = manualRows
        .filter((m) => m.category === c.value)
        .map<Row>((m) => ({
          key: manualKey(m.id),
          name: m.name,
          quantity: String(m.quantity),
          manual: m,
        }));
      byCategory.push({ title: c.label, rows });
    }
    return byCategory;
  }, [food, manualRows]);

  const allRows = groups.flatMap((g) => g.rows);
  const packedCount = allRows.filter((r) => packedSet.has(r.key)).length;

  const show = (r: Row) => {
    const done = packedSet.has(r.key);
    return filter === "all" ? true : filter === "packed" ? done : !done;
  };
  const visibleGroups = groups
    .map((g) => ({ ...g, rows: g.rows.filter(show) }))
    .filter((g) => g.rows.length > 0);

  const toggle = async (row: Row) => {
    const done = packedSet.has(row.key);
    const { error } = done
      ? await supabase
          .from("event_packing_checks")
          .delete()
          .eq("event_id", eventId)
          .eq("item_key", row.key)
      : await supabase.from("event_packing_checks").insert({ event_id: eventId, item_key: row.key });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["event-packing-checks", eventId] });
  };

  const resetFields = () => {
    setName("");
    setQty("1");
    setCategory("equipment");
  };

  const openSheet = (item?: PackingItemRow) => {
    scrollY.current = window.scrollY;
    if (item) {
      setEditing(item);
      setName(item.name);
      setQty(String(item.quantity));
      setCategory(item.category as PackingCategory);
    } else {
      setEditing(null);
      resetFields();
    }
    setOpen(true);
  };

  const closeSheet = () => {
    setOpen(false);
    setEditing(null);
    resetFields();
    const y = scrollY.current;
    scrollY.current = null;
    if (y !== null) requestAnimationFrame(() => window.scrollTo({ top: y }));
  };

  const save = async (mode: "close" | "another") => {
    const trimmed = name.trim();
    const quantity = Math.max(1, Math.round(Number(qty) || 0));
    if (!trimmed) {
      toast.error("Give the item a name");
      return;
    }
    setSaving(true);
    const { error } = editing
      ? await supabase
          .from("event_packing_items")
          .update({ name: trimmed, quantity, category })
          .eq("id", editing.id)
      : await supabase.from("event_packing_items").insert({
          event_id: eventId,
          name: trimmed,
          quantity,
          category,
          sort_order: manualRows.length + 1,
        });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["event-packing-items", eventId] });
    toast.success(editing ? "Item updated" : `${trimmed} added`);
    if (mode === "another" && !editing) {
      resetFields();
    } else {
      closeSheet();
    }
  };

  const remove = async () => {
    if (!editing) return;
    const { error } = await supabase.from("event_packing_items").delete().eq("id", editing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase
      .from("event_packing_checks")
      .delete()
      .eq("event_id", eventId)
      .eq("item_key", manualKey(editing.id));
    await qc.invalidateQueries({ queryKey: ["event-packing-items", eventId] });
    await qc.invalidateQueries({ queryKey: ["event-packing-checks", eventId] });
    toast.success("Item removed");
    closeSheet();
  };

  if (menu.isLoading || graph.isLoading || buffers.isLoading || manual.isLoading)
    return <p className="font-mono text-[12px] text-ink-soft">Loading…</p>;

  return (
    <div className="pb-6">
      <div>
        <div className="font-display text-[26px] leading-none">Packing</div>
        <div className="mt-1 font-mono text-[11px] text-ink-soft">
          {guests > 0 ? `${guests} guests` : "Guest count not set"}
        </div>
      </div>

      <TornCard className="mt-4 px-4 py-3 shadow-card">
        <div className="font-mono text-[13px]">
          {packedCount} / {allRows.length} items packed
        </div>
        <div className="mt-2 h-1.5 w-full bg-ink/10">
          <div
            className="h-full bg-ink"
            style={{ width: `${allRows.length ? (packedCount / allRows.length) * 100 : 0}%` }}
          />
        </div>
      </TornCard>

      <button
        type="button"
        onClick={() => openSheet()}
        className="tap mt-3 w-full border border-ink bg-ink px-4 py-3 text-center font-semibold text-cream"
      >
        + Add item
      </button>

      <div className="mt-3 flex gap-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Chip>
        <Chip active={filter === "topack"} onClick={() => setFilter("topack")}>
          To pack
        </Chip>
        <Chip active={filter === "packed"} onClick={() => setFilter("packed")}>
          Packed
        </Chip>
      </div>

      <div className="mt-4 space-y-5">
        {allRows.length === 0 ? (
          <EmptyNote>No packing items yet.</EmptyNote>
        ) : visibleGroups.length === 0 ? (
          <EmptyNote>{filter === "packed" ? "No items packed yet." : "Everything is packed."}</EmptyNote>
        ) : (
          visibleGroups.map((g) => (
            <div key={g.title}>
              <SectionHeading title={g.title} />
              <TornCard className="px-4 pb-4 pt-1 shadow-card">
                {g.rows.map((r) => (
                  <PackRow
                    key={r.key}
                    row={r}
                    packed={packedSet.has(r.key)}
                    onToggle={() => toggle(r)}
                    onEdit={r.manual ? () => openSheet(r.manual!) : undefined}
                  />
                ))}
              </TornCard>
            </div>
          ))
        )}
      </div>

      <Drawer
        open={open}
        onOpenChange={(o) => {
          if (!o) closeSheet();
        }}
        shouldScaleBackground={false}
      >
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">
              {editing ? "Edit item" : "Add item"}
            </DrawerTitle>
            <div className="mt-3 space-y-3 overflow-y-auto pb-3">
              <Field label="Item name" required>
                <TextInput
                  placeholder="Chafing dish"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Quantity">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </Field>
              <Field label="Category">
                <SelectInput
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PackingCategory)}
                >
                  {PACKING_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              {editing ? (
                <button
                  type="button"
                  onClick={remove}
                  className="tap w-full border border-flame/50 px-3 py-2 font-mono text-[12px] text-flame"
                >
                  Remove item
                </button>
              ) : null}
            </div>
            <div className="mt-1 space-y-2 pb-3">
              <PrimaryButton disabled={saving} onClick={() => save("close")}>
                {editing ? "Save item" : "Add item"}
              </PrimaryButton>
              {!editing ? (
                <GhostButton className="w-full" disabled={saving} onClick={() => save("another")}>
                  Add &amp; add another
                </GhostButton>
              ) : null}
              <GhostButton className="w-full" onClick={closeSheet}>
                Cancel
              </GhostButton>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
