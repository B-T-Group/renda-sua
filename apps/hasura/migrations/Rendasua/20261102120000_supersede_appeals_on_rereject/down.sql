CREATE OR REPLACE FUNCTION public.items_withdraw_pending_appeals()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  why text;
BEGIN
  IF NEW.status = 'deleted' AND OLD.status IS DISTINCT FROM 'deleted' THEN
    why := 'item_deleted';
  ELSIF OLD.moderation_status = 'rejected'
        AND NEW.moderation_status IN ('pending', 'ai_reviewing') THEN
    why := 'resubmitted';
  ELSIF OLD.moderation_status = 'rejected' AND NEW.moderation_status = 'approved' THEN
    why := 'superseded';
  ELSE
    RETURN NEW;
  END IF;
  UPDATE public.item_appeals
     SET status = 'withdrawn', withdrawn_reason = why, updated_at = now()
   WHERE item_id = NEW.id AND status = 'pending';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS items_withdraw_pending_appeals ON public.items;
CREATE TRIGGER items_withdraw_pending_appeals
  AFTER UPDATE OF moderation_status, status ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.items_withdraw_pending_appeals();
