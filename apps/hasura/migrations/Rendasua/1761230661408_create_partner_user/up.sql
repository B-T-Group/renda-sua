-- Migration: create_partner_user
-- Description: Create Samuel Oru Besong as partner user

INSERT INTO "public"."users"(
    "user_type_id", 
    "identifier", 
    "first_name", 
    "last_name", 
    "email", 
    "phone_number"
) VALUES (
    'partner',
    'cto@aftermathtechnologies.com',
    'Samuel Oru',
    'Besong',
    'cto@aftermathtechnologies.com',
    '+15147067120'
);
