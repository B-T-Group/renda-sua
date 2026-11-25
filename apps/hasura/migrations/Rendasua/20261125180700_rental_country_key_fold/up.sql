-- Trim every kind of whitespace the JS country key trims, and uppercase
-- under the C collation so accented names match even when upper() leaves
-- é unchanged. The regexp and the Latin maps are COUNTRY_KEY_EDGE,
-- COUNTRY_KEY_LOWER and COUNTRY_KEY_UPPER in delivery-pricing.util.ts.

CREATE OR REPLACE FUNCTION public.normalized_country_key(p_country text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    upper((
      regexp_replace(COALESCE(p_country, ''), '^[\t\n\u000b\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\t\n\u000b\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$', '', 'g') COLLATE "C"
    )),
    'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýÿœ',
    'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝŸŒ'
  );
$$;
