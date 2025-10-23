-- Migration: add_partner_user_type (rollback)
-- Description: Remove 'partner' user type

DELETE FROM "public"."user_types" WHERE "id" = 'partner';
