-- Align deposit_amount column comment with code floor (150 XAF, not 151).
COMMENT ON COLUMN public.orders.deposit_amount IS
  'Reservation deposit amount for pay-at-delivery/pickup MoMo orders. XAF: max(150, round(total * rate)) capped at total. Other MM currencies: round(total * 0.10) capped at total.';
