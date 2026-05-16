-- Platform-curated product collections (use-case groupings)

CREATE TABLE public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    slug TEXT NOT NULL,
    description_en TEXT,
    description_fr TEXT,
    image_url TEXT,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT collections_slug_unique UNIQUE (slug)
);

CREATE INDEX idx_collections_slug ON public.collections (slug);
CREATE INDEX idx_collections_featured_sort ON public.collections (is_featured, sort_order);

CREATE TRIGGER set_public_collections_updated_at
    BEFORE UPDATE ON public.collections
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

COMMENT ON TABLE public.collections IS 'Curated product collections for browse and filtering';

-- Many-to-many: items <-> collections (business assigns own items)

CREATE TABLE public.item_collections (
    item_id UUID NOT NULL,
    collection_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (item_id, collection_id),
    CONSTRAINT fk_item_collections_item FOREIGN KEY (item_id) REFERENCES public.items(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_item_collections_collection FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON UPDATE RESTRICT ON DELETE CASCADE
);

CREATE INDEX idx_item_collections_item_id ON public.item_collections (item_id);
CREATE INDEX idx_item_collections_collection_id ON public.item_collections (collection_id);

COMMENT ON TABLE public.item_collections IS 'Junction linking catalog items to platform collections';

-- Rule-based category -> collection suggestions

CREATE TABLE public.collection_category_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES public.collections(id) ON UPDATE CASCADE ON DELETE CASCADE,
    item_sub_category_id INTEGER REFERENCES public.item_sub_categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
    item_category_id INTEGER REFERENCES public.item_categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT collection_category_mappings_target_check CHECK (
        item_sub_category_id IS NOT NULL OR item_category_id IS NOT NULL
    )
);

CREATE INDEX idx_collection_category_mappings_collection ON public.collection_category_mappings (collection_id);
CREATE INDEX idx_collection_category_mappings_subcat ON public.collection_category_mappings (item_sub_category_id);
CREATE INDEX idx_collection_category_mappings_cat ON public.collection_category_mappings (item_category_id);

COMMENT ON TABLE public.collection_category_mappings IS 'Deterministic subcategory/category to collection suggestion rules';

-- Starter collections

INSERT INTO public.collections (slug, name_en, name_fr, description_en, description_fr, is_featured, sort_order) VALUES
(
    'home-essentials',
    'Home Essentials',
    'Essentiels maison',
    'Everyday household must-haves for a comfortable home.',
    'Les indispensables du quotidien pour un foyer confortable.',
    TRUE,
    10
),
(
    'office-essentials',
    'Office Essentials',
    'Essentiels bureau',
    'Desk, stationery, and workspace supplies.',
    'Fournitures de bureau et équipement de travail.',
    TRUE,
    20
),
(
    'baby-essentials',
    'Baby Essentials',
    'Essentiels bébé',
    'Care and comfort products for babies and young children.',
    'Produits de soin et de confort pour bébés et jeunes enfants.',
    TRUE,
    30
),
(
    'cleaning-essentials',
    'Cleaning Essentials',
    'Essentiels ménage',
    'Cleaning and hygiene products to keep your space fresh.',
    'Produits de nettoyage et d''hygiène pour un intérieur impeccable.',
    TRUE,
    40
),
(
    'breakfast-essentials',
    'Breakfast Essentials',
    'Essentiels petit-déjeuner',
    'Morning staples: groceries, drinks, and quick bites.',
    'Incontournables du matin : courses, boissons et encas.',
    TRUE,
    50
),
(
    'back-to-school-essentials',
    'Back to School Essentials',
    'Essentiels rentrée',
    'School and study supplies for students of all ages.',
    'Fournitures scolaires pour tous les âges.',
    TRUE,
    60
);

-- Category mappings (subcategory ids from 1751107250466_insert_item_sub_categories insert order)

INSERT INTO public.collection_category_mappings (collection_id, item_sub_category_id, priority)
SELECT c.id, m.sub_category_id, m.priority
FROM (
    VALUES
        ('home-essentials', 5, 100),
        ('home-essentials', 8, 90),
        ('home-essentials', 13, 80),
        ('office-essentials', 19, 100),
        ('office-essentials', 21, 90),
        ('baby-essentials', 13, 100),
        ('baby-essentials', 12, 90),
        ('cleaning-essentials', 13, 100),
        ('cleaning-essentials', 8, 90),
        ('breakfast-essentials', 1, 100),
        ('breakfast-essentials', 3, 90),
        ('breakfast-essentials', 5, 80),
        ('back-to-school-essentials', 19, 100),
        ('back-to-school-essentials', 9, 90),
        ('back-to-school-essentials', 7, 80)
) AS m(slug, sub_category_id, priority)
JOIN public.collections c ON c.slug = m.slug;

INSERT INTO public.collection_category_mappings (collection_id, item_category_id, priority)
SELECT c.id, m.item_category_id, m.priority
FROM (VALUES ('baby-essentials', 3, 50)) AS m(slug, item_category_id, priority)
JOIN public.collections c ON c.slug = m.slug;
