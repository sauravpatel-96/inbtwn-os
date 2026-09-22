import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  PageTitle,
  SectionHeading,
  TornCard,
  EmptyNote,
  Field,
  TextInput,
  SelectInput,
  Chip,
} from "@/components/inbtwn/bits";
import { graphQuery, profilesQuery, recipeQuery } from "@/lib/recipe-queries";
import {
  buildTrace,
  productionRequirement,
  scaleVersion,
  type ComponentLine,
  type ScaleResult,
} from "@/lib/recipe-calc";
import { bigQty, fmtCost, fmtQty, toBase, unitsFor, type BaseUnit, type DisplayUnit } from "@/lib/units";

export const Route = createFileRoute("/_authenticated/library/recipes/$recipeId/scale")({
  head: () => ({
    meta: [
      { title: "Scale recipe — INBTWN OS" },
      { name: "description", content: "Scale a recipe by guest count or target quantity, with a full calculation trace." },
      { property: "og:title", content: "Scale recipe — INBTWN OS" },
      { property: "og:description", content: "Deterministic catering recipe scaling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScalePage,
});

/** Display rounding for count-based ingredients: round up to the next whole item. */
function displayQuantity(baseQty: number | null | undefined, base: BaseUnit): number | null {
  if (baseQty === null || baseQty === undefined || Number.isNaN(baseQty)) return null;
  if (base === "each") return Math.ceil(baseQty);
  return baseQty;
}

function fmtScaleQty(baseQty: number | null | undefined, base: BaseUnit): string {
  const qty = displayQuantity(baseQty, base);
  if (qty === null) return "—";
  return fmtQty(qty, base);
}

function ComponentBlock({ c, depth = 0 }: { c: ComponentLine; depth?: number }) {
  return (
    <div className={depth ? "ml-3 border-l border-ink/10 pl-3" : ""}>
      <div className="flex items-baseline justify-between py-2">
        <span className="text-[14px] font-semibold">{c.name}</span>
        <span className="font-mono text-[13px]">{fmtQty(c.required, c.baseUnit)}</span>
      </div>
      <div className="ml-3 border-l border-ink/10 pl-3">
        {c.result.ingredients.map((i) => (
          <div key={i.ingredientId} className="flex items-baseline justify-between py-1.5">
            <span className="text-[13px]">{i.name}</span>
            <span className="text-right font-mono text-[12px]">
              {fmtScaleQty(i.usable, i.baseUnit)}
              {i.yieldPct !== 100 ? (
                <span className="block text-ink-soft">{fmtQty(i.raw, i.baseUnit)} raw</span>
              ) : null}
            </span>
          </div>
        ))}
        {c.result.components.map((sub) => (
          <ComponentBlock key={sub.versionId} c={sub} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
}

function ScalePage() {
  const { recipeId } = Route.useParams();
  const recipe = useQuery(recipeQuery(recipeId));
  const profiles = useQuery(profilesQuery(recipeId));
  const graph = useQuery(graphQuery);

  const [mode, setMode] = useState<"profile" | "target">("profile");
  const [guests, setGuests] = useState("100");
  const [profileId, setProfileId] = useState<string>("");
  const [perGuest, setPerGuest] = useState("");
  const [uptake, setUptake] = useState("");
  const [buffer, setBuffer] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [targetUnit, setTargetUnit] = useState<DisplayUnit | "">("");
  const [showTrace, setShowTrace] = useState(false);

  const v = recipe.data?.active_version ?? null;
  const base = (v?.base_yield_unit as BaseUnit) ?? "g";

  const profile = useMemo(
    () => (profiles.data ?? []).find((p) => p.id === profileId) ?? (profiles.data ?? [])[0] ?? null,
    [profiles.data, profileId],
  );

  const effPerGuest = perGuest !== "" ? Number(perGuest) : profile ? Number(profile.quantity_per_guest) : NaN;
  const effUptake = uptake !== "" ? Number(uptake) : profile ? Number(profile.expected_uptake_percentage) : 100;
  const effBuffer =
    buffer !== "" ? Number(buffer) : profile ? Number(profile.buffer_percentage) : Number(v?.default_buffer_percentage ?? 0);
  const guestsN = Number(guests);
  const unit = targetUnit || unitsFor(base)[unitsFor(base).length - 1]!;

  const required =
    mode === "profile"
      ? guestsN > 0 && effPerGuest > 0
        ? productionRequirement(guestsN, effPerGuest, effUptake, effBuffer)
        : null
      : Number(targetQty) > 0
        ? toBase(Number(targetQty), unit as DisplayUnit)
        : null;

  let result: ScaleResult | null = null;
  let error: string | null = null;
  if (v && graph.data && required !== null) {
    try {
      result = scaleVersion(v.id, required, graph.data);
    } catch (e) {
      error = e instanceof Error ? e.message : "Calculation failed";
    }
  }

  if (recipe.isLoading || graph.isLoading) return <EmptyNote>Loading…</EmptyNote>;
  if (!recipe.data) return <EmptyNote>Recipe not found.</EmptyNote>;
  if (!v) return <EmptyNote>This recipe has no active version to scale.</EmptyNote>;

  const big = result ? bigQty(result.required, base) : null;
  const trace = result
    ? buildTrace(
        result,
        mode === "profile"
          ? { mode: "profile", guests: guestsN, perGuest: effPerGuest, uptake: effUptake, buffer: effBuffer }
          : { mode: "target" },
      )
    : [];

  return (
    <div>
      <div className="mb-1">
        <Link to="/library/recipes/$recipeId" params={{ recipeId }} className="font-mono text-[11px] text-ink-soft">
          ← {recipe.data.name}
        </Link>
      </div>
      <PageTitle title="Scale" aside={`v${v.version_number}`} />

      <div className="mb-3 flex gap-2">
        <Chip active={mode === "profile"} onClick={() => setMode("profile")}>
          By guests
        </Chip>
        <Chip active={mode === "target"} onClick={() => setMode("target")}>
          By target quantity
        </Chip>
      </div>

      {mode === "profile" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Guests" required>
              <TextInput type="number" inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} />
            </Field>
            <Field label="Profile">
              <SelectInput value={profile?.id ?? ""} onChange={(e) => setProfileId(e.target.value)}>
                {(profiles.data ?? []).length === 0 ? <option value="">No profiles</option> : null}
                {(profiles.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label={`Per guest (${base})`}>
              <TextInput
                type="number"
                inputMode="decimal"
                value={perGuest}
                placeholder={profile ? String(Number(profile.quantity_per_guest)) : "—"}
                onChange={(e) => setPerGuest(e.target.value)}
              />
            </Field>
            <Field label="Uptake %">
              <TextInput
                type="number"
                inputMode="decimal"
                value={uptake}
                placeholder={profile ? String(Number(profile.expected_uptake_percentage)) : "100"}
                onChange={(e) => setUptake(e.target.value)}
              />
            </Field>
            <Field label="Buffer %">
              <TextInput
                type="number"
                inputMode="decimal"
                value={buffer}
                placeholder={profile ? String(Number(profile.buffer_percentage)) : String(Number(v.default_buffer_percentage))}
                onChange={(e) => setBuffer(e.target.value)}
              />
            </Field>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="I need" required>
            <TextInput type="number" inputMode="decimal" value={targetQty} onChange={(e) => setTargetQty(e.target.value)} placeholder="12" />
          </Field>
          <Field label="Unit">
            <SelectInput value={unit} onChange={(e) => setTargetUnit(e.target.value as DisplayUnit)}>
              {unitsFor(base).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </SelectInput>
          </Field>
        </div>
      )}

      {error ? <div className="torn mt-4 bg-flame/10 px-4 py-3 text-[13px] text-flame">{error}</div> : null}

      {result && big ? (
        <>
          <div className="torn mt-5 bg-ink px-5 py-6 text-center text-cream shadow-card">
            <div className="label-mono text-cream/70">Make</div>
            <div className="font-display text-[56px] leading-none">
              {big.value}
              <span className="ml-2 text-[28px]">{big.unit}</span>
            </div>
            <div className="mt-2 font-mono text-[11px] text-cream/70">
              {recipe.data.name} · multiplier {Math.round(result.multiplier * 10000) / 10000}×
            </div>
          </div>

          <div className="mt-5">
            <SectionHeading title="Ingredients" />
            <TornCard straightBottom className="px-4 py-2 pb-4 shadow-card">
              {result.ingredients.length === 0 && result.components.length === 0 ? (
                <div className="py-3 font-mono text-[12px] text-ink-soft">Nothing in this version yet.</div>
              ) : null}
              {result.ingredients.map((i) => (
                <div key={i.ingredientId} className="flex items-baseline justify-between border-b border-ink/8 py-2.5 last:border-0">
                  <div>
                    <div className="text-[15px] font-semibold">{i.name}</div>
                    {i.prepNote ? <div className="font-mono text-[11px] text-ink-soft">{i.prepNote}</div> : null}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[15px]">{fmtScaleQty(i.usable, i.baseUnit)} usable</div>
                    {i.yieldPct !== 100 ? (
                      <div className="font-mono text-[12px] text-ink-soft">{fmtScaleQty(i.raw, i.baseUnit)} raw required</div>
                    ) : null}
                  </div>
                </div>
              ))}
              {result.components.map((c) => (
                <ComponentBlock key={c.versionId} c={c} />
              ))}
            </TornCard>
          </div>

          <div className="mt-5">
            <SectionHeading title="Cost" />
            <TornCard className="px-4 py-3 shadow-card">
              <div className="flex items-baseline justify-between py-1">
                <span className="label-mono text-ink-soft">Estimated cost</span>
                <span className="font-mono text-[15px]">{fmtCost(result.cost)}</span>
              </div>
              {mode === "profile" && guestsN > 0 ? (
                <div className="flex items-baseline justify-between py-1">
                  <span className="label-mono text-ink-soft">Cost per guest</span>
                  <span className="font-mono text-[13px]">{fmtCost(result.cost / guestsN)}</span>
                </div>
              ) : null}
              {result.missingCost.length ? (
                <div className="mt-2 rounded-sm bg-flame/10 px-3 py-2 font-mono text-[11px] text-flame">
                  Cost incomplete — no cost for: {result.missingCost.join(", ")}
                </div>
              ) : null}
            </TornCard>
          </div>

          <div className="mt-5">
            <button
              onClick={() => setShowTrace((s) => !s)}
              className="tap w-full rounded-sm border border-ink/20 bg-cream px-4 py-3 font-mono text-[12px]"
            >
              {showTrace ? "Hide calculation" : "How was this calculated?"}
            </button>
            {showTrace ? (
              <TornCard className="mt-2 px-4 py-3">
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ink">
                  {trace.join("\n")}
                </pre>
              </TornCard>
            ) : null}
          </div>
        </>
      ) : (
        <EmptyNote>
          {mode === "profile"
            ? "Enter guests and a per-guest quantity to see production requirements."
            : "Enter a target quantity."}
        </EmptyNote>
      )}
    </div>
  );
}
