
ALTER TABLE public.event_quotes DROP CONSTRAINT IF EXISTS event_quotes_status_check;
ALTER TABLE public.event_quotes ADD CONSTRAINT event_quotes_status_check CHECK (status = ANY (ARRAY['draft'::text, 'ready'::text, 'sent'::text, 'accepted'::text]));
ALTER TABLE public.event_quotes ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE public.event_quotes ADD COLUMN IF NOT EXISTS agreed_total numeric(12,2);

CREATE TABLE public.event_payment_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT current_organisation_id() REFERENCES public.organisations(id),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  deposit_mode text NOT NULL DEFAULT 'percentage' CHECK (deposit_mode IN ('percentage','fixed','none')),
  deposit_percentage numeric(6,3) NOT NULL DEFAULT 20,
  deposit_amount numeric(12,2),
  deposit_due_date date,
  balance_due_days_before integer NOT NULL DEFAULT 7,
  balance_due_date date,
  card_fee_percentage numeric(6,3) NOT NULL DEFAULT 3,
  card_fee_applied boolean NOT NULL DEFAULT false,
  vat_enabled boolean NOT NULL DEFAULT false,
  vat_rate numeric(6,3) NOT NULL DEFAULT 20,
  agreed_total_override numeric(12,2),
  expected_payout numeric(12,2),
  expected_payout_date date,
  actual_payout numeric(12,2),
  actual_payout_date date,
  payout_status text NOT NULL DEFAULT 'awaiting' CHECK (payout_status IN ('awaiting','received')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_payment_terms TO authenticated;
GRANT ALL ON public.event_payment_terms TO service_role;
ALTER TABLE public.event_payment_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read payment terms" ON public.event_payment_terms FOR SELECT TO authenticated USING (organisation_id = current_organisation_id());
CREATE POLICY "org insert payment terms" ON public.event_payment_terms FOR INSERT TO authenticated WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org update payment terms" ON public.event_payment_terms FOR UPDATE TO authenticated USING (organisation_id = current_organisation_id()) WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org delete payment terms" ON public.event_payment_terms FOR DELETE TO authenticated USING (organisation_id = current_organisation_id());
CREATE TRIGGER event_payment_terms_updated_at BEFORE UPDATE ON public.event_payment_terms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT current_organisation_id() REFERENCES public.organisations(id),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  kind text NOT NULL DEFAULT 'full' CHECK (kind IN ('deposit','balance','full','other')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','sent','part_paid','paid','overdue','cancelled')),
  issue_date date NOT NULL DEFAULT current_date,
  due_date date,
  client_name text,
  billing_details text,
  notes text,
  payment_instructions text,
  vat_enabled boolean NOT NULL DEFAULT false,
  vat_rate numeric(6,3) NOT NULL DEFAULT 20,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_invoices_number_unique UNIQUE (organisation_id, invoice_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invoices TO authenticated;
GRANT ALL ON public.event_invoices TO service_role;
ALTER TABLE public.event_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read invoices" ON public.event_invoices FOR SELECT TO authenticated USING (organisation_id = current_organisation_id());
CREATE POLICY "org insert invoices" ON public.event_invoices FOR INSERT TO authenticated WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org update invoices" ON public.event_invoices FOR UPDATE TO authenticated USING (organisation_id = current_organisation_id()) WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org delete invoices" ON public.event_invoices FOR DELETE TO authenticated USING (organisation_id = current_organisation_id());
CREATE TRIGGER event_invoices_updated_at BEFORE UPDATE ON public.event_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT current_organisation_id() REFERENCES public.organisations(id),
  invoice_id uuid NOT NULL REFERENCES public.event_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invoice_items TO authenticated;
GRANT ALL ON public.event_invoice_items TO service_role;
ALTER TABLE public.event_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read invoice items" ON public.event_invoice_items FOR SELECT TO authenticated USING (organisation_id = current_organisation_id());
CREATE POLICY "org insert invoice items" ON public.event_invoice_items FOR INSERT TO authenticated WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org update invoice items" ON public.event_invoice_items FOR UPDATE TO authenticated USING (organisation_id = current_organisation_id()) WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org delete invoice items" ON public.event_invoice_items FOR DELETE TO authenticated USING (organisation_id = current_organisation_id());
CREATE TRIGGER event_invoice_items_updated_at BEFORE UPDATE ON public.event_invoice_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT current_organisation_id() REFERENCES public.organisations(id),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.event_invoices(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('deposit','balance','full','payout','refund','other')),
  amount numeric(12,2) NOT NULL,
  payment_date date NOT NULL DEFAULT current_date,
  method text NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('bank_transfer','card','cash','other')),
  reference text,
  notes text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('pending','received','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_payments TO authenticated;
GRANT ALL ON public.event_payments TO service_role;
ALTER TABLE public.event_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read payments" ON public.event_payments FOR SELECT TO authenticated USING (organisation_id = current_organisation_id());
CREATE POLICY "org insert payments" ON public.event_payments FOR INSERT TO authenticated WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org update payments" ON public.event_payments FOR UPDATE TO authenticated USING (organisation_id = current_organisation_id()) WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org delete payments" ON public.event_payments FOR DELETE TO authenticated USING (organisation_id = current_organisation_id());
CREATE TRIGGER event_payments_updated_at BEFORE UPDATE ON public.event_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT current_organisation_id() REFERENCES public.organisations(id),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('food','staff','travel','equipment','disposables','platform','other')),
  description text NOT NULL,
  estimated_amount numeric(12,2),
  actual_amount numeric(12,2),
  cost_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_costs TO authenticated;
GRANT ALL ON public.event_costs TO service_role;
ALTER TABLE public.event_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read costs" ON public.event_costs FOR SELECT TO authenticated USING (organisation_id = current_organisation_id());
CREATE POLICY "org insert costs" ON public.event_costs FOR INSERT TO authenticated WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org update costs" ON public.event_costs FOR UPDATE TO authenticated USING (organisation_id = current_organisation_id()) WITH CHECK (organisation_id = current_organisation_id());
CREATE POLICY "org delete costs" ON public.event_costs FOR DELETE TO authenticated USING (organisation_id = current_organisation_id());
CREATE TRIGGER event_costs_updated_at BEFORE UPDATE ON public.event_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX event_payments_event_idx ON public.event_payments(event_id);
CREATE INDEX event_payments_invoice_idx ON public.event_payments(invoice_id);
CREATE INDEX event_invoices_event_idx ON public.event_invoices(event_id);
CREATE INDEX event_costs_event_idx ON public.event_costs(event_id);
