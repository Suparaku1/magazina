CREATE TYPE public.request_context AS ENUM ('teori_pergjithshme','teori_profesionale','praktike_profesionale','kujdestari','laborator');
CREATE TYPE public.request_status AS ENUM ('draft','derguar','kthyer_per_korrigjim','miratuar','miratuar_pjeserisht','refuzuar','ne_permbushje','permbushur','mbyllur');
CREATE TYPE public.comment_type AS ENUM ('koment','rekomandim');

CREATE SEQUENCE public.requests_numer_seq;

CREATE TABLE public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numer text NOT NULL UNIQUE DEFAULT ('K-' || lpad(nextval('public.requests_numer_seq')::text, 5, '0')),
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  konteksti public.request_context NOT NULL,
  class_group_id uuid REFERENCES public.class_groups(id) ON DELETE RESTRICT,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE RESTRICT,
  laboratory_id uuid REFERENCES public.laboratories(id) ON DELETE RESTRICT,
  curriculum_id uuid REFERENCES public.curricula(id) ON DELETE RESTRICT,
  department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT,
  statusi public.request_status NOT NULL DEFAULT 'draft',
  arsyetimi text,
  krijuar_nga uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  derguar_me timestamptz
);
CREATE INDEX ON public.requests(teacher_id);
CREATE INDEX ON public.requests(department_id, statusi);
CREATE INDEX ON public.requests(statusi);
CREATE INDEX ON public.requests(school_year_id);

CREATE TABLE public.request_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  sasia numeric(12,2) NOT NULL CHECK (sasia > 0),
  cmim_njesi numeric(14,2) CHECK (cmim_njesi IS NULL OR cmim_njesi >= 0),
  vlera numeric(16,2) GENERATED ALWAYS AS (sasia * cmim_njesi) STORED,
  sasia_miratuar numeric(12,2) CHECK (sasia_miratuar IS NULL OR (sasia_miratuar >= 0 AND sasia_miratuar <= sasia)),
  sasia_dorezuar numeric(12,2) NOT NULL DEFAULT 0 CHECK (sasia_dorezuar >= 0),
  shenim text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, item_id)
);
CREATE INDEX ON public.request_lines(item_id);

CREATE TABLE public.request_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  vendimi public.request_status NOT NULL,
  arsye text,
  vendosur_nga uuid NOT NULL,
  kur timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.request_decisions(request_id);

CREATE TABLE public.request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  autor uuid NOT NULL DEFAULT auth.uid(),
  lloji public.comment_type NOT NULL DEFAULT 'koment',
  tekst text NOT NULL CHECK (btrim(tekst) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.request_comments(request_id);

CREATE TABLE public.request_status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  nga public.request_status,
  ne public.request_status NOT NULL,
  nga_kush uuid,
  kur timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.request_status_history(request_id);

-- ===== Funksione ndihmëse =====
CREATE OR REPLACE FUNCTION public.can_view_request(_uid uuid, _req uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _req AND (
      r.teacher_id = public.teacher_id_of(_uid)
      OR public.has_role(_uid,'admin')
      OR (r.statusi <> 'draft' AND public.has_role(_uid,'magazinier'))
      OR (r.statusi <> 'draft' AND r.department_id IS NOT NULL AND public.heads_department(_uid, r.department_id))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.request_editable_by(_uid uuid, _req uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.requests r WHERE r.id = _req
    AND r.teacher_id = public.teacher_id_of(_uid)
    AND r.statusi IN ('draft','kthyer_per_korrigjim'))
$$;

-- Validimi i kontekstit dhe caktimeve + mbrojtja e statusit
CREATE OR REPLACE FUNCTION public.requests_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lloji public.subject_type; cg public.class_groups; lab public.laboratories; subj_curr uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.statusi IS DISTINCT FROM OLD.statusi AND coalesce(current_setting('app.rpc', true),'') <> 'on' THEN
    RAISE EXCEPTION 'Statusi ndryshohet vetëm përmes veprimeve të lejuara (dërgim/vendim)' USING ERRCODE='42501';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.statusi <> 'draft' THEN
    RAISE EXCEPTION 'Kërkesa krijohet si draft' USING ERRCODE='42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.teacher_id <> OLD.teacher_id OR NEW.numer <> OLD.numer) THEN
    RAISE EXCEPTION 'Mësuesi dhe numri i kërkesës nuk ndryshojnë';
  END IF;

  -- Kontrollet e kontekstit vetëm kur kërkesa është e redaktueshme
  IF NEW.statusi IN ('draft','kthyer_per_korrigjim','derguar') THEN
    IF NEW.class_group_id IS NOT NULL THEN
      SELECT * INTO cg FROM public.class_groups WHERE id = NEW.class_group_id;
      IF cg.school_year_id <> NEW.school_year_id THEN RAISE EXCEPTION 'Klasa nuk i përket vitit shkollor të kërkesës'; END IF;
    END IF;

    IF NEW.konteksti IN ('teori_pergjithshme','teori_profesionale','praktike_profesionale') THEN
      IF NEW.class_group_id IS NULL OR NEW.subject_id IS NULL THEN RAISE EXCEPTION 'Zgjidhni klasën dhe lëndën/modulin'; END IF;
      SELECT s.lloji, s.curriculum_id INTO lloji, subj_curr FROM public.subjects s WHERE s.id = NEW.subject_id;
      IF lloji IS NULL THEN RAISE EXCEPTION 'Lloji i lëndës është "Për konfigurim". Administratori duhet ta plotësojë.'; END IF;
      IF lloji::text <> NEW.konteksti::text THEN RAISE EXCEPTION 'Konteksti nuk përputhet me llojin e lëndës/modulit'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.teaching_assignments a WHERE a.teacher_id = NEW.teacher_id AND a.school_year_id = NEW.school_year_id
                     AND a.class_group_id = NEW.class_group_id AND a.subject_id = NEW.subject_id AND a.aktiv) THEN
        RAISE EXCEPTION 'Nuk keni caktim aktiv për këtë klasë dhe lëndë' USING ERRCODE='42501';
      END IF;
      NEW.laboratory_id := NULL;
    ELSIF NEW.konteksti = 'kujdestari' THEN
      IF NEW.class_group_id IS NULL THEN RAISE EXCEPTION 'Zgjidhni klasën e kujdestarisë'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.homeroom_assignments h WHERE h.teacher_id = NEW.teacher_id AND h.school_year_id = NEW.school_year_id
                     AND h.class_group_id = NEW.class_group_id AND h.aktiv) THEN
        RAISE EXCEPTION 'Nuk jeni kujdestar/e aktiv/e i/e kësaj klase' USING ERRCODE='42501';
      END IF;
      NEW.subject_id := NULL; NEW.laboratory_id := NULL;
    ELSIF NEW.konteksti = 'laborator' THEN
      IF NEW.laboratory_id IS NULL THEN RAISE EXCEPTION 'Zgjidhni laboratorin'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.lab_assignments l WHERE l.teacher_id = NEW.teacher_id AND l.school_year_id = NEW.school_year_id
                     AND l.laboratory_id = NEW.laboratory_id AND l.aktiv) THEN
        RAISE EXCEPTION 'Nuk keni caktim aktiv në këtë laborator' USING ERRCODE='42501';
      END IF;
      SELECT * INTO lab FROM public.laboratories WHERE id = NEW.laboratory_id;
      NEW.subject_id := NULL;
    END IF;

    -- Derivimi i kurrikulës dhe departamentit
    NEW.curriculum_id := coalesce(subj_curr, cg.curriculum_id);
    NEW.department_id := coalesce(cg.department_id, lab.department_id,
                                  (SELECT department_id FROM public.curricula WHERE id = NEW.curriculum_id));
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER requests_validate BEFORE INSERT OR UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.requests_validate();

CREATE OR REPLACE FUNCTION public.requests_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.request_status_history(request_id, nga, ne, nga_kush) VALUES (NEW.id, NULL, NEW.statusi, auth.uid());
  ELSIF NEW.statusi IS DISTINCT FROM OLD.statusi THEN
    INSERT INTO public.request_status_history(request_id, nga, ne, nga_kush) VALUES (NEW.id, OLD.statusi, NEW.statusi, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER requests_history AFTER INSERT OR UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.requests_history();

-- Rreshtat: mësuesi nuk prek sasinë e miratuar/dorëzuar
CREATE OR REPLACE FUNCTION public.request_lines_protect()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.rpc', true),'') <> 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.sasia_miratuar := NULL; NEW.sasia_dorezuar := 0;
    ELSE
      NEW.sasia_miratuar := OLD.sasia_miratuar; NEW.sasia_dorezuar := OLD.sasia_dorezuar;
      IF NEW.request_id <> OLD.request_id THEN RAISE EXCEPTION 'Rreshti nuk zhvendoset në kërkesë tjetër'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER request_lines_protect BEFORE INSERT OR UPDATE ON public.request_lines
FOR EACH ROW EXECUTE FUNCTION public.request_lines_protect();

-- Auditim
CREATE TRIGGER audit_requests AFTER INSERT OR UPDATE OR DELETE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_request_lines AFTER INSERT OR UPDATE OR DELETE ON public.request_lines FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_request_decisions AFTER INSERT ON public.request_decisions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_request_comments AFTER INSERT OR UPDATE OR DELETE ON public.request_comments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ===== RPC =====
CREATE OR REPLACE FUNCTION public.submit_request(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.requests;
BEGIN
  SELECT * INTO r FROM public.requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR r.teacher_id IS DISTINCT FROM public.teacher_id_of(auth.uid()) THEN
    RAISE EXCEPTION 'Kërkesa nuk u gjet ose nuk është e juaja' USING ERRCODE='42501';
  END IF;
  IF r.statusi NOT IN ('draft','kthyer_per_korrigjim') THEN RAISE EXCEPTION 'Kërkesa nuk mund të dërgohet në këtë status'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.request_lines WHERE request_id = _id) THEN RAISE EXCEPTION 'Shtoni të paktën një artikull'; END IF;
  PERFORM set_config('app.rpc','on', true);
  UPDATE public.requests SET statusi = 'derguar', derguar_me = now() WHERE id = _id;
  PERFORM set_config('app.rpc','off', true);
END $$;

-- _vendimi: 'mirato' | 'kthe' | 'refuzo'; _lines: [{"line_id": "...", "sasia_miratuar": 3}]
CREATE OR REPLACE FUNCTION public.decide_request(_id uuid, _vendimi text, _arsye text DEFAULT NULL, _lines jsonb DEFAULT NULL)
RETURNS public.request_status LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.requests; new_status public.request_status; total_req numeric; total_ok numeric; any_partial boolean;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Vetëm administratori vendos për kërkesat' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kërkesa nuk u gjet'; END IF;
  IF r.statusi <> 'derguar' THEN RAISE EXCEPTION 'Vendimi merret vetëm për kërkesat e dërguara'; END IF;

  PERFORM set_config('app.rpc','on', true);
  IF _vendimi = 'mirato' THEN
    IF _lines IS NULL THEN
      UPDATE public.request_lines SET sasia_miratuar = sasia WHERE request_id = _id;
    ELSE
      UPDATE public.request_lines l SET sasia_miratuar = coalesce((
        SELECT (e->>'sasia_miratuar')::numeric FROM jsonb_array_elements(_lines) e WHERE (e->>'line_id')::uuid = l.id), 0)
      WHERE l.request_id = _id;
    END IF;
    SELECT sum(sasia), sum(sasia_miratuar), bool_or(sasia_miratuar < sasia) INTO total_req, total_ok, any_partial
      FROM public.request_lines WHERE request_id = _id;
    IF coalesce(total_ok,0) = 0 THEN RAISE EXCEPTION 'Asnjë sasi e miratuar. Përdorni "Refuzo" me arsye.'; END IF;
    new_status := CASE WHEN any_partial THEN 'miratuar_pjeserisht' ELSE 'miratuar' END;
    IF new_status = 'miratuar_pjeserisht' AND coalesce(btrim(_arsye),'') = '' THEN RAISE EXCEPTION 'Miratimi i pjesshëm kërkon arsye'; END IF;
  ELSIF _vendimi = 'kthe' THEN
    IF coalesce(btrim(_arsye),'') = '' THEN RAISE EXCEPTION 'Kthimi për korrigjim kërkon arsye'; END IF;
    UPDATE public.request_lines SET sasia_miratuar = NULL WHERE request_id = _id;
    new_status := 'kthyer_per_korrigjim';
  ELSIF _vendimi = 'refuzo' THEN
    IF coalesce(btrim(_arsye),'') = '' THEN RAISE EXCEPTION 'Refuzimi kërkon arsye'; END IF;
    UPDATE public.request_lines SET sasia_miratuar = 0 WHERE request_id = _id;
    new_status := 'refuzuar';
  ELSE
    RAISE EXCEPTION 'Vendim i panjohur';
  END IF;
  UPDATE public.requests SET statusi = new_status WHERE id = _id;
  PERFORM set_config('app.rpc','off', true);
  INSERT INTO public.request_decisions(request_id, vendimi, arsye, vendosur_nga) VALUES (_id, new_status, nullif(btrim(_arsye),''), auth.uid());
  RETURN new_status;
END $$;

REVOKE EXECUTE ON FUNCTION public.submit_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_request(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_request(uuid, text, text, jsonb) TO authenticated;

-- ===== GRANT + RLS =====
GRANT USAGE ON SEQUENCE public.requests_numer_seq TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shikoj kërkesat e lejuara" ON public.requests FOR SELECT TO authenticated
  USING (public.can_view_request(auth.uid(), id));
CREATE POLICY "Mësuesi krijon kërkesën e vet" ON public.requests FOR INSERT TO authenticated
  WITH CHECK (teacher_id = public.teacher_id_of(auth.uid()) AND krijuar_nga = auth.uid());
CREATE POLICY "Mësuesi redakton draftin" ON public.requests FOR UPDATE TO authenticated
  USING (teacher_id = public.teacher_id_of(auth.uid()) AND statusi IN ('draft','kthyer_per_korrigjim'))
  WITH CHECK (teacher_id = public.teacher_id_of(auth.uid()));
CREATE POLICY "Mësuesi fshin draftin" ON public.requests FOR DELETE TO authenticated
  USING (teacher_id = public.teacher_id_of(auth.uid()) AND statusi = 'draft');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_lines TO authenticated;
GRANT ALL ON public.request_lines TO service_role;
ALTER TABLE public.request_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shikoj rreshtat" ON public.request_lines FOR SELECT TO authenticated
  USING (public.can_view_request(auth.uid(), request_id));
CREATE POLICY "Shtoj rreshta në draft" ON public.request_lines FOR INSERT TO authenticated
  WITH CHECK (public.request_editable_by(auth.uid(), request_id));
CREATE POLICY "Ndryshoj rreshta në draft" ON public.request_lines FOR UPDATE TO authenticated
  USING (public.request_editable_by(auth.uid(), request_id)) WITH CHECK (public.request_editable_by(auth.uid(), request_id));
CREATE POLICY "Fshij rreshta në draft" ON public.request_lines FOR DELETE TO authenticated
  USING (public.request_editable_by(auth.uid(), request_id));

GRANT SELECT ON public.request_decisions TO authenticated;
GRANT ALL ON public.request_decisions TO service_role;
ALTER TABLE public.request_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shikoj vendimet" ON public.request_decisions FOR SELECT TO authenticated
  USING (public.can_view_request(auth.uid(), request_id));

GRANT SELECT ON public.request_status_history TO authenticated;
GRANT ALL ON public.request_status_history TO service_role;
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shikoj historikun" ON public.request_status_history FOR SELECT TO authenticated
  USING (public.can_view_request(auth.uid(), request_id));

GRANT SELECT, INSERT ON public.request_comments TO authenticated;
GRANT ALL ON public.request_comments TO service_role;
ALTER TABLE public.request_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shikoj komentet" ON public.request_comments FOR SELECT TO authenticated
  USING (public.can_view_request(auth.uid(), request_id));
CREATE POLICY "Komentoj" ON public.request_comments FOR INSERT TO authenticated
  WITH CHECK (
    autor = auth.uid() AND public.can_view_request(auth.uid(), request_id)
    AND (lloji = 'koment' OR EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND r.department_id IS NOT NULL AND public.heads_department(auth.uid(), r.department_id)))
  );
