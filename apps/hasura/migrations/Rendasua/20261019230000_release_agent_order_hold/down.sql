-- #622 L1 ROLLBACK: revert the backend (OrderReassignmentService releaseNetAgentHold)
-- first, then the Hasura metadata (functions/public_release_agent_order_hold.yaml and its
-- functions.yaml entry), then run this down migration. Never one without the others.
DROP FUNCTION IF EXISTS public.release_agent_order_hold(uuid, uuid, numeric, text);
