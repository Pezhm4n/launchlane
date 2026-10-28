-- Original runner fixture: quoted identifiers and a procedural statement are intentional.
CREATE TABLE "public"."entries" (id integer PRIMARY KEY, label text NOT NULL, note text);
DO $$ BEGIN
  IF to_regclass('public.entries') IS NULL THEN RAISE EXCEPTION 'required relation missing'; END IF;
END $$;
