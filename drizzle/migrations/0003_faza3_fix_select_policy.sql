DROP POLICY "Shikoj kërkesat e lejuara" ON public.requests;
CREATE POLICY "Shikoj kërkesat e lejuara" ON public.requests FOR SELECT TO authenticated
  USING (
    teacher_id = public.teacher_id_of(auth.uid())
    OR public.has_role(auth.uid(),'admin')
    OR (statusi <> 'draft' AND public.has_role(auth.uid(),'magazinier'))
    OR (statusi <> 'draft' AND department_id IS NOT NULL AND public.heads_department(auth.uid(), department_id))
  );