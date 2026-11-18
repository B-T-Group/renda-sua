CREATE OR REPLACE FUNCTION public.normalized_country_key(p_country text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(btrim(COALESCE(p_country, '')));
$$;
