-- Migration: create_partner_user (rollback)
-- Description: Remove Samuel Oru Besong partner user

DELETE FROM "public"."users" WHERE "email" = 'cto@aftermathtechnologies.com';
