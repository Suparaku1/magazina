CREATE TABLE public.import_batches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, lloji text NOT NULL, skedari text NOT NULL, statusi text NOT NULL DEFAULT 'perfunduar', rreshta_ok integer NOT NULL DEFAULT 0, rreshta_gabim integer NOT NULL DEFAULT 0, raport_gabimesh jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads imports" ON public.import_batches FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin records own imports" ON public.import_batches FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER audit_import_batches AFTER INSERT ON public.import_batches FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();