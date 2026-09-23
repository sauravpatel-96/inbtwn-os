CREATE TABLE public.event_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT current_organisation_id() REFERENCES public.organisations(id),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.event_payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.event_invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, invoice_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_payment_allocations TO authenticated;
GRANT ALL ON public.event_payment_allocations TO service_role;

ALTER TABLE public.event_payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read allocations" ON public.event_payment_allocations FOR SELECT TO authenticated USING (organisation_id = current_organisation_id());
CREATE POLICY "org insert allocations" ON public.event_payment_allocations FOR INSERT TO authenticated WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org update allocations" ON public.event_payment_allocations FOR UPDATE TO authenticated USING (organisation_id = current_organisation_id()) WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org delete allocations" ON public.event_payment_allocations FOR DELETE TO authenticated USING (organisation_id = current_organisation_id());

CREATE INDEX event_payment_allocations_event_idx ON public.event_payment_allocations(event_id);
CREATE INDEX event_payment_allocations_invoice_idx ON public.event_payment_allocations(invoice_id);
CREATE INDEX event_payment_allocations_payment_idx ON public.event_payment_allocations(payment_id);

CREATE TRIGGER event_payment_allocations_updated_at BEFORE UPDATE ON public.event_payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();