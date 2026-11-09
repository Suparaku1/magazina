DO $$ DECLARE definition text; BEGIN
SELECT pg_get_functiondef('public.record_stock_movement(uuid,text,numeric,numeric,uuid,text,text)'::regprocedure) INTO definition;
definition := replace(definition, 'IF _sasia IS NULL OR _sasia = 0 THEN', 'IF _sasia IS NULL OR _sasia::text IN (''NaN'',''Infinity'',''-Infinity'') OR _sasia = 0 THEN');
definition := replace(definition, 'IF t = ''inventar_fillestar'' AND EXISTS (SELECT 1 FROM public.stock_movements WHERE item_id = _item_id) THEN', 'PERFORM pg_advisory_xact_lock(hashtextextended(_item_id::text, 0));
  IF t = ''inventar_fillestar'' AND EXISTS (SELECT 1 FROM public.stock_movements WHERE item_id = _item_id) THEN');
EXECUTE definition;
END $$;
CREATE OR REPLACE FUNCTION public.stock_protect() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
IF TG_OP = 'TRUNCATE' THEN RAISE EXCEPTION 'Historiku i magazinës nuk fshihet' USING ERRCODE='42501'; END IF;
IF TG_OP IN ('UPDATE','DELETE') AND TG_TABLE_NAME = 'stock_movements' THEN RAISE EXCEPTION 'Historiku i magazinës nuk ndryshohet dhe nuk fshihet. Regjistroni një korrigjim.' USING ERRCODE='42501'; END IF;
IF coalesce(current_setting('app.rpc',true),'') <> 'on' THEN RAISE EXCEPTION 'Magazina ndryshohet vetëm përmes regjistrimit të lëvizjeve' USING ERRCODE='42501'; END IF;
RETURN COALESCE(NEW,OLD); END $$;