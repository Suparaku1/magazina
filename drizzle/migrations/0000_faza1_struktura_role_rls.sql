-- FAZA 1: struktura akademike, njerëzit, rolet, auditimi, RLS
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE public.app_role AS ENUM ('admin','shef_departamenti','mesues','magazinier');
CREATE TYPE public.subject_type AS ENUM ('teori_pergjithshme','teori_profesionale','praktike_profesionale');

-- ===== Tabelat =====
CREATE TABLE public.school_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emer text NOT NULL UNIQUE,
  data_fillimi date,
  data_mbarimi date,
  aktiv boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_mbarimi IS NULL OR data_fillimi IS NULL OR data_mbarimi > data_fillimi)
);
CREATE UNIQUE INDEX school_years_one_active ON public.school_years (aktiv) WHERE aktiv;

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kod text NOT NULL UNIQUE,
  emer text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.curricula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kod text NOT NULL UNIQUE,
  emer text NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  drejtimi text,
  profili text,
  niveli text,
  shenim text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.curricula(department_id);

CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id uuid REFERENCES public.curricula(id) ON DELETE RESTRICT,
  kod text,
  emer text NOT NULL,
  lloji public.subject_type,
  klasa_nivel smallint CHECK (klasa_nivel BETWEEN 10 AND 13),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (curriculum_id, emer, klasa_nivel)
);
CREATE INDEX ON public.subjects(curriculum_id);

CREATE TABLE public.class_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  emer text NOT NULL,
  nivel smallint NOT NULL CHECK (nivel BETWEEN 10 AND 13),
  department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT,
  curriculum_id uuid REFERENCES public.curricula(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_year_id, emer)
);
CREATE INDEX ON public.class_groups(department_id);
CREATE INDEX ON public.class_groups(curriculum_id);

CREATE TABLE public.laboratories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emer text NOT NULL UNIQUE,
  department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT,
  pershkrim text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  emer text NOT NULL,
  mbiemer text,
  email citext UNIQUE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  lendet_sipas_listes text,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.teachers(department_id);

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  emer_shfaqur text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (user_id, role, department_id),
  CHECK ((role = 'shef_departamenti') = (department_id IS NOT NULL))
);

-- Role të caktuara për mësues që ende s'kanë llogari; aplikohen kur llogaria krijohet
CREATE TABLE public.pending_role_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (teacher_id, role, department_id),
  CHECK ((role = 'shef_departamenti') = (department_id IS NOT NULL))
);

CREATE TABLE public.teaching_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  class_group_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, school_year_id, class_group_id, subject_id)
);
CREATE INDEX ON public.teaching_assignments(teacher_id, school_year_id);

CREATE TABLE public.homeroom_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  class_group_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE RESTRICT,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_year_id, class_group_id)
);
CREATE INDEX ON public.homeroom_assignments(teacher_id);

CREATE TABLE public.lab_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
  laboratory_id uuid NOT NULL REFERENCES public.laboratories(id) ON DELETE RESTRICT,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, school_year_id, laboratory_id)
);

CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabela text NOT NULL,
  rekordi_id text,
  veprimi text NOT NULL,
  te_vjetra jsonb,
  te_rejat jsonb,
  user_id uuid,
  kur timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_log(tabela, kur DESC);

-- ===== Funksione ndihmëse =====
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.heads_department(_user_id uuid, _dept uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'shef_departamenti' AND department_id = _dept)
$$;

CREATE OR REPLACE FUNCTION public.teacher_id_of(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.teachers WHERE user_id = _user_id
$$;

-- Auditim gjenerik
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log(tabela, rekordi_id, veprimi, te_vjetra, te_rejat, user_id)
  VALUES (TG_TABLE_NAME,
          COALESCE((to_jsonb(NEW)->>'id'),(to_jsonb(OLD)->>'id'),(to_jsonb(NEW)->>'user_id'),(to_jsonb(OLD)->>'user_id')),
          TG_OP,
          CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
          auth.uid());
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['school_years','departments','curricula','subjects','class_groups','laboratories','teachers','user_roles','pending_role_grants','teaching_assignments','homeroom_assignments','lab_assignments']
  LOOP
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t);
  END LOOP;
END $$;

-- Lidhja e llogarisë së re me mësuesin (sipas email-it) dhe aplikimi i roleve në pritje
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t_id uuid;
BEGIN
  INSERT INTO public.profiles(user_id, emer_shfaqur) VALUES (NEW.id, NEW.raw_user_meta_data->>'emer_shfaqur')
  ON CONFLICT DO NOTHING;
  UPDATE public.teachers SET user_id = NEW.id
   WHERE email = NEW.email::citext AND user_id IS NULL
   RETURNING id INTO t_id;
  IF t_id IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role, department_id)
    SELECT NEW.id, role, department_id FROM public.pending_role_grants WHERE teacher_id = t_id
    ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'mesues') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== GRANT + RLS =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['school_years','departments','curricula','subjects','class_groups','laboratories','teachers','teaching_assignments','homeroom_assignments','lab_assignments','pending_role_grants']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Lexim per te kyçurit" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Shkrim vetem admin" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))', t);
  END LOOP;
END $$;

-- pending_role_grants: lexim vetëm admin (rishkruajmë politikën e leximit)
DROP POLICY "Lexim per te kyçurit" ON public.pending_role_grants;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rolet e mia ose admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin menaxhon rolet" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profili im ose admin" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Përditësoj profilin tim" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auditimi vetem admin" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ===== SEED (vetëm të dhëna të konfirmuara) =====
INSERT INTO public.school_years(emer, aktiv) VALUES ('2026–2027', true);
INSERT INTO public.departments(kod, emer) VALUES ('TIK','TIK'), ('ELEK','Elektroteknikë');

INSERT INTO public.curricula(kod, emer, department_id, drejtimi, niveli, shenim)
SELECT 'E-II-24','Elektroteknikë', id, 'Elektroteknikë','II','Shembull për klasat 10–11 (dokument i ngarkuar)' FROM public.departments WHERE kod='ELEK';
INSERT INTO public.curricula(kod, emer, department_id, drejtimi, niveli)
SELECT 'SK-T2-IV-21','Mbështetje përdoruesve TIK', id, 'TIK','IV' FROM public.departments WHERE kod='TIK';
INSERT INTO public.curricula(kod, emer, department_id, drejtimi, niveli)
SELECT 'SK-T3-IV-21','Zhvillim website', id, 'TIK','IV' FROM public.departments WHERE kod='TIK';

-- Mësuesit nga "Numrat e mësuesve sipas orarit të përditësuar" (2026–2027). Pa email (Për konfigurim).
INSERT INTO public.teachers(emer, mbiemer, lendet_sipas_listes) VALUES
('Elida','Mesi','Rrjeta kompjuterike'),('Loreta','Polaj','Programim'),('Luiza','Gjinollari','Fizikë'),
('Jonida','Haxhi','Bazat e elektronikës'),('Ilda','Shahu','Gjuhë shqipe/Letërsi'),('Adelina','Çipllaka','Gjuhë shqipe/Letërsi'),
('Anila','Ajdini','Gjuhë shqipe/Letërsi'),('Lirije','Pjeternikaj','Gjuhë shqipe/Letërsi'),('Etra','Vendresha','Anglisht'),
('Megi','Shaba','Anglisht'),('Lediana','Goci','Anglisht'),('Tetis','Marku','Anglisht'),('Rovena','Aliko','Gjermanisht'),
('Elda','Laçka','Gjermanisht'),('Oriada','Balla','Matematikë'),('Ersuesla','Spari','Matematikë'),('Shpresa','Pepnikaj','Matematikë'),
('Bujas','Zeka','Matematikë'),('Safie','Plaku','Fizikë/Mjedis dhe zhvillim i qëndrueshëm'),('Era','Basha','Fizikë'),
('Mimoza','Zita','Biologji'),('Adelina','Kushta','Kimi/Biologji'),('Aleksandra','Iliazi','Kimi'),('Vasil','Dedja','Shkenca sociale'),
('Valentina','Qelia','Histori'),('Elida','Boka','Histori'),('Laerta','Bollo','Gjeografi/Shkenca sociale'),
('Soni','Duka','Edukim fizik, sporte, shëndet'),('Naim','Seferi','Edukim fizik, sporte, shëndet'),('Gerti','Sharra','Edukim fizik, sporte, shëndet'),
('Trendafile','Mustafa','TIK; Bazat e TIK; Programe aplikative'),
('Enola','Gjoni','Makina elektrike; Elektroteknikë dhe matje elektrike dhe elektronike'),('Arbesa','Palushi','Elektronikë'),
('Marsida','Boshnjaku','Bazat e linjave të automatizuara'),
('Laert','Kokthi','Praktikë profesionale; Telekomunikacion; Rrjetet e komunikimit; TIK në riparimin e pajisjeve elektronike; Riparimi i pajisjeve elektronike; Sisteme elektronike; Rrjete kompjuterike'),
('Dorina','Cumani','B. e sipërmarrjes/Drejtim dhe ligjshmëri'),('Adrian','Keri','Bazat e sipërmarrjes'),
('Esmerald','Suparaku','Elektronikë fuqie; Zhvillim projektesh; Programim në web; Zhvillim frontend; Sigurim teknik në punë'),
('Lumturi','Marku','Arkitektura hardware dhe software në TIK; Bazat e programimit'),
('Jonida','Kokthi','Programim në C++; Bazat e programimit në web'),
('Denis','Lekli','Dizenjim aplikacionesh; Arkitektura e aplikimeve web; Programim'),
('Erald','Mali','Programim në rrjete; Bazat e sigurisë së të dhënave; Diagnostikimi dhe asistenca teknike në distancë'),
('Eni','Xhogu','Bazat e të dhënave'),('Antonio','Arapi','Rrjete kompjuterike; Arkitekturë kompjuteri dhe rrjetesh kompjuterike'),
('Kledio','Dodaj','Siguri kibernetike; Siguria në rrjete të dhënash; Administrim rrjetesh kompjuterike'),
('Abaz','Shehu','Administrim sistemesh shfrytëzimi'),
('Mirela','Hoxha','Sistemet operative në mjediset hardware; Diagnostikimi dhe asistenca teknike në distancë');

-- Drejtuesit (edhe mësues)
INSERT INTO public.teachers(emer, mbiemer, lendet_sipas_listes) VALUES ('Silvana','Kasemi', NULL), ('Ornela', NULL, NULL);
INSERT INTO public.teachers(emer, mbiemer, department_id, lendet_sipas_listes)
SELECT 'Xhiana','Lapi', id, 'Bazat e elektroteknikës; Elektronikë dhe procese automatizimi; Transmisionet dhe rrjeta elektrike; Teknologji elektrike' FROM public.departments WHERE kod='ELEK';
UPDATE public.teachers SET department_id = (SELECT id FROM public.departments WHERE kod='TIK') WHERE emer='Ornela' AND mbiemer IS NULL;

INSERT INTO public.pending_role_grants(teacher_id, role, department_id)
SELECT id, 'admin', NULL FROM public.teachers WHERE emer='Silvana' AND mbiemer='Kasemi';
INSERT INTO public.pending_role_grants(teacher_id, role, department_id)
SELECT t.id, 'shef_departamenti', d.id FROM public.teachers t, public.departments d WHERE t.emer='Ornela' AND t.mbiemer IS NULL AND d.kod='TIK';
INSERT INTO public.pending_role_grants(teacher_id, role, department_id)
SELECT t.id, 'shef_departamenti', d.id FROM public.teachers t, public.departments d WHERE t.emer='Xhiana' AND t.mbiemer='Lapi' AND d.kod='ELEK';
