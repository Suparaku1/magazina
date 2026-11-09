CREATE OR REPLACE FUNCTION public.dashboard_summary() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE result jsonb; statuses jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Kërkohet hyrja' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_object_agg(statusi,n),'{}'::jsonb) INTO statuses FROM (SELECT statusi,count(*) n FROM public.requests GROUP BY statusi) s;
 result := jsonb_build_object('statuses',statuses,'unread',(SELECT count(*) FROM public.notifications WHERE read_at IS NULL));
 IF public.has_role(auth.uid(),'admin') THEN
 result := result || jsonb_build_object('teachers',(SELECT count(*) FROM public.teachers),'classes',(SELECT count(*) FROM public.class_groups),'curricula',(SELECT count(*) FROM public.curricula),'unconfiguredClasses',(SELECT count(*) FROM public.class_groups WHERE curriculum_id IS NULL OR department_id IS NULL),'pendingSuggestions',(SELECT count(*) FROM public.item_suggestions WHERE statusi='ne_shqyrtim'));
 END IF;
 IF public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'magazinier') OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='shef_departamenti') THEN
 result := result || jsonb_build_object('stockItems',(SELECT count(*) FROM public.stock_balances WHERE sasia>0),'zeroStock',(SELECT count(*) FROM public.stock_balances WHERE sasia=0));
 END IF;
 RETURN result;
END $$;