ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS closeout_state text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_closeout_state_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_closeout_state_check CHECK (closeout_state IN ('open','closed'));

CREATE INDEX IF NOT EXISTS events_closeout_state_idx ON public.events (organisation_id, closeout_state);