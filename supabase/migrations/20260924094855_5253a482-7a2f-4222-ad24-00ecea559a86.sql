CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  default_hourly_rate numeric NOT NULL DEFAULT 0 CHECK (default_hourly_rate >= 0),
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org read staff" ON public.staff_members FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "Org insert staff" ON public.staff_members FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org update staff" ON public.staff_members FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE TRIGGER staff_members_updated_at BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_staff_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL DEFAULT public.current_organisation_id() REFERENCES public.organisations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  staff_member_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  is_owner boolean NOT NULL DEFAULT false,
  role_label text,
  work_type text NOT NULL DEFAULT 'event' CHECK (work_type IN ('prep','event','other')),
  shift_date date,
  start_time time,
  end_time time,
  break_minutes integer CHECK (break_minutes IS NULL OR break_minutes >= 0),
  hourly_rate numeric NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  actual_start_time time,
  actual_end_time time,
  actual_break_minutes integer CHECK (actual_break_minutes IS NULL OR actual_break_minutes >= 0),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  paid_at timestamptz,
  payment_note text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_staff_shifts_event_idx ON public.event_staff_shifts (event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_staff_shifts TO authenticated;
GRANT ALL ON public.event_staff_shifts TO service_role;
ALTER TABLE public.event_staff_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org read shifts" ON public.event_staff_shifts FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "Org insert shifts" ON public.event_staff_shifts FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org update shifts" ON public.event_staff_shifts FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id()) WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "Org delete shifts" ON public.event_staff_shifts FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE TRIGGER event_staff_shifts_updated_at BEFORE UPDATE ON public.event_staff_shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();