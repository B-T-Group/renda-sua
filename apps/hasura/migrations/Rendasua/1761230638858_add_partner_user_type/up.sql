-- Migration: add_partner_user_type
-- Description: Add 'partner' user type to support partner users

INSERT INTO "public"."user_types"("id", "comment") VALUES ('partner', 'Partner');
