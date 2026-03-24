-- Non-null item_id must reference an existing item; do not null out FK on item delete (library uses item_id IS NULL).
ALTER TABLE public.item_images
    DROP CONSTRAINT IF EXISTS fk_item_images_item;

ALTER TABLE public.item_images
    ADD CONSTRAINT fk_item_images_item
    FOREIGN KEY (item_id)
    REFERENCES public.items(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT;
