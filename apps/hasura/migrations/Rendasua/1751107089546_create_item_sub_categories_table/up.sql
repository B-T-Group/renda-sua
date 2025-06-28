-- Create item_sub_categories table
CREATE TABLE public.item_sub_categories (
    id SERIAL PRIMARY KEY,
    item_category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_item_category FOREIGN KEY (item_category_id) REFERENCES public.item_categories(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);

-- Create or replace the updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at column
CREATE TRIGGER set_public_item_sub_categories_updated_at
    BEFORE UPDATE ON public.item_sub_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comment to the trigger
COMMENT ON TRIGGER set_public_item_sub_categories_updated_at ON public.item_sub_categories
    IS 'trigger to set value of column "updated_at" to current timestamp on row update';
