CREATE FUNCTION public.commit_excel_import(_kind text, _rows jsonb, _filename text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r jsonb; results jsonb := '[]'::jsonb; idx integer:=2; total integer;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Importet kryhen vetëm nga administratori' USING ERRCODE='42501'; END IF;
 IF _kind NOT IN ('mesues','klasa','caktime','katalog','inventar') OR jsonb_typeof(_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Import i pavlefshëm'; END IF;
 total:=jsonb_array_length(_rows);
 IF total<1 OR total>1000 OR length(_filename)>255 THEN RAISE EXCEPTION 'Import i pavlefshëm'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
  IF _kind='mesues' THEN
   INSERT INTO public.teachers(emer,mbiemer,email,department_id,lendet_sipas_listes) VALUES(r->>'emer',r->>'mbiemer',r->>'email',(r->>'department_id')::uuid,r->>'lendet_sipas_listes');
  ELSIF _kind='klasa' THEN
   INSERT INTO public.class_groups(emer,nivel,school_year_id,department_id,curriculum_id) VALUES(r->>'emer',(r->>'nivel')::smallint,(r->>'school_year_id')::uuid,(r->>'department_id')::uuid,(r->>'curriculum_id')::uuid);
  ELSIF _kind='caktime' THEN
   INSERT INTO public.teaching_assignments(teacher_id,school_year_id,class_group_id,subject_id) VALUES((r->>'teacher_id')::uuid,(r->>'school_year_id')::uuid,(r->>'class_group_id')::uuid,(r->>'subject_id')::uuid);
  ELSIF _kind='katalog' THEN
   INSERT INTO public.items(emer,specifikime,unit_id,category_id,cmim_reference) VALUES(r->>'emer',r->>'specifikime',(r->>'unit_id')::uuid,(r->>'category_id')::uuid,(r->>'cmim_reference')::numeric);
  ELSE
   PERFORM public.record_stock_movement((r->>'item_id')::uuid,'inventar_fillestar',(r->>'sasia')::numeric,(r->>'cmim_njesi')::numeric,NULL,r->>'dokument',NULL);
  END IF;
  results:=results || jsonb_build_array(jsonb_build_object('row',idx,'ok',true,'error',''));
  idx:=idx+1;
 END LOOP;
 INSERT INTO public.import_batches(user_id,lloji,skedari,rreshta_ok,rreshta_gabim,raport_gabimesh) VALUES(auth.uid(),_kind,_filename,total,0,results);
END $$;
REVOKE ALL ON FUNCTION public.commit_excel_import(text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.commit_excel_import(text,jsonb,text) TO authenticated;