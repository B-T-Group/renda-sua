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
