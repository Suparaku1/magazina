CREATE TABLE public.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
 titulli text NOT NULL,
 mesazhi text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_read_own ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.can_view_request(auth.uid(), request_id));
CREATE POLICY notifications_mark_own ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid() AND public.can_view_request(auth.uid(), request_id)) WITH CHECK (user_id = auth.uid() AND public.can_view_request(auth.uid(), request_id));
CREATE INDEX notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;

CREATE FUNCTION public.notify_request_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid; label text;
BEGIN
 IF NEW.statusi IS NOT DISTINCT FROM OLD.statusi THEN RETURN NEW; END IF;
 SELECT user_id INTO owner_id FROM public.teachers WHERE id = NEW.teacher_id;
 IF NEW.statusi = 'derguar' THEN
   INSERT INTO public.notifications(user_id,request_id,titulli,mesazhi)
   SELECT DISTINCT ur.user_id,NEW.id,'Kërkesë për shqyrtim',NEW.numer || ' u dërgua për shqyrtim.' FROM public.user_roles ur
   WHERE ur.role = 'admin' OR (ur.role = 'shef_departamenti' AND ur.department_id = NEW.department_id);
 ELSIF NEW.statusi IN ('miratuar','miratuar_pjeserisht','refuzuar','kthyer_per_korrigjim') THEN
   label := CASE NEW.statusi WHEN 'miratuar' THEN 'Miratuar' WHEN 'miratuar_pjeserisht' THEN 'Miratuar pjesërisht' WHEN 'refuzuar' THEN 'Refuzuar' ELSE 'Kthyer për korrigjim' END;
   IF owner_id IS NOT NULL THEN INSERT INTO public.notifications(user_id,request_id,titulli,mesazhi) VALUES(owner_id,NEW.id,'Vendim për kërkesën',NEW.numer || ': ' || label || '.'); END IF;
   IF NEW.statusi IN ('miratuar','miratuar_pjeserisht') THEN
     INSERT INTO public.notifications(user_id,request_id,titulli,mesazhi)
     SELECT DISTINCT user_id,NEW.id,'Kërkesë për dorëzim',NEW.numer || ': ' || label || '.' FROM public.user_roles WHERE role = 'magazinier' AND user_id IS DISTINCT FROM owner_id;
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_request_status() FROM PUBLIC;
CREATE TRIGGER notify_request_status AFTER UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.notify_request_status();

CREATE FUNCTION public.notify_request_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.requests; owner_id uuid;
BEGIN
 IF NEW.request_line_id IS NULL OR NEW.lloji NOT IN ('dalje','kthim') THEN RETURN NEW; END IF;
 SELECT req.* INTO r FROM public.requests req JOIN public.request_lines l ON l.request_id=req.id WHERE l.id=NEW.request_line_id;
 SELECT user_id INTO owner_id FROM public.teachers WHERE id=r.teacher_id;
 IF owner_id IS NOT NULL THEN
 INSERT INTO public.notifications(user_id,request_id,titulli,mesazhi) VALUES(owner_id,r.id,CASE WHEN NEW.lloji='dalje' THEN 'Dorëzim i regjistruar' ELSE 'Kthim i regjistruar' END,r.numer || ': u regjistrua ' || CASE WHEN NEW.lloji='dalje' THEN 'dorëzim' ELSE 'kthim' END || ' në magazinë.');
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_request_delivery() FROM PUBLIC;
CREATE TRIGGER notify_request_delivery AFTER INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.notify_request_delivery();

CREATE FUNCTION public.dashboard_summary() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE result jsonb; statuses jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Kërkohet hyrja' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_object_agg(statusi,n),'{}'::jsonb) INTO statuses FROM (SELECT statusi,count(*) n FROM public.requests GROUP BY statusi) s;
 result := jsonb_build_object('statuses',statuses,'unread',(SELECT count(*) FROM public.notifications WHERE read_at IS NULL));
 IF public.has_role(auth.uid(),'admin') THEN
 result := result || jsonb_build_object('teachers',(SELECT count(*) FROM public.teachers),'classes',(SELECT count(*) FROM public.class_groups),'curricula',(SELECT count(*) FROM public.curricula),'unconfiguredClasses',(SELECT count(*) FROM public.class_groups WHERE curriculum_id IS NULL OR department_id IS NULL),'pendingSuggestions',(SELECT count(*) FROM public.item_suggestions WHERE statusi='ne_pritje'));
 END IF;
 IF public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'magazinier') OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='shef_departamenti') THEN
 result := result || jsonb_build_object('stockItems',(SELECT count(*) FROM public.stock_balances WHERE sasia>0),'zeroStock',(SELECT count(*) FROM public.stock_balances WHERE sasia=0));
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_summary() TO authenticated;