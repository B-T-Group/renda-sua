-- Allow targeting a specific user for admin broadcasts
ALTER TYPE public.admin_broadcast_audience_type ADD VALUE IF NOT EXISTS 'user';
