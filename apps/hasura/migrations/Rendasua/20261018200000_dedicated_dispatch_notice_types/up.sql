-- #594 PR 5: in-app notice types for the dedicated fallback at the scheduled dispatch gate
-- (auto-assignment to the agent, confirm-the-window reminder to the business). Entity type
-- 'order' already exists. Reference rows only: safe to re-run.
INSERT INTO public.message_types (id, comment) VALUES
  ('DEDICATED_ORDER_AUTO_ASSIGNED', 'An order was auto-assigned to its dedicated agent at dispatch'),
  ('DEDICATED_COVERAGE_CONFIRM_REMINDER', 'Business reminder to confirm the window of an order placed on dedicated coverage')
ON CONFLICT (id) DO NOTHING;
