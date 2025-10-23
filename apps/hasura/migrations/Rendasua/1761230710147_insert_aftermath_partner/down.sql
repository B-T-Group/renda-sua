-- Migration: insert_aftermath_partner (rollback)
-- Description: Remove Aftermath Technologies partner record

DELETE FROM public.partners WHERE company_name = 'Aftermath Technologies';
