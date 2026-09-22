REVOKE EXECUTE ON FUNCTION public.current_organisation_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.setup_organisation(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.load_demo_data() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_demo_data() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;