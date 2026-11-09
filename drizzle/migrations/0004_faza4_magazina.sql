CREATE TYPE public.stock_movement_type AS ENUM ('inventar_fillestar','hyrje','dalje','kthim','korrigjim');

CREATE TABLE public.stock_balances (
  item_id uuid PRIMARY KEY REFERENCES public.items(id),
  sasia numeric NOT NULL DEFAULT 0 CHECK (sasia >= 0),
  perditesuar_me timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stock_movements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES public.items(id),
  lloji public.stock_movement_type NOT NULL,
  sasia numeric NOT NULL CHECK (sasia <> 0),
  bilanci_pas numeric NOT NULL CHECK (bilanci_pas >= 0),
  cmim_njesi numeric CHECK (cmim_njesi IS NULL OR cmim_njesi >= 0),
  request_line_id uuid REFERENCES public.request_lines(id),
  dokument text,
  arsye text,
  kryer_nga uuid NOT NULL,
  kur timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_item_idx ON public.stock_movements(item_id, kur DESC);
CREATE INDEX stock_movements_line_idx ON public.stock_movements(request_line_id);
CREATE INDEX stock_movements_kur_idx ON public.stock_movements(kur DESC);

GRANT SELECT ON public.stock_balances TO authenticated;
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_balances TO service_role;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bilancet: admin, magazinier, shef" ON public.stock_balances FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'magazinier') OR public.has_role(auth.uid(),'shef_departamenti'));
CREATE POLICY "Lëvizjet: admin, magazinier" ON public.stock_movements FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'magazinier'));

CREATE OR REPLACE FUNCTION public.stock_protect() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND TG_TABLE_NAME = 'stock_movements' THEN
    RAISE EXCEPTION 'Historiku i magazinës nuk ndryshohet dhe nuk fshihet. Regjistroni një korrigjim.' USING ERRCODE='42501';
  END IF;
  IF coalesce(current_setting('app.rpc', true),'') <> 'on' THEN
    RAISE EXCEPTION 'Magazina ndryshohet vetëm përmes regjistrimit të lëvizjeve' USING ERRCODE='42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER stock_movements_protect BEFORE INSERT OR UPDATE OR DELETE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.stock_protect();
CREATE TRIGGER stock_movements_truncate BEFORE TRUNCATE ON public.stock_movements FOR EACH STATEMENT EXECUTE FUNCTION public.stock_protect();
CREATE TRIGGER stock_balances_protect BEFORE INSERT OR UPDATE OR DELETE ON public.stock_balances FOR EACH ROW EXECUTE FUNCTION public.stock_protect();
CREATE TRIGGER stock_movements_audit AFTER INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE OR REPLACE FUNCTION public.record_stock_movement(
  _item_id uuid, _lloji text, _sasia numeric, _cmim_njesi numeric DEFAULT NULL,
  _request_line_id uuid DEFAULT NULL, _dokument text DEFAULT NULL, _arsye text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  t public.stock_movement_type;
  delta numeric;
  cur numeric;
  ln public.request_lines;
  rq public.requests;
  mid bigint;
  open_lines int;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'magazinier') OR public.has_role(uid,'admin')) THEN
    RAISE EXCEPTION 'Vetëm magazinieri ose administratori regjistron lëvizje magazine' USING ERRCODE='42501';
  END IF;
  t := _lloji::public.stock_movement_type;
  IF _sasia IS NULL OR _sasia = 0 THEN RAISE EXCEPTION 'Sasia duhet të jetë e ndryshme nga zero'; END IF;
  IF t <> 'korrigjim' AND _sasia < 0 THEN RAISE EXCEPTION 'Sasia duhet të jetë pozitive'; END IF;
  IF t = 'korrigjim' AND coalesce(btrim(_arsye),'') = '' THEN RAISE EXCEPTION 'Korrigjimi kërkon arsye'; END IF;
  IF t IN ('kthim') AND _request_line_id IS NULL AND coalesce(btrim(_arsye),'') = '' THEN
    RAISE EXCEPTION 'Kthimi pa lidhje me kërkesë kërkon arsye';
  END IF;
  IF t IN ('inventar_fillestar','hyrje','korrigjim') AND _request_line_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ky lloj lëvizjeje nuk lidhet me kërkesë';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.items WHERE id = _item_id) THEN RAISE EXCEPTION 'Artikulli nuk ekziston'; END IF;
  IF t = 'inventar_fillestar' AND EXISTS (SELECT 1 FROM public.stock_movements WHERE item_id = _item_id) THEN
    RAISE EXCEPTION 'Ky artikull ka tashmë lëvizje; përdorni hyrje ose korrigjim';
  END IF;

  delta := CASE WHEN t = 'dalje' THEN -_sasia ELSE _sasia END;

  PERFORM set_config('app.rpc','on', true);

  INSERT INTO public.stock_balances(item_id, sasia) VALUES (_item_id, 0) ON CONFLICT (item_id) DO NOTHING;
  SELECT sasia INTO cur FROM public.stock_balances WHERE item_id = _item_id FOR UPDATE;
  IF cur + delta < 0 THEN
    RAISE EXCEPTION 'Gjendja nuk mjafton: në magazinë % , kërkohet %', cur, abs(delta);
  END IF;

  IF _request_line_id IS NOT NULL THEN
    SELECT * INTO ln FROM public.request_lines WHERE id = _request_line_id FOR UPDATE;
    IF ln.id IS NULL THEN RAISE EXCEPTION 'Rreshti i kërkesës nuk ekziston'; END IF;
    IF ln.item_id <> _item_id THEN RAISE EXCEPTION 'Artikulli nuk përputhet me rreshtin e kërkesës'; END IF;
    SELECT * INTO rq FROM public.requests WHERE id = ln.request_id FOR UPDATE;
    IF rq.statusi NOT IN ('miratuar','miratuar_pjeserisht','ne_permbushje','permbushur') THEN
      RAISE EXCEPTION 'Kërkesa nuk është e miratuar për dorëzim';
    END IF;
    IF t = 'dalje' THEN
      IF ln.sasia_dorezuar + _sasia > coalesce(ln.sasia_miratuar,0) THEN
        RAISE EXCEPTION 'Dorëzimi kalon sasinë e miratuar (miratuar %, dorëzuar %)', coalesce(ln.sasia_miratuar,0), ln.sasia_dorezuar;
      END IF;
      UPDATE public.request_lines SET sasia_dorezuar = sasia_dorezuar + _sasia WHERE id = ln.id;
    ELSIF t = 'kthim' THEN
      IF _sasia > ln.sasia_dorezuar THEN RAISE EXCEPTION 'Kthimi kalon sasinë e dorëzuar (%)', ln.sasia_dorezuar; END IF;
      UPDATE public.request_lines SET sasia_dorezuar = sasia_dorezuar - _sasia WHERE id = ln.id;
    END IF;
    SELECT count(*) INTO open_lines FROM public.request_lines
      WHERE request_id = rq.id AND coalesce(sasia_miratuar,0) > sasia_dorezuar;
    UPDATE public.requests SET statusi = CASE
        WHEN open_lines = 0 THEN 'permbushur'::public.request_status
        WHEN EXISTS (SELECT 1 FROM public.request_lines WHERE request_id = rq.id AND sasia_dorezuar > 0) THEN 'ne_permbushje'::public.request_status
        ELSE (SELECT d.vendimi FROM public.request_decisions d WHERE d.request_id = rq.id ORDER BY d.kur DESC LIMIT 1) END
      WHERE id = rq.id;
  END IF;

  UPDATE public.stock_balances SET sasia = cur + delta, perditesuar_me = now() WHERE item_id = _item_id;
  INSERT INTO public.stock_movements(item_id, lloji, sasia, bilanci_pas, cmim_njesi, request_line_id, dokument, arsye, kryer_nga)
  VALUES (_item_id, t, delta, cur + delta, _cmim_njesi, _request_line_id, nullif(btrim(_dokument),''), nullif(btrim(_arsye),''), uid)
  RETURNING id INTO mid;

  PERFORM set_config('app.rpc','off', true);
  RETURN mid;
END $$;

REVOKE ALL ON FUNCTION public.record_stock_movement(uuid,text,numeric,numeric,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(uuid,text,numeric,numeric,uuid,text,text) TO authenticated;