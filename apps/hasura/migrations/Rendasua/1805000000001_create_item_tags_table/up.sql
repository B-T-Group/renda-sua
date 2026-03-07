-- Create item_tags junction table (many-to-many: items <-> tags)
CREATE TABLE public.item_tags (
    item_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (item_id, tag_id),
    CONSTRAINT fk_item_tags_item FOREIGN KEY (item_id) REFERENCES public.items(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_item_tags_tag FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON UPDATE RESTRICT ON DELETE CASCADE
);

CREATE INDEX idx_item_tags_item_id ON public.item_tags(item_id);
CREATE INDEX idx_item_tags_tag_id ON public.item_tags(tag_id);

COMMENT ON TABLE public.item_tags IS 'Junction table linking items to tags for filtering and similar-items';
