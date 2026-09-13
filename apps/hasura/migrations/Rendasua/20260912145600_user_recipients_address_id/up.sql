-- Default delivery address for a saved diaspora recipient (owned by same user)
ALTER TABLE public.user_recipients
  ADD COLUMN address_id UUID NULL
  REFERENCES public.addresses(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX user_recipients_address_id_idx
  ON public.user_recipients (address_id);

COMMENT ON COLUMN public.user_recipients.address_id IS
  'Optional default delivery address for this recipient; must be owned by the same user and match recipient.country';
