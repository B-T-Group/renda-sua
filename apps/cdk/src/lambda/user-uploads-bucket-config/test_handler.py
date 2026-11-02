import unittest

from handler import upsert_cors_rule, upsert_lifecycle_rule


class MergeConfigTests(unittest.TestCase):
    def test_cors_keeps_existing_rules_and_upserts_by_id(self):
        existing = [
            {
                "ID": "documents",
                "AllowedOrigins": ["https://www.rendasua.com"],
                "AllowedMethods": ["PUT"],
                "AllowedHeaders": ["*"],
            },
            {
                "ID": "item-appeal-evidence-browser-uploads",
                "AllowedOrigins": ["https://old.example"],
                "AllowedMethods": ["GET"],
                "AllowedHeaders": ["Content-Type"],
            },
        ]
        required = {
            "ID": "item-appeal-evidence-browser-uploads",
            "AllowedOrigins": ["https://www.rendasua.com", "https://dev.rendasua.com"],
            "AllowedMethods": ["PUT", "GET", "HEAD"],
            "AllowedHeaders": ["Content-Type", "Content-Length"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3600,
        }
        merged = upsert_cors_rule(existing, required)
        self.assertEqual(len(merged), 2)
        self.assertEqual(merged[0]["ID"], "documents")
        self.assertEqual(merged[1]["AllowedMethods"], ["PUT", "GET", "HEAD"])
        self.assertEqual(merged[1]["AllowedHeaders"], ["Content-Type", "Content-Length"])
        self.assertEqual(merged[1]["ExposeHeaders"], ["ETag"])

    def test_lifecycle_keeps_other_rules_and_does_not_expire(self):
        existing = [
            {
                "ID": "other",
                "Filter": {"Prefix": "tmp/"},
                "Status": "Enabled",
                "Expiration": {"Days": 30},
            }
        ]
        required = {
            "ID": "abort-incomplete-item-appeal-evidence",
            "Prefix": "item-appeal-evidence/",
            "AbortIncompleteMultipartUploadDays": 7,
        }
        merged = upsert_lifecycle_rule(existing, required)
        self.assertEqual(merged[0]["Expiration"], {"Days": 30})
        added = merged[1]
        self.assertEqual(added["Filter"]["Prefix"], "item-appeal-evidence/")
        self.assertNotIn("Expiration", added)
        self.assertEqual(
            added["AbortIncompleteMultipartUpload"]["DaysAfterInitiation"], 7
        )


if __name__ == "__main__":
    unittest.main()
