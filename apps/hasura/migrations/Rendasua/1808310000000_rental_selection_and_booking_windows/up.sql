-- Multi-window rental requests and accurate overlap via booking time segments

ALTER TABLE public.rental_requests
ADD COLUMN rental_selection_windows JSONB;

COMMENT ON COLUMN public.rental_requests.rental_selection_windows IS
  'Optional array of {start_at,end_at} ISO instants; when set, pricing/capacity use all windows; requested_start/end remain min/max for display';

UPDATE public.rental_requests
SET rental_selection_windows = jsonb_build_array(
  jsonb_build_object(
    'start_at', to_jsonb(requested_start_at),
    'end_at', to_jsonb(requested_end_at)
  )
);

CREATE TABLE public.rental_booking_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_booking_id UUID NOT NULL REFERENCES public.rental_bookings(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_booking_windows_time_order CHECK (end_at > start_at)
);

CREATE INDEX idx_rental_booking_windows_booking ON public.rental_booking_windows(rental_booking_id);
CREATE INDEX idx_rental_booking_windows_range ON public.rental_booking_windows(start_at, end_at);

INSERT INTO public.rental_booking_windows (rental_booking_id, start_at, end_at)
SELECT id, start_at, end_at
FROM public.rental_bookings;
