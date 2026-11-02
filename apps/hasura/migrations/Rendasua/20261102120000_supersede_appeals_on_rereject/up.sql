-- A later rejection (AI force_reject correcting the category, or any write that
-- swaps current_rejection_id while the item stays rejected) must close the
-- pending appeal. Otherwise overturning that older appeal publishes the item
-- over the newer decision (including prohibited / counterfeit).

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
  ELSIF OLD.moderation_status = 'rejected'
        AND NEW.moderation_status = 'rejected'
        AND NEW.current_rejection_id IS DISTINCT FROM OLD.current_rejection_id THEN
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
  AFTER UPDATE OF moderation_status, status, current_rejection_id ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.items_withdraw_pending_appeals();

-- Close appeals already left pending against a rejection the item no longer points at.
UPDATE public.item_appeals a
   SET status = 'withdrawn', withdrawn_reason = 'superseded', updated_at = now()
  FROM public.items i
 WHERE a.item_id = i.id
   AND a.status = 'pending'
   AND i.current_rejection_id IS DISTINCT FROM a.rejection_id;
