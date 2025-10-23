-- Migration: create_rendasua_hq_user
-- Description: Create RendaSua HQ as business user

INSERT INTO "public"."users"(
    "user_type_id", 
    "identifier", 
    "first_name", 
    "last_name", 
    "email", 
    "phone_number"
) VALUES (
    'business',
    'hq@rendasua.com',
    'Rendasua',
    'HQ',
    'hq@rendasua.com',
    '+15147067120'
);
