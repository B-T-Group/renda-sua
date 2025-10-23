-- Migration: create_rendasua_hq_user (rollback)
-- Description: Remove RendaSua HQ user

DELETE FROM "public"."users" WHERE "email" = 'hq@rendasua.com';
