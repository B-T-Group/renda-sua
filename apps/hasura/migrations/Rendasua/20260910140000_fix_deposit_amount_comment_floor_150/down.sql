COMMENT ON COLUMN public.orders.deposit_amount IS
  'Reservation deposit amount for pay-at-delivery/pickup MoMo orders (XAF). Calculated at place-order as max(151, round(total * rate))';
