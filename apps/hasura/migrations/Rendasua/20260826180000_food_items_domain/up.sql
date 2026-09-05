-- Food items domain: a dedicated category for cooked food sold by restaurants,
-- per-location weekly availability windows and a day-scoped sold-out flag.

-- The original item_categories seed inserted explicit ids without advancing the
-- sequence, so realign both sequences before relying on nextval().
SELECT setval(
  pg_get_serial_sequence('public.item_categories', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.item_categories), 1)
);

SELECT setval(
  pg_get_serial_sequence('public.item_sub_categories', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.item_sub_categories), 1)
);

INSERT INTO public.item_categories (name, description)
VALUES (
  'Restaurant & Cooked Food',
  'Cooked meals prepared to order by restaurants and served during set hours'
)
ON CONFLICT (name) DO NOTHING;

-- Taxonomy ids are resolved through a lookup so the insert still succeeds in
-- environments where the Google/Facebook taxonomy tables have not been seeded.
INSERT INTO public.item_sub_categories (
  item_category_id,
  name,
  description,
  google_product_category,
  fb_product_category
)
SELECT
  category.id,
  candidate.name,
  candidate.description,
  (SELECT g.id FROM public.google_product_categories g WHERE g.id = candidate.google_product_category),
  (SELECT f.id FROM public.fb_product_categories f WHERE f.id = candidate.fb_product_category)
FROM public.item_categories category
CROSS JOIN (
  VALUES
    ('Local Dishes', 'Traditional and home-style cooked dishes', 499988::bigint, 7),
    ('Fast Food', 'Burgers, pizza, fried chicken and other quick cooked meals', 499988::bigint, 7),
    ('Grilled & BBQ', 'Grilled meat, fish, skewers and barbecue plates', 499988::bigint, 7),
    ('Breakfast', 'Cooked breakfast plates and morning meals', 499988::bigint, 7),
    ('Desserts & Pastries', 'Freshly made cakes, pastries and sweet plates', 2194::bigint, 11),
    ('Drinks & Juices', 'Freshly prepared juices, smoothies and hot drinks', 413::bigint, 27)
) AS candidate(name, description, google_product_category, fb_product_category)
WHERE category.name = 'Restaurant & Cooked Food'
  AND NOT EXISTS (
    SELECT 1
    FROM public.item_sub_categories existing
    WHERE existing.item_category_id = category.id
      AND existing.name = candidate.name
  );

-- Typical time to cook the dish. Intrinsic to the item, so it is the same at
-- every location that sells it.
ALTER TABLE public.items
ADD COLUMN preparation_minutes INTEGER;

ALTER TABLE public.items
ADD CONSTRAINT items_preparation_minutes_check CHECK (
  preparation_minutes IS NULL
  OR (preparation_minutes >= 0 AND preparation_minutes <= 1440)
);

-- One row per dish per location, shared by every variant inventory row of that dish.
CREATE TABLE public.food_item_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_location_id UUID NOT NULL REFERENCES public.business_locations(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  marked_unavailable_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT food_item_settings_location_item_key UNIQUE (business_location_id, item_id)
);

CREATE INDEX idx_food_item_settings_item ON public.food_item_settings(item_id);

CREATE INDEX idx_food_item_settings_location ON public.food_item_settings(business_location_id);

CREATE TRIGGER set_public_food_item_settings_updated_at
  BEFORE UPDATE ON public.food_item_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- A window with end_time < start_time runs past midnight into the next day, so
-- no start-before-end constraint is applied here.
CREATE TABLE public.food_availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_item_settings_id UUID NOT NULL REFERENCES public.food_item_settings(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT food_availability_slots_unique UNIQUE (food_item_settings_id, day_of_week, start_time, end_time),
  CONSTRAINT food_availability_slots_duration_check CHECK (end_time <> start_time)
);

CREATE INDEX idx_food_availability_slots_settings
ON public.food_availability_slots(food_item_settings_id);

CREATE INDEX idx_food_availability_slots_day
ON public.food_availability_slots(day_of_week);

CREATE TRIGGER set_public_food_availability_slots_updated_at
  BEFORE UPDATE ON public.food_availability_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();
