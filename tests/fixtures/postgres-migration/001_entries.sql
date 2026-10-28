CREATE TABLE public.entries (
  id integer PRIMARY KEY,
  label text NOT NULL,
  note text
);
INSERT INTO public.entries(id,label) VALUES (7,'original datum');
