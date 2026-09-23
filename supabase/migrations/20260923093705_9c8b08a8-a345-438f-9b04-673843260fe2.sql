ALTER TABLE public.event_payment_terms
  ADD COLUMN IF NOT EXISTS agreed_total_source text;

ALTER TABLE public.event_payment_terms
  ADD CONSTRAINT event_payment_terms_agreed_total_source_check
  CHECK (agreed_total_source IS NULL OR agreed_total_source IN ('quote','manual'));