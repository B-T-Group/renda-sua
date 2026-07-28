INSERT INTO public.message_types (id, comment)
VALUES
  ('AI_ITEM_PROPOSAL', 'AI-proposed improvements for a sale item'),
  ('AI_RENTAL_PROPOSAL', 'AI-proposed improvements for a rental listing'),
  ('ITEM_REJECTED', 'Sale item rejected by moderation'),
  ('RENTAL_REJECTED', 'Rental listing rejected by moderation')
ON CONFLICT (id) DO NOTHING;
