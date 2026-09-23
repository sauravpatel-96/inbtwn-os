CREATE TABLE public.business_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id uuid NOT NULL UNIQUE REFERENCES public.organisations(id) ON DELETE CASCADE,
  trading_name text NOT NULL DEFAULT 'INBTWN Catering',
  legal_name text,
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  country text,
  email text,
  phone text,
  company_number text,
  currency text NOT NULL DEFAULT 'GBP',
  default_payment_method text NOT NULL DEFAULT 'bank_transfer',
  bank_account_name text,
  bank_sort_code text,
  bank_account_number text,
  card_payments_available boolean NOT NULL DEFAULT true,
  card_fee_percentage numeric NOT NULL DEFAULT 3,
  bank_details_on_invoices boolean NOT NULL DEFAULT true,
  bank_details_on_quotes boolean NOT NULL DEFAULT false,
  deposit_percentage numeric NOT NULL DEFAULT 20,
  deposit_wording text,
  balance_due_days_before integer NOT NULL DEFAULT 7,
  quote_validity_days integer NOT NULL DEFAULT 14,
  vat_registered boolean NOT NULL DEFAULT false,
  vat_rate numeric NOT NULL DEFAULT 20,
  card_wording text,
  quote_terms text,
  invoice_payment_terms text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their organisation settings"
  ON public.business_settings FOR SELECT TO authenticated
  USING (organisation_id = public.current_organisation_id());

CREATE POLICY "Members create their organisation settings"
  ON public.business_settings FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_organisation_id());

CREATE POLICY "Members update their organisation settings"
  ON public.business_settings FOR UPDATE TO authenticated
  USING (organisation_id = public.current_organisation_id())
  WITH CHECK (organisation_id = public.current_organisation_id());

CREATE TRIGGER business_settings_updated_at
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.business_settings (
  organisation_id, trading_name, legal_name, address_line1, city, postcode, country,
  email, phone, currency, default_payment_method,
  bank_account_name, bank_sort_code, bank_account_number,
  card_payments_available, card_fee_percentage,
  deposit_percentage, deposit_wording, balance_due_days_before, quote_validity_days,
  vat_registered, vat_rate, card_wording, quote_terms, invoice_payment_terms
)
SELECT
  o.id, 'INBTWN Catering', 'INBTWN LTD', '24 Brisbane Road', 'London', 'IG1 4SR', 'United Kingdom',
  'contact@inbtwn.co.uk', '07754 528742', 'GBP', 'bank_transfer',
  'INBTWN LTD', '60-83-71', '90097737',
  true, 3,
  20, '20% deposit required to secure the booking.', 7, 14,
  false, 20,
  'Card payments are available and subject to a 3% processing fee.',
  E'20% deposit required to secure the booking.\nFinal balance due 7 days before the event.\nPayment by bank transfer.\nCard payments are available and subject to a 3% processing fee.',
  E'Payment by bank transfer using the details below.\nCard payments are available and subject to a 3% processing fee.'
FROM public.organisations o
ON CONFLICT (organisation_id) DO NOTHING;

ALTER TABLE public.event_quotes
  ADD COLUMN IF NOT EXISTS quote_number text,
  ADD COLUMN IF NOT EXISTS quote_date date,
  ADD COLUMN IF NOT EXISTS valid_until date,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS issued_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS document_snapshot jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS event_quotes_number_unique
  ON public.event_quotes (organisation_id, quote_number)
  WHERE quote_number IS NOT NULL;

ALTER TABLE public.event_invoices
  ADD COLUMN IF NOT EXISTS issued_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS document_snapshot jsonb;