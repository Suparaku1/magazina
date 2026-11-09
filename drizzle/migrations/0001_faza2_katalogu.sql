CREATE TYPE public.suggestion_status AS ENUM ('ne_shqyrtim','pranuar','bashkuar','refuzuar');

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emer text NOT NULL,
  parent_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_emer_uq ON public.categories (lower(btrim(emer)));

CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kod text NOT NULL,
  emer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX units_kod_uq ON public.units (lower(btrim(kod)));

CREATE SEQUENCE public.items_kod_seq;
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kod text NOT NULL UNIQUE DEFAULT ('ART-' || lpad(nextval('public.items_kod_seq')::text, 5, '0')),
  emer text NOT NULL CHECK (btrim(emer) <> ''),
  specifikime text,
  category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  cmim_reference numeric(14,2) CHECK (cmim_reference IS NULL OR cmim_reference >= 0),
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Parandalim dublikimesh: emër + specifikim + njësi (pa dallim shkronjash/hapësirash)
CREATE UNIQUE INDEX items_no_dup ON public.items (lower(btrim(emer)), lower(btrim(coalesce(specifikime,''))), unit_id);
CREATE INDEX items_emer_trgm ON public.items USING gin (emer gin_trgm_ops);
CREATE INDEX ON public.items(category_id);

CREATE TABLE public.item_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  sinonim text NOT NULL CHECK (btrim(sinonim) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX item_synonyms_uq ON public.item_synonyms (lower(btrim(sinonim)));
CREATE INDEX item_synonyms_trgm ON public.item_synonyms USING gin (sinonim gin_trgm_ops);
CREATE INDEX ON public.item_synonyms(item_id);

CREATE TABLE public.item_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sugjeruar_nga uuid NOT NULL DEFAULT auth.uid(),
  emer text NOT NULL CHECK (btrim(emer) <> ''),
  specifikime text,
  njesia text,
  arsye text,
  statusi public.suggestion_status NOT NULL DEFAULT 'ne_shqyrtim',
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  shenim_admin text,
  shqyrtuar_nga uuid,
  shqyrtuar_me timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.item_suggestions(statusi);
CREATE INDEX ON public.item_suggestions(sugjeruar_nga);

-- Auditim
CREATE TRIGGER audit_categories AFTER INSERT OR UPDATE OR DELETE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_units AFTER INSERT OR UPDATE OR DELETE ON public.units FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_items AFTER INSERT OR UPDATE OR DELETE ON public.items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_item_synonyms AFTER INSERT OR UPDATE OR DELETE ON public.item_synonyms FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_item_suggestions AFTER INSERT OR UPDATE OR DELETE ON public.item_suggestions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- GRANT + RLS
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','units','items','item_synonyms']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Lexim per te kyçurit" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Shkrim vetem admin" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))', t);
  END LOOP;
END $$;
GRANT USAGE ON SEQUENCE public.items_kod_seq TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_suggestions TO authenticated;
GRANT ALL ON public.item_suggestions TO service_role;
ALTER TABLE public.item_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sugjerimet e mia ose admin" ON public.item_suggestions FOR SELECT TO authenticated
  USING (sugjeruar_nga = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Dërgoj sugjerim" ON public.item_suggestions FOR INSERT TO authenticated
  WITH CHECK (sugjeruar_nga = auth.uid() AND statusi = 'ne_shqyrtim' AND item_id IS NULL AND shqyrtuar_nga IS NULL);
CREATE POLICY "Admin shqyrton" ON public.item_suggestions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Tërheq sugjerimin tim në shqyrtim" ON public.item_suggestions FOR DELETE TO authenticated
  USING (sugjeruar_nga = auth.uid() AND statusi = 'ne_shqyrtim');

-- Kërkim me emër, kod, specifikim dhe sinonime
CREATE OR REPLACE FUNCTION public.search_items(_q text, _limit int DEFAULT 30)
RETURNS TABLE (id uuid, kod text, emer text, specifikime text, njesia text, kategoria text, cmim_reference numeric, aktiv boolean, sinonime text[], score real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT i.id, i.kod, i.emer, i.specifikime, u.kod, c.emer, i.cmim_reference, i.aktiv,
         coalesce(array_agg(s.sinonim ORDER BY s.sinonim) FILTER (WHERE s.id IS NOT NULL), '{}'),
         greatest(similarity(i.emer, coalesce(_q,'')), max(similarity(coalesce(s.sinonim,''), coalesce(_q,'')))) AS score
  FROM public.items i
  JOIN public.units u ON u.id = i.unit_id
  LEFT JOIN public.categories c ON c.id = i.category_id
  LEFT JOIN public.item_synonyms s ON s.item_id = i.id
  WHERE coalesce(btrim(_q),'') = ''
     OR i.emer ILIKE '%' || _q || '%' OR i.kod ILIKE '%' || _q || '%'
     OR coalesce(i.specifikime,'') ILIKE '%' || _q || '%'
     OR i.emer % _q
     OR EXISTS (SELECT 1 FROM public.item_synonyms s2 WHERE s2.item_id = i.id AND (s2.sinonim ILIKE '%' || _q || '%' OR s2.sinonim % _q))
  GROUP BY i.id, u.kod, c.emer
  ORDER BY score DESC, i.emer
  LIMIT greatest(1, least(_limit, 200));
$$;
GRANT EXECUTE ON FUNCTION public.search_items(text, int) TO authenticated;

-- Shqyrtimi i sugjerimit: pranim (krijon artikull të ri), bashkim (me artikull ekzistues, emri bëhet sinonim), refuzim
CREATE OR REPLACE FUNCTION public.review_suggestion(_id uuid, _veprimi text, _item_id uuid DEFAULT NULL,
  _emer text DEFAULT NULL, _specifikime text DEFAULT NULL, _unit_id uuid DEFAULT NULL, _category_id uuid DEFAULT NULL, _shenim text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE s public.item_suggestions; new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Vetëm administratori shqyrton sugjerimet' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.item_suggestions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sugjerimi nuk u gjet'; END IF;
  IF s.statusi <> 'ne_shqyrtim' THEN RAISE EXCEPTION 'Sugjerimi është shqyrtuar tashmë'; END IF;
  IF _veprimi = 'pranuar' THEN
    IF _unit_id IS NULL THEN RAISE EXCEPTION 'Zgjidhni njësinë'; END IF;
    INSERT INTO public.items(emer, specifikime, unit_id, category_id)
    VALUES (coalesce(nullif(btrim(_emer),''), s.emer), coalesce(_specifikime, s.specifikime), _unit_id, _category_id)
    RETURNING id INTO new_id;
  ELSIF _veprimi = 'bashkuar' THEN
    IF _item_id IS NULL THEN RAISE EXCEPTION 'Zgjidhni artikullin ekzistues'; END IF;
    new_id := _item_id;
    INSERT INTO public.item_synonyms(item_id, sinonim)
    SELECT _item_id, s.emer
    WHERE NOT EXISTS (SELECT 1 FROM public.item_synonyms WHERE lower(btrim(sinonim)) = lower(btrim(s.emer)))
      AND NOT EXISTS (SELECT 1 FROM public.items WHERE id = _item_id AND lower(btrim(emer)) = lower(btrim(s.emer)));
  ELSIF _veprimi = 'refuzuar' THEN
    IF coalesce(btrim(_shenim),'') = '' THEN RAISE EXCEPTION 'Refuzimi kërkon arsye'; END IF;
  ELSE
    RAISE EXCEPTION 'Veprim i panjohur';
  END IF;
  UPDATE public.item_suggestions
     SET statusi = _veprimi::public.suggestion_status, item_id = new_id, shenim_admin = _shenim,
         shqyrtuar_nga = auth.uid(), shqyrtuar_me = now()
   WHERE id = _id;
  RETURN new_id;
END $$;
GRANT EXECUTE ON FUNCTION public.review_suggestion(uuid, text, uuid, text, text, uuid, uuid, text) TO authenticated;

-- Njësitë bazë të matjes (standarde, jo të dhëna të shpikura)
INSERT INTO public.units(kod, emer) VALUES
('copë','Copë'),('kompl','Komplet'),('pako','Pako'),('m','Metër'),('kg','Kilogram'),('l','Litër'),('rrotull','Rrotull'),('kuti','Kuti');
