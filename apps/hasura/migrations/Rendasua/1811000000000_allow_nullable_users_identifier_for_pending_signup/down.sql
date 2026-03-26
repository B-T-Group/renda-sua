DELETE FROM "public"."users"
WHERE "identifier" IS NULL;

ALTER TABLE "public"."users"
ALTER COLUMN "identifier" SET NOT NULL;
