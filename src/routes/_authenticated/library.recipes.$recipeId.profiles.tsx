import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PageTitle,
  SectionHeading,
  TornCard,
  EmptyNote,
  Field,
  TextInput,
  SelectInput,
  PrimaryButton,
} from "@/components/inbtwn/bits";
import { profilesQuery, recipeQuery } from "@/lib/recipe-queries";
import { SERVICE_STYLES } from "@/lib/constants";
import type { BaseUnit } from "@/lib/units";

export const Route = createFileRoute("/_authenticated/library/recipes/$recipeId/profiles")({
  head: () => ({
    meta: [
      { title: "Production profiles — INBTWN OS" },
      { name: "description", content: "Per-guest quantities, uptake and buffer for this recipe." },
      { property: "og:title", content: "Production profiles — INBTWN OS" },
      { property: "og:description", content: "Configure per-guest production profiles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilesPage,
});

function ProfilesPage() {
  const { recipeId } = Route.useParams();
  const recipe = useQuery(recipeQuery(recipeId));
  const profiles = useQuery(profilesQuery(recipeId));
  const qc = useQueryClient();

  const base = (recipe.data?.active_version?.base_yield_unit as BaseUnit) ?? "g";
  const [name, setName] = useState("");
  const [style, setStyle] = useState("");
  const [perGuest, setPerGuest] = useState("");
  const [uptake, setUptake] = useState("100");
  const [buffer, setBuffer] = useState("5");
  const [saving, setSaving] = useState(false);

  const add = async (): Promise<void> => {
    const pg = Number(perGuest);
    const up = Number(uptake);
    const bf = Number(buffer);
    if (!name.trim()) return void toast.error("Name the profile");
    if (!(pg > 0)) return void toast.error("Quantity per guest must be greater than zero");
    if (!(up > 0 && up <= 100)) return void toast.error("Uptake must be between 1% and 100%");
    if (bf < 0) return void toast.error("Buffer cannot be negative");
    setSaving(true);
    const res = await supabase.from("recipe_production_profiles").insert({
      recipe_id: recipeId,
      name: name.trim(),
      service_style: style || null,
      quantity_per_guest: pg,
      unit: base,
      expected_uptake_percentage: up,
      buffer_percentage: bf,
    });
    setSaving(false);
    if (res.error) return void toast.error(res.error.message);
    setName("");
    setPerGuest("");
    qc.invalidateQueries({ queryKey: ["recipe-profiles", recipeId] });
    toast.success("Profile added");
  };

  const remove = async (id: string) => {
    const res = await supabase.from("recipe_production_profiles").delete().eq("id", id);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["recipe-profiles", recipeId] });
  };

  return (
    <div>
      <div className="mb-1">
        <Link to="/library/recipes/$recipeId" params={{ recipeId }} className="font-mono text-[11px] text-ink-soft">
          ← {recipe.data?.name ?? "Recipe"}
        </Link>
      </div>
      <PageTitle title="Production profiles" aside={base} />

      <div className="space-y-2">
        {(profiles.data ?? []).length === 0 ? <EmptyNote>No profiles yet.</EmptyNote> : null}
        {(profiles.data ?? []).map((p) => (
          <TornCard key={p.id} className="px-4 py-3 shadow-card">
            <div className="flex items-baseline justify-between">
              <div className="font-semibold">{p.name}</div>
              <button onClick={() => remove(p.id)} className="font-mono text-[11px] text-flame">
                Remove
              </button>
            </div>
            <div className="mt-1 font-mono text-[11px] text-ink-soft">
              {Number(p.quantity_per_guest)}
              {p.unit}/guest · {Number(p.expected_uptake_percentage)}% uptake · {Number(p.buffer_percentage)}% buffer
              {p.service_style ? ` · ${p.service_style}` : ""}
            </div>
          </TornCard>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <SectionHeading title="Add profile" />
        <Field label="Name" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Buffet — 3 Mains" />
        </Field>
        <Field label="Service style">
          <SelectInput value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="">—</option>
            {SERVICE_STYLES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectInput>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label={`Per guest (${base})`} required>
            <TextInput type="number" inputMode="decimal" value={perGuest} onChange={(e) => setPerGuest(e.target.value)} placeholder="75" />
          </Field>
          <Field label="Uptake %">
            <TextInput type="number" inputMode="decimal" value={uptake} onChange={(e) => setUptake(e.target.value)} />
          </Field>
          <Field label="Buffer %">
            <TextInput type="number" inputMode="decimal" value={buffer} onChange={(e) => setBuffer(e.target.value)} />
          </Field>
        </div>
        <PrimaryButton onClick={add} disabled={saving}>
          {saving ? "Saving…" : "Add production profile"}
        </PrimaryButton>
      </div>
    </div>
  );
}
