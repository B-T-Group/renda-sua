-- QA F2 ROLLBACK: revert the backend (FailedDeliveriesService.forfeitAgentHold) first,
-- then the Hasura metadata (functions/public_forfeit_agent_order_hold.yaml and its
-- functions.yaml entry), then run this.
--
-- Only forfeit_agent_order_hold is dropped. release_agent_order_hold is deliberately
-- LEFT forfeit-aware (net = holds - releases - forfeits), NOT restored to the
-- 20261019230000 version: forfeit rows written before the rollback stay in the ledger,
-- and the old net (holds - releases) would see a forfeited hold as still held and pay it
-- out again to the agent from withheld (QA #632: a double pay after rollback). With no
-- forfeit rows the forfeit-aware function behaves exactly like the old one, so keeping
-- it is safe. The 'forfeit' enum value also stays (Postgres cannot drop one).
SET LOCAL lock_timeout = '5s';
DROP FUNCTION IF EXISTS public.forfeit_agent_order_hold(uuid, uuid, uuid, numeric, text, text);
