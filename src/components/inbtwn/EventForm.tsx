import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { clientsQuery, type ClientRow, type EventInsert, type EventRow } from "@/lib/queries";
import {
  EVENT_SOURCES,
  EVENT_TYPES,
  SERVICE_STYLES,
  GUEST_COUNT_STATUSES,
  DIETARY_TYPES,
  DEFAULT_CURRENCY,
  type EventSource,
  type GuestCountStatus,
} from "@/lib/constants";
import { clientDisplayName } from "@/lib/format";
import {
  Field,
  TextInput,
  SelectInput,
  TextArea,
  PrimaryButton,
  GhostButton,
  StickyActions,
  SectionHeading,
  Chip,
} from "./bits";
import { ClientForm } from "./ClientForm";

const sourceValues = EVENT_SOURCES.map((s) => s.value) as [EventSource, ...EventSource[]];
const gcsValues = GUEST_COUNT_STATUSES.map((s) => s.value) as [GuestCountStatus, ...GuestCountStatus[]];

const schema = z.object({
  title: z.string().trim().min(1, "Give the event a title").max(200),
  event_date: z.string().min(1, "Pick an event date"),
  guest_count: z
    .string()
    .trim()
    .min(1, "Add a guest count (an estimate is fine)")
    .refine((s) => /^\d+$/.test(s), "Guest count must be a whole number"),
  guest_count_status: z.enum(gcsValues),
  source: z.enum(sourceValues),
  source_reference: z.string().trim().max(100),
  client_id: z.string().min(1, "Choose or create a client"),
  contact_id: z.string(),
  budget: z.string().trim().refine((s) => s === "" || /^\d+(\.\d{1,2})?$/.test(s), "Budget must be a number"),
  budget_min: z.string().trim().refine((s) => s === "" || /^\d+(\.\d{1,2})?$/.test(s), "Minimum budget must be a number"),
  budget_max: z.string().trim().refine((s) => s === "" || /^\d+(\.\d{1,2})?$/.test(s), "Maximum budget must be a number"),
  budget_flexible: z.boolean(),
  power_access: z.string(),
  water_access: z.string(),
  venue_setup_notes: z.string().trim().max(2000),
  logistics_notes: z.string().trim().max(2000),
  event_type: z.string().trim().max(100),
  cuisine: z.string().trim().max(100),
  service_style: z.string().trim().max(100),
  venue_name: z.string().trim().max(200),
  venue_address: z.string().trim().max(500),
  venue_contact_name: z.string().trim().max(100),
  venue_contact_phone: z.string().trim().max(40),
  arrival_time: z.string(),
  service_time: z.string(),
  end_time: z.string(),
  internal_notes: z.string().trim().max(4000),
});
type Values = z.infer<typeof schema>;

export type QuickDietary = { type: string; guest_count: string; notes: string };

const nn = (s: string) => (s.trim() ? s.trim() : null);

function toPayload(v: Values): EventInsert {
  return {
    title: v.title,
    event_date: v.event_date,
    guest_count: Number(v.guest_count),
    guest_count_status: v.guest_count_status,
    source: v.source,
    source_reference: nn(v.source_reference),
    client_id: v.client_id,
    contact_id: v.contact_id || null,
    budget: v.budget ? Number(v.budget) : null,
    budget_min: v.budget_min ? Number(v.budget_min) : null,
    budget_max: v.budget_max ? Number(v.budget_max) : null,
    budget_flexible: v.budget_flexible,
    power_access: v.power_access || null,
    water_access: v.water_access || null,
    venue_setup_notes: nn(v.venue_setup_notes),
    logistics_notes: nn(v.logistics_notes),
    currency: DEFAULT_CURRENCY,
    event_type: nn(v.event_type),
    cuisine: nn(v.cuisine),
    service_style: nn(v.service_style),
    venue_name: nn(v.venue_name),
    venue_address: nn(v.venue_address),
    venue_contact_name: nn(v.venue_contact_name),
    venue_contact_phone: nn(v.venue_contact_phone),
    arrival_time: nn(v.arrival_time),
    service_time: nn(v.service_time),
    end_time: nn(v.end_time),
    internal_notes: nn(v.internal_notes),
  };
}

function fromRow(e: EventRow): Values {
  return {
    title: e.title,
    event_date: e.event_date ?? "",
    guest_count: e.guest_count != null ? String(e.guest_count) : "",
    guest_count_status: e.guest_count_status,
    source: e.source,
    source_reference: e.source_reference ?? "",
    client_id: e.client_id ?? "",
    contact_id: e.contact_id ?? "",
    budget: e.budget != null ? String(e.budget) : "",
    budget_min: e.budget_min != null ? String(e.budget_min) : "",
    budget_max: e.budget_max != null ? String(e.budget_max) : "",
    budget_flexible: Boolean(e.budget_flexible),
    power_access: e.power_access ?? "",
    water_access: e.water_access ?? "",
    venue_setup_notes: e.venue_setup_notes ?? "",
    logistics_notes: e.logistics_notes ?? "",
    event_type: e.event_type ?? "",
    cuisine: e.cuisine ?? "",
    service_style: e.service_style ?? "",
    venue_name: e.venue_name ?? "",
    venue_address: e.venue_address ?? "",
    venue_contact_name: e.venue_contact_name ?? "",
    venue_contact_phone: e.venue_contact_phone ?? "",
    arrival_time: e.arrival_time?.slice(0, 5) ?? "",
    service_time: e.service_time?.slice(0, 5) ?? "",
    end_time: e.end_time?.slice(0, 5) ?? "",
    internal_notes: e.internal_notes ?? "",
  };
}

const empty: Values = {
  title: "",
  event_date: "",
  guest_count: "",
  guest_count_status: "estimated",
  source: "direct",
  source_reference: "",
  client_id: "",
  contact_id: "",
  budget: "",
  budget_min: "",
  budget_max: "",
  budget_flexible: false,
  power_access: "",
  water_access: "",
  venue_setup_notes: "",
  logistics_notes: "",
  event_type: "",
  cuisine: "",
  service_style: "",
  venue_name: "",
  venue_address: "",
  venue_contact_name: "",
  venue_contact_phone: "",
  arrival_time: "",
  service_time: "",
  end_time: "",
  internal_notes: "",
};

export function EventForm({
  initial,
  presetClientId,
  presetContactId,
  onSaved,
}: {
  initial?: EventRow | undefined;
  presetClientId?: string | undefined;
  presetContactId?: string | undefined;
  onSaved: (event: EventRow) => void;
}) {
  const qc = useQueryClient();
  const clients = useQuery(clientsQuery);
  const [v, setV] = useState<Values>(
    initial
      ? fromRow(initial)
      : { ...empty, client_id: presetClientId ?? "", contact_id: presetContactId ?? "" },
  );
  const [dietaries, setDietaries] = useState<QuickDietary[]>([]);
  const [newClient, setNewClient] = useState(false);
  const [more, setMore] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));

  const clientOptions = useMemo(
    () => (clients.data ?? []).map((c) => ({ id: c.id, label: clientDisplayName(c) })),
    [clients.data],
  );

  const selectedClient = useMemo(
    () => (clients.data ?? []).find((c) => c.id === v.client_id) ?? null,
    [clients.data, v.client_id],
  );
  const contactOptions = useMemo(
    () => (selectedClient?.contacts ?? []).filter((x) => x.active),
    [selectedClient],
  );

  const onClientCreated = (c: ClientRow) => {
    qc.invalidateQueries({ queryKey: ["clients"] });
    set("client_id", c.id);
    set("contact_id", "");
    setNewClient(false);
    toast.success(`${clientDisplayName(c)} added`);
  };

  const toggleDietary = (type: string) =>
    setDietaries((d) =>
      d.some((x) => x.type === type) ? d.filter((x) => x.type !== type) : [...d, { type, guest_count: "", notes: "" }],
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(v);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setBusy(true);
    const payload = toPayload(parsed.data);
    const res = initial
      ? await supabase.from("events").update(payload).eq("id", initial.id).select().single()
      : await supabase.from("events").insert(payload).select().single();
    if (res.error) {
      setBusy(false);
      toast.error(res.error.message);
      return;
    }
    if (!initial && dietaries.length) {
      const { error } = await supabase.from("event_dietaries").insert(
        dietaries.map((d) => ({
          event_id: res.data.id,
          type: d.type,
          guest_count: d.guest_count ? Number(d.guest_count) : null,
          notes: nn(d.notes),
        })),
      );
      if (error) toast.error(`Event saved, but dietaries failed: ${error.message}`);
    }
    setBusy(false);
    onSaved(res.data);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Event title" required>
        <TextInput
          value={v.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Corporate Summer Party"
          autoFocus={!initial}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Event date" required>
          <TextInput type="date" value={v.event_date} onChange={(e) => set("event_date", e.target.value)} />
        </Field>
        <Field label="Guests" required>
          <TextInput
            type="number"
            inputMode="numeric"
            min={0}
            value={v.guest_count}
            onChange={(e) => set("guest_count", e.target.value)}
            placeholder="80"
          />
        </Field>
      </div>

      <Field label="Guest count is">
        <div className="flex flex-wrap gap-2">
          {GUEST_COUNT_STATUSES.map((s) => (
            <Chip key={s.value} active={v.guest_count_status === s.value} onClick={() => set("guest_count_status", s.value)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Lead source" required>
        <div className="flex flex-wrap gap-2">
          {EVENT_SOURCES.map((s) => (
            <Chip key={s.value} active={v.source === s.value} onClick={() => set("source", s.value)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Field>

      {v.source === "togather" ? (
        <Field label="Togather Request ID" hint="optional">
          <TextInput
            value={v.source_reference}
            onChange={(e) => set("source_reference", e.target.value)}
            placeholder="RNKUPKK0"
          />
        </Field>
      ) : null}

      {/* Client */}
      <div className="torn bg-cream px-4 py-4">
        <SectionHeading
          title="Client"
          action={
            <button type="button" onClick={() => setNewClient((s) => !s)} className="font-mono text-[11px] text-flame">
              {newClient ? "Choose existing" : "+ New client"}
            </button>
          }
        />
        {newClient ? (
          <ClientForm compact submitLabel="Add client & attach" onSaved={onClientCreated} />
        ) : (
          <>
            <SelectInput
              value={v.client_id}
              onChange={(e) => {
                const id = e.target.value;
                setV((s) => {
                  const client = (clients.data ?? []).find((c) => c.id === id);
                  const primary = (client?.contacts ?? []).find((x) => x.active && x.is_primary);
                  return { ...s, client_id: id, contact_id: primary?.id ?? "" };
                });
              }}
            >
              <option value="">{clients.isLoading ? "Loading clients…" : "Select a client…"}</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </SelectInput>
            {contactOptions.length ? (
              <div className="mt-3">
                <Field label="Event contact">
                  <SelectInput value={v.contact_id} onChange={(e) => set("contact_id", e.target.value)}>
                    <option value="">No specific contact</option>
                    {contactOptions.map((x) => (
                      <option key={x.id} value={x.id}>
                        {[x.first_name, x.last_name].filter(Boolean).join(" ")}
                        {x.is_primary ? " (primary)" : ""}
                        {x.role ? ` — ${x.role}` : ""}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
            ) : null}
          </>
        )}
      </div>

      {!more ? (
        <GhostButton type="button" onClick={() => setMore(true)}>
          + Add budget, venue, times, notes…
        </GhostButton>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Budget (${DEFAULT_CURRENCY})`} hint="single">
              <TextInput
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={v.budget}
                onChange={(e) => set("budget", e.target.value)}
                placeholder="2500"
              />
            </Field>
            <Field label="Source ref">
              <TextInput
                value={v.source_reference}
                onChange={(e) => set("source_reference", e.target.value)}
                placeholder="TG-48213"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Budget min">
              <TextInput
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={v.budget_min}
                onChange={(e) => set("budget_min", e.target.value)}
                placeholder="648"
              />
            </Field>
            <Field label="Budget max">
              <TextInput
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={v.budget_max}
                onChange={(e) => set("budget_max", e.target.value)}
                placeholder="1008"
              />
            </Field>
          </div>
          <Field label="Budget flexible">
            <div className="flex gap-2">
              <Chip active={v.budget_flexible} onClick={() => set("budget_flexible", true)}>
                Yes
              </Chip>
              <Chip active={!v.budget_flexible} onClick={() => set("budget_flexible", false)}>
                No
              </Chip>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Power access">
              <SelectInput value={v.power_access} onChange={(e) => set("power_access", e.target.value)}>
                <option value="">Not set</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown</option>
              </SelectInput>
            </Field>
            <Field label="Water access">
              <SelectInput value={v.water_access} onChange={(e) => set("water_access", e.target.value)}>
                <option value="">Not set</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown</option>
              </SelectInput>
            </Field>
          </div>
          <Field label="Venue setup / kitchen">
            <TextArea
              value={v.venue_setup_notes}
              onChange={(e) => set("venue_setup_notes", e.target.value)}
              className="min-h-[64px]"
              placeholder="Indoors with a domestic kitchen"
            />
          </Field>
          <Field label="Logistics notes">
            <TextArea
              value={v.logistics_notes}
              onChange={(e) => set("logistics_notes", e.target.value)}
              className="min-h-[64px]"
            />
          </Field>


          <Field label="Event type">
            <SelectInput value={v.event_type} onChange={(e) => set("event_type", e.target.value)}>
              <option value="">Not set</option>
              {EVENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </SelectInput>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cuisine">
              <TextInput value={v.cuisine} onChange={(e) => set("cuisine", e.target.value)} placeholder="Korean" />
            </Field>
            <Field label="Service style">
              <SelectInput value={v.service_style} onChange={(e) => set("service_style", e.target.value)}>
                <option value="">Not set</option>
                {SERVICE_STYLES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Arrival">
              <TextInput type="time" value={v.arrival_time} onChange={(e) => set("arrival_time", e.target.value)} />
            </Field>
            <Field label="Service">
              <TextInput type="time" value={v.service_time} onChange={(e) => set("service_time", e.target.value)} />
            </Field>
            <Field label="End">
              <TextInput type="time" value={v.end_time} onChange={(e) => set("end_time", e.target.value)} />
            </Field>
          </div>

          <Field label="Venue name">
            <TextInput value={v.venue_name} onChange={(e) => set("venue_name", e.target.value)} />
          </Field>
          <Field label="Venue address">
            <TextArea value={v.venue_address} onChange={(e) => set("venue_address", e.target.value)} className="min-h-[64px]" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Venue contact">
              <TextInput value={v.venue_contact_name} onChange={(e) => set("venue_contact_name", e.target.value)} />
            </Field>
            <Field label="Venue phone">
              <TextInput type="tel" inputMode="tel" value={v.venue_contact_phone} onChange={(e) => set("venue_contact_phone", e.target.value)} />
            </Field>
          </div>

          <Field label="Internal notes">
            <TextArea value={v.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} />
          </Field>

          {!initial ? (
            <div>
              <SectionHeading title="Dietaries (quick add)" />
              <div className="flex flex-wrap gap-2">
                {DIETARY_TYPES.map((t) => (
                  <Chip key={t} active={dietaries.some((d) => d.type === t)} onClick={() => toggleDietary(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
              {dietaries.length ? (
                <div className="mt-3 flex flex-col gap-2">
                  {dietaries.map((d) => (
                    <div key={d.type} className="grid grid-cols-[1fr_72px] items-center gap-2">
                      <span className="text-sm font-medium">{d.type}</span>
                      <TextInput
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="#"
                        value={d.guest_count}
                        onChange={(e) =>
                          setDietaries((all) =>
                            all.map((x) => (x.type === d.type ? { ...x, guest_count: e.target.value } : x)),
                          )
                        }
                        className="py-1.5 text-center"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <StickyActions>
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Create enquiry"}
        </PrimaryButton>
      </StickyActions>
    </form>
  );
}
