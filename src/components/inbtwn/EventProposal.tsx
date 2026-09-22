import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { Field, TextInput, TextArea, PrimaryButton, GhostButton, EmptyNote } from "@/components/inbtwn/bits";
import { recipesQuery, type RecipeWithVersion } from "@/lib/recipe-queries";
import { proposalQuery, type ProposalSection } from "@/lib/commercial";
import { menuItemsQuery, portionQuantity } from "@/lib/menu-queries";
import type { BaseUnit } from "@/lib/units";

export function EventProposal({ eventId, confirmed }: { eventId: string; confirmed: boolean }) {
  const qc = useQueryClient();
  const proposal = useQuery(proposalQuery(eventId));
  const recipes = useQuery(recipesQuery);
  const menu = useQuery(menuItemsQuery(eventId));

  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionNotes, setSectionNotes] = useState("");

  const [dishFor, setDishFor] = useState<ProposalSection | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<RecipeWithVersion | null>(null);
  const [freeText, setFreeText] = useState("");
  const [dishNote, setDishNote] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollY = useRef<number | null>(null);

  const sections = proposal.data ?? [];
  const list = recipes.data ?? [];
  const filtered = useMemo(() => {
    const candidates = list.filter((r) => r.category !== "Component");
    const q = search.trim().toLowerCase();
    if (!q) return candidates.slice(0, 40);
    return candidates.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 40);
  }, [list, search]);

  const remember = () => {
    scrollY.current = window.scrollY;
  };
  const restore = () => {
    const y = scrollY.current;
    scrollY.current = null;
    if (y !== null) requestAnimationFrame(() => window.scrollTo({ top: y }));
  };

  const resetDish = () => {
    setSearch("");
    setPicked(null);
    setFreeText("");
    setDishNote("");
  };

  const addSection = async () => {
    const name = sectionName.trim();
    if (!name) {
      toast.error("Give the section a name");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("event_proposal_sections").insert({
      event_id: eventId,
      name,
      notes: sectionNotes.trim() || null,
      sort_order: sections.length + 1,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["proposal", eventId] });
    setSectionName("");
    setSectionNotes("");
    setSectionOpen(false);
    restore();
  };

  const removeSection = async (s: ProposalSection) => {
    const { error } = await supabase.from("event_proposal_sections").delete().eq("id", s.id);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["proposal", eventId] });
    await qc.invalidateQueries({ queryKey: ["pricing", eventId] });
    toast.success("Section removed");
  };

  const addDish = async (mode: "close" | "another") => {
    if (!dishFor) return;
    const name = picked ? picked.name : freeText.trim();
    if (!name) {
      toast.error("Pick a recipe or type a dish name");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("event_proposal_items").insert({
      event_id: eventId,
      section_id: dishFor.id,
      recipe_id: picked?.id ?? null,
      name,
      notes: dishNote.trim() || null,
      sort_order: dishFor.items.length + 1,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["proposal", eventId] });
    toast.success(`${name} added`);
    if (mode === "another") {
      resetDish();
      const fresh = (qc.getQueryData(["proposal", eventId]) as ProposalSection[] | undefined)?.find(
        (s) => s.id === dishFor.id,
      );
      if (fresh) setDishFor(fresh);
    } else {
      setDishFor(null);
      resetDish();
      restore();
    }
  };

  const removeDish = async (id: string) => {
    const { error } = await supabase.from("event_proposal_items").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["proposal", eventId] });
  };

  const addToMenu = async (recipeId: string, name: string) => {
    const recipe = list.find((r) => r.id === recipeId);
    if (!recipe) return void toast.error("Recipe not found in the library");
    if ((menu.data ?? []).some((m) => m.recipe_id === recipeId)) {
      return void toast.error(`${name} is already on the event menu`);
    }
    const portion = recipe.active_version?.default_portion_quantity;
    const base = ((recipe.active_version?.base_yield_unit as BaseUnit) ?? "g");
    const { error } = await supabase.from("event_menu_items").insert({
      event_id: eventId,
      recipe_id: recipe.id,
      recipe_version_id: recipe.active_version_id,
      portion_size: "medium",
      quantity_per_guest: portionQuantity(portion != null ? Number(portion) : null, "medium"),
      quantity_unit: base,
      sort_order: (menu.data?.length ?? 0) + 1,
    });
    if (error) return void toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["event-menu", eventId] });
    toast.success(`${name} added to the event menu`);
  };

  return (
    <div className="pb-8">
      <div className="border border-ink/15 bg-cream px-4 py-4">
        <div className="font-display text-[26px] leading-none">PROPOSAL</div>
        <div className="mt-1.5 font-mono text-[12px] text-ink-soft">
          Menu ideas for the client. Nothing here affects production, shopping or packing.
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          remember();
          setSectionOpen(true);
        }}
        className="tap mt-3 w-full border border-ink bg-ink px-4 py-3 text-center font-semibold text-cream"
      >
        + Add menu section
      </button>

      <div className="mt-5 space-y-5">
        {proposal.isLoading ? <p className="font-mono text-[12px] text-ink-soft">Loading…</p> : null}
        {!proposal.isLoading && sections.length === 0 ? (
          <EmptyNote>No proposal sections yet. Add one such as “BBQ” or “Indian Buffet”.</EmptyNote>
        ) : null}

        {sections.map((s) => (
          <div key={s.id} className="border border-ink/15 bg-cream">
            <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-4 py-3">
              <div>
                <div className="font-display text-[20px] leading-none">{s.name}</div>
                {s.notes ? <div className="mt-1 font-mono text-[11px] text-ink-soft">{s.notes}</div> : null}
              </div>
              <button
                type="button"
                onClick={() => removeSection(s)}
                className="shrink-0 font-mono text-[11px] text-flame underline"
              >
                Remove
              </button>
            </div>

            <div className="divide-y divide-ink/10">
              {s.items.length === 0 ? (
                <div className="px-4 py-3 font-mono text-[11px] text-ink-soft">No dishes yet.</div>
              ) : null}
              {s.items.map((it) => (
                <div key={it.id} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-words font-medium">{it.name}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-ink-soft">
                        {it.recipe_id ? it.recipe?.category ?? "Recipe" : "Free text — no recipe linked"}
                      </div>
                      {it.notes ? (
                        <div className="mt-0.5 font-mono text-[10px] text-ink-soft">{it.notes}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDish(it.id)}
                      className="shrink-0 font-mono text-[11px] text-ink-soft underline"
                    >
                      Remove
                    </button>
                  </div>
                  {confirmed ? (
                    it.recipe_id ? (
                      <button
                        type="button"
                        onClick={() => addToMenu(it.recipe_id as string, it.name)}
                        className="tap mt-2 w-full border border-ink/25 bg-paper px-3 py-2 font-mono text-[11px] text-ink"
                      >
                        Add to event menu
                      </button>
                    ) : (
                      <div className="mt-2 border border-flame/40 px-3 py-2 font-mono text-[10px] text-flame">
                        Needs a Recipe Library recipe before production can be calculated.
                      </div>
                    )
                  ) : null}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                remember();
                resetDish();
                setDishFor(s);
              }}
              className="tap w-full border-t border-ink/15 px-4 py-2.5 text-left font-mono text-[12px] text-flame"
            >
              + Add dish
            </button>
          </div>
        ))}
      </div>

      {/* Add section sheet */}
      <Drawer open={sectionOpen} onOpenChange={(o) => { if (!o) { setSectionOpen(false); restore(); } }} shouldScaleBackground={false}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">Add menu section</DrawerTitle>
            <div className="mt-3 space-y-3">
              <Field label="Section name" required>
                <TextInput value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="BBQ" />
              </Field>
              <Field label="Note (optional)">
                <TextArea value={sectionNotes} onChange={(e) => setSectionNotes(e.target.value)} className="min-h-[64px]" />
              </Field>
            </div>
            <div className="-mx-5 mt-4 grid grid-cols-2 gap-2 border-t border-ink/10 px-5 py-3">
              <GhostButton type="button" onClick={() => { setSectionOpen(false); restore(); }}>
                Cancel
              </GhostButton>
              <PrimaryButton type="button" disabled={busy} onClick={addSection}>
                Add section
              </PrimaryButton>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Add dish sheet */}
      <Drawer open={Boolean(dishFor)} onOpenChange={(o) => { if (!o) { setDishFor(null); restore(); } }} shouldScaleBackground={false}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">
              Add dish{dishFor ? ` — ${dishFor.name}` : ""}
            </DrawerTitle>
            <div className="mt-3 space-y-3 overflow-y-auto pb-3">
              <Field label="From the Recipe Library">
                <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recipes" />
              </Field>
              <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
                {filtered.map((r) => {
                  const sel = picked?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setPicked(sel ? null : r);
                        if (!sel) setFreeText("");
                      }}
                      className={`tap flex w-full items-center justify-between gap-3 border px-3 py-2.5 text-left ${
                        sel ? "border-ink bg-ink text-cream" : "border-ink/15 bg-cream text-ink"
                      }`}
                    >
                      <span className="text-[14px]">{r.name}</span>
                      <span className={`font-mono text-[11px] ${sel ? "text-cream/80" : "text-ink-soft"}`}>
                        {r.category}
                      </span>
                    </button>
                  );
                })}
                {filtered.length === 0 ? <EmptyNote>No recipes match.</EmptyNote> : null}
              </div>

              <Field label="Or propose a dish that has no recipe yet">
                <TextInput
                  value={freeText}
                  onChange={(e) => {
                    setFreeText(e.target.value);
                    if (e.target.value) setPicked(null);
                  }}
                  placeholder="e.g. Lamb Chops"
                />
              </Field>
              <Field label="Note (optional)">
                <TextInput value={dishNote} onChange={(e) => setDishNote(e.target.value)} placeholder="Served with mint yoghurt" />
              </Field>
            </div>
            <div className="-mx-5 mt-auto grid grid-cols-2 gap-2 border-t border-ink/10 bg-paper/95 px-5 py-3">
              <GhostButton type="button" onClick={() => { setDishFor(null); restore(); }}>
                Cancel
              </GhostButton>
              <PrimaryButton type="button" disabled={busy} onClick={() => addDish("close")}>
                Add dish
              </PrimaryButton>
              <GhostButton type="button" disabled={busy} onClick={() => addDish("another")} className="col-span-2">
                Add &amp; add another
              </GhostButton>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
