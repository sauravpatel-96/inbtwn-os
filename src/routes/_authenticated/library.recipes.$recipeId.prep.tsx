import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  PageTitle,
  SectionHeading,
  TornCard,
  EmptyNote,
  Field,
  TextInput,
  SelectInput,
  TextArea,
  PrimaryButton,
  GhostButton,
} from "@/components/inbtwn/bits";
import { graphQuery, recipeQuery } from "@/lib/recipe-queries";
import {
  ASSIGNMENTS,
  STORAGE_OPTIONS,
  assignmentLabel,
  daysBeforeLabel,
  fmtMinutes,
  prepStepsQuery,
  type PrepStepRow,
} from "@/lib/prep";

export const Route = createFileRoute("/_authenticated/library/recipes/$recipeId/prep")({
  head: () => ({
    meta: [
      { title: "Prep & production — INBTWN OS" },
      { name: "description", content: "Internal prep planning for a recipe: make-ahead, storage and prep steps." },
      { property: "og:title", content: "Prep & production — INBTWN OS" },
      { property: "og:description", content: "Kitchen prep plan for a recipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecipePrepPage,
});

type Draft = {
  name: string;
  target: "whole" | "component" | "none";
  component_recipe_id: string;
  recommended_days_before: string;
  approximate_minutes: string;
  default_assignment: string;
  can_do_earlier: boolean;
  can_freeze: boolean;
  defrost_lead_days: string;
  notes: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  target: "whole",
  component_recipe_id: "",
  recommended_days_before: "1",
  approximate_minutes: "",
  default_assignment: "me",
  can_do_earlier: false,
  can_freeze: false,
  defrost_lead_days: "",
  notes: "",
});

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="tap flex w-full items-center justify-between border border-ink/15 bg-cream px-3 py-2.5 text-left"
    >
      <span className="text-[14px]">{label}</span>
      <span
        className={`flex size-[22px] items-center justify-center border text-[12px] leading-none ${
          value ? "border-ink bg-ink text-cream" : "border-ink/40 bg-paper"
        }`}
      >
        {value ? "✓" : ""}
      </span>
    </button>
  );
}

function RecipePrepPage() {
  const { recipeId } = Route.useParams();
  const qc = useQueryClient();
  const recipe = useQuery(recipeQuery(recipeId));
  const graph = useQuery(graphQuery);
  const steps = useQuery(prepStepsQuery(recipeId));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PrepStepRow | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const scrollY = useRef<number | null>(null);

  const r = recipe.data;

  /** Component recipes reachable from the active version (for the step target). */
  const components = useMemo(() => {
    const out: { id: string; name: string }[] = [];
    const g = graph.data;
    const versionId = r?.active_version_id ?? null;
    if (!g || !versionId) return out;
    const seenVersions = new Set<string>();
    const seenRecipes = new Set<string>();
    const walk = (vid: string) => {
      if (seenVersions.has(vid)) return;
      seenVersions.add(vid);
      for (const c of g.versions[vid]?.components ?? []) {
        const child = g.versions[c.child_recipe_version_id];
        if (child && !seenRecipes.has(child.recipe_id)) {
          seenRecipes.add(child.recipe_id);
          out.push({ id: child.recipe_id, name: child.recipe_name });
        }
        walk(c.child_recipe_version_id);
      }
    };
    walk(versionId);
    return out;
  }, [graph.data, r?.active_version_id]);

  const componentName = (id: string | null) =>
    components.find((c) => c.id === id)?.name ?? "Component";

  const saveRecipeField = async (
    patch: Partial<Database["public"]["Tables"]["recipes"]["Update"]>,
  ) => {
    const { error } = await supabase.from("recipes").update(patch).eq("id", recipeId);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["recipes", recipeId] });
    qc.invalidateQueries({ queryKey: ["recipes"] });
  };

  const openSheet = (step?: PrepStepRow) => {
    scrollY.current = window.scrollY;
    if (step) {
      setEditing(step);
      setDraft({
        name: step.name,
        target: (step.target as Draft["target"]) ?? "whole",
        component_recipe_id: step.component_recipe_id ?? "",
        recommended_days_before: String(step.recommended_days_before),
        approximate_minutes: step.approximate_minutes == null ? "" : String(step.approximate_minutes),
        default_assignment: step.default_assignment,
        can_do_earlier: step.can_do_earlier,
        can_freeze: step.can_freeze,
        defrost_lead_days: step.defrost_lead_days == null ? "" : String(step.defrost_lead_days),
        notes: step.notes ?? "",
      });
    } else {
      setEditing(null);
      setDraft(emptyDraft());
    }
    setOpen(true);
  };

  const closeSheet = () => {
    setOpen(false);
    setEditing(null);
    setDraft(emptyDraft());
    const y = scrollY.current;
    scrollY.current = null;
    if (y !== null) requestAnimationFrame(() => window.scrollTo({ top: y }));
  };

  const saveStep = async (mode: "close" | "another") => {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the step a name");
      return;
    }
    if (draft.target === "component" && !draft.component_recipe_id) {
      toast.error("Choose which component this step is for");
      return;
    }
    const intOrNull = (v: string) => {
      const n = Number(v);
      return v.trim() === "" || Number.isNaN(n) ? null : Math.max(0, Math.round(n));
    };
    const payload = {
      recipe_id: recipeId,
      name,
      target: draft.target,
      component_recipe_id: draft.target === "component" ? draft.component_recipe_id : null,
      recommended_days_before: intOrNull(draft.recommended_days_before) ?? 0,
      approximate_minutes: intOrNull(draft.approximate_minutes),
      default_assignment: draft.default_assignment,
      can_do_earlier: draft.can_do_earlier,
      can_freeze: draft.can_freeze,
      defrost_lead_days: draft.can_freeze ? intOrNull(draft.defrost_lead_days) : null,
      notes: draft.notes.trim() || null,
      sort_order: editing ? editing.sort_order : (steps.data?.length ?? 0) + 1,
    };
    setSaving(true);
    const { error } = editing
      ? await supabase.from("recipe_prep_steps").update(payload).eq("id", editing.id)
      : await supabase.from("recipe_prep_steps").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["recipe-prep-steps", recipeId] });
    toast.success(editing ? "Step updated" : `${name} added`);
    if (mode === "another" && !editing) setDraft({ ...emptyDraft(), default_assignment: draft.default_assignment });
    else closeSheet();
  };

  const removeStep = async () => {
    if (!editing) return;
    const { error } = await supabase.from("recipe_prep_steps").delete().eq("id", editing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["recipe-prep-steps", recipeId] });
    toast.success("Step removed");
    closeSheet();
  };

  const move = async (step: PrepStepRow, dir: -1 | 1) => {
    const list = [...(steps.data ?? [])];
    const i = list.findIndex((s) => s.id === step.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = list[i]!;
    const b = list[j]!;
    await supabase.from("recipe_prep_steps").update({ sort_order: j + 1 }).eq("id", a.id);
    await supabase.from("recipe_prep_steps").update({ sort_order: i + 1 }).eq("id", b.id);
    qc.invalidateQueries({ queryKey: ["recipe-prep-steps", recipeId] });
  };

  if (recipe.isLoading) return <EmptyNote>Loading…</EmptyNote>;
  if (!r) return <EmptyNote>Recipe not found.</EmptyNote>;

  const list = steps.data ?? [];

  return (
    <div className="pb-8">
      <div className="mb-1">
        <Link to="/library/recipes/$recipeId" params={{ recipeId }} className="font-mono text-[11px] text-ink-soft">
          ← {r.name}
        </Link>
      </div>
      <PageTitle title="Prep & production" aside="Internal">
        <div className="mt-1 font-mono text-[11px] text-ink-soft">
          Never shown to clients on proposals, quotes or menus.
        </div>
      </PageTitle>

      <TornCard className="px-4 py-2 shadow-card">
        <Toggle
          label="Can be made ahead"
          value={r.can_make_ahead}
          onChange={(v) => saveRecipeField({ can_make_ahead: v })}
        />
        <div className="h-2" />
        <Toggle label="Freezes well" value={r.can_freeze} onChange={(v) => saveRecipeField({ can_freeze: v })} />
        <div className="mt-3 space-y-3 pb-3">
          <Field label="Default storage">
            <SelectInput
              value={r.default_storage ?? "none"}
              onChange={(e) => saveRecipeField({ default_storage: e.target.value })}
            >
              {STORAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Approximate active time" hint="minutes">
            <TextInput
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={r.approximate_active_minutes ?? ""}
              onBlur={(e) =>
                saveRecipeField({
                  approximate_active_minutes:
                    e.target.value.trim() === "" ? null : Math.max(0, Math.round(Number(e.target.value) || 0)),
                })
              }
            />
          </Field>
          <Field label="Operational notes">
            <TextArea
              defaultValue={r.operational_notes ?? ""}
              placeholder="Anything the kitchen needs to know when planning this dish."
              onBlur={(e) => saveRecipeField({ operational_notes: e.target.value.trim() || null })}
            />
          </Field>
        </div>
      </TornCard>

      <div className="mt-6">
        <SectionHeading title="Prep steps" />
        {list.length === 0 ? (
          <div className="border border-dashed border-ink/25 bg-cream px-4 py-5 text-center">
            <div className="font-display text-[20px] leading-none">No prep plan yet</div>
            <p className="mt-2 font-mono text-[11px] text-ink-soft">
              Add prep steps to automatically plan this recipe for future events.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((s, i) => (
              <TornCard key={s.id} className="px-4 py-3 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="label-mono text-ink-soft">Step {i + 1}</div>
                    <div className="mt-0.5 text-[15px] font-semibold leading-tight">{s.name}</div>
                    <div className="mt-1 font-mono text-[11px] text-ink-soft">
                      {s.target === "component"
                        ? componentName(s.component_recipe_id)
                        : s.target === "whole"
                          ? "Whole recipe"
                          : "No linked component"}
                    </div>
                    <div className="mt-1 font-mono text-[11px]">
                      {daysBeforeLabel(s.recommended_days_before)}
                      {fmtMinutes(s.approximate_minutes) ? ` · ${fmtMinutes(s.approximate_minutes)}` : ""} ·{" "}
                      {assignmentLabel(s.default_assignment)}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-ink-soft">
                      {s.can_do_earlier ? "Can do earlier" : "Fixed timing"}
                      {s.can_freeze
                        ? ` · Freezes${s.defrost_lead_days != null ? ` · defrost ${s.defrost_lead_days}d` : ""}`
                        : ""}
                    </div>
                    {s.notes ? <div className="mt-1 text-[13px]">{s.notes}</div> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => openSheet(s)}
                      className="tap font-mono text-[11px] text-flame underline"
                    >
                      Edit
                    </button>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label="Move up"
                        onClick={() => move(s, -1)}
                        className="tap size-8 border border-ink/15 font-mono text-[12px]"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        onClick={() => move(s, 1)}
                        className="tap size-8 border border-ink/15 font-mono text-[12px]"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </div>
              </TornCard>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => openSheet()}
          className="tap mt-3 w-full border border-ink bg-ink px-4 py-3 text-center font-semibold text-cream"
        >
          + Add prep step
        </button>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-soft">
          Prep steps are jobs to schedule, not cooking method. The method stays on the recipe version.
        </p>
      </div>

      <Drawer open={open} onOpenChange={(o) => !o && closeSheet()} shouldScaleBackground={false}>
        <DrawerContent className="bg-paper border-ink/10">
          <div className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col px-5 pb-safe pt-2">
            <DrawerTitle className="font-display text-[24px] leading-none">
              {editing ? "Edit prep step" : "Add prep step"}
            </DrawerTitle>
            <div className="mt-3 space-y-3 overflow-y-auto pb-3">
              <Field label="Step name" required>
                <TextInput
                  placeholder="Make butter chicken sauce"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Relates to">
                <SelectInput
                  value={draft.target}
                  onChange={(e) => setDraft({ ...draft, target: e.target.value as Draft["target"] })}
                >
                  <option value="whole">Whole recipe</option>
                  <option value="component" disabled={components.length === 0}>
                    A component
                  </option>
                  <option value="none">Nothing specific</option>
                </SelectInput>
              </Field>
              {draft.target === "component" ? (
                <Field label="Component">
                  <SelectInput
                    value={draft.component_recipe_id}
                    onChange={(e) => setDraft({ ...draft, component_recipe_id: e.target.value })}
                  >
                    <option value="">Choose a component…</option>
                    {components.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Days before" hint="0 = event day">
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={draft.recommended_days_before}
                    onChange={(e) => setDraft({ ...draft, recommended_days_before: e.target.value })}
                  />
                </Field>
                <Field label="Approx. minutes">
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={draft.approximate_minutes}
                    onChange={(e) => setDraft({ ...draft, approximate_minutes: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Default assignment">
                <SelectInput
                  value={draft.default_assignment}
                  onChange={(e) => setDraft({ ...draft, default_assignment: e.target.value })}
                >
                  {ASSIGNMENTS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Toggle
                label="Can be done earlier"
                value={draft.can_do_earlier}
                onChange={(v) => setDraft({ ...draft, can_do_earlier: v })}
              />
              <Toggle
                label="Can be frozen"
                value={draft.can_freeze}
                onChange={(v) => setDraft({ ...draft, can_freeze: v })}
              />
              {draft.can_freeze ? (
                <Field label="Defrost lead time" hint="days">
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={draft.defrost_lead_days}
                    onChange={(e) => setDraft({ ...draft, defrost_lead_days: e.target.value })}
                  />
                </Field>
              ) : null}
              <Field label="Notes">
                <TextArea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Optional instructions for this job."
                />
              </Field>
              {editing ? (
                <button
                  type="button"
                  onClick={removeStep}
                  className="tap w-full border border-flame/50 px-3 py-2 font-mono text-[12px] text-flame"
                >
                  Remove step
                </button>
              ) : null}
            </div>
            <div className="mt-1 space-y-2 pb-3">
              <PrimaryButton disabled={saving} onClick={() => saveStep("close")}>
                {editing ? "Save step" : "Add step"}
              </PrimaryButton>
              {!editing ? (
                <GhostButton className="w-full" disabled={saving} onClick={() => saveStep("another")}>
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
