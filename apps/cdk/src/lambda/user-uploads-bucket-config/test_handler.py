import unittest

from handler import (
    NO_CORS,
    NO_LIFECYCLE,
    _get_cors_rules,
    _get_lifecycle_rules,
    apply_config,
    handler,
    plan_rule_removal,
    remove_our_config,
    upsert_cors_rule,
    upsert_lifecycle_rule,
)

CORS_ID = "item-appeal-evidence-browser-uploads"
LIFE_ID = "abort-incomplete-item-appeal-evidence"

REQUIRED_CORS = {
    "ID": CORS_ID,
    "AllowedOrigins": ["https://www.rendasua.com", "https://dev.rendasua.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600,
}

REQUIRED_LIFE = {
    "ID": LIFE_ID,
    "Prefix": "item-appeal-evidence/",
    "AbortIncompleteMultipartUploadDays": 7,
}

DOCS_CORS = {
    "ID": "documents",
    "AllowedOrigins": ["https://www.rendasua.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"],
}

OTHER_LIFE = {
    "ID": "other",
    "Filter": {"Prefix": "tmp/"},
    "Status": "Enabled",
    "Expiration": {"Days": 30},
}

PROPS = {
    "BucketName": "rendasua-user-uploads",
    "CorsRule": REQUIRED_CORS,
    "LifecycleRule": REQUIRED_LIFE,
}


class MissingConfigError(Exception):
    def __init__(self, code: str):
        self.response = {"Error": {"Code": code}}


class FakeS3:
    def __init__(self, cors=None, lifecycle=None, cors_missing=False, life_missing=False):
        self.cors = None if cors_missing else list(cors or [])
        self.lifecycle = None if life_missing else list(lifecycle or [])
        self.puts_bpa = 0
        self.deleted_cors = 0
        self.deleted_lifecycle = 0
        self.cors_puts = []
        self.lifecycle_puts = []

    def get_bucket_cors(self, Bucket):
        if self.cors is None:
            raise MissingConfigError(NO_CORS)
        return {"CORSRules": list(self.cors)}

    def get_bucket_lifecycle_configuration(self, Bucket):
        if self.lifecycle is None:
            raise MissingConfigError(NO_LIFECYCLE)
        return {"Rules": list(self.lifecycle)}

    def put_bucket_cors(self, Bucket, CORSConfiguration):
        self.cors = list(CORSConfiguration["CORSRules"])
        self.cors_puts.append(self.cors)

    def put_bucket_lifecycle_configuration(self, Bucket, LifecycleConfiguration):
        self.lifecycle = list(LifecycleConfiguration["Rules"])
        self.lifecycle_puts.append(self.lifecycle)

    def delete_bucket_cors(self, Bucket):
        self.cors = None
        self.deleted_cors += 1

    def delete_bucket_lifecycle(self, Bucket):
        self.lifecycle = None
        self.deleted_lifecycle += 1

    def put_public_access_block(self, Bucket, PublicAccessBlockConfiguration):
        self.puts_bpa += 1
        self.bpa = PublicAccessBlockConfiguration


class MergeConfigTests(unittest.TestCase):
    def test_cors_preserves_existing_and_upserts_by_id(self):
        stale = {
            "ID": CORS_ID,
            "AllowedOrigins": ["https://old.example"],
            "AllowedMethods": ["GET"],
            "AllowedHeaders": ["Content-Type"],
        }
        merged = upsert_cors_rule([DOCS_CORS, stale], REQUIRED_CORS)
        self.assertEqual([r["ID"] for r in merged], ["documents", CORS_ID])
        self.assertEqual(merged[1]["AllowedMethods"], ["PUT", "GET", "HEAD"])
        self.assertEqual(merged[1]["AllowedHeaders"], ["Content-Type", "Content-Length"])

    def test_cors_empty_config_adds_only_ours(self):
        merged = upsert_cors_rule([], REQUIRED_CORS)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["ID"], CORS_ID)

    def test_cors_idempotent_rerun_does_not_duplicate(self):
        once = upsert_cors_rule([DOCS_CORS], REQUIRED_CORS)
        twice = upsert_cors_rule(once, REQUIRED_CORS)
        self.assertEqual(len(twice), 2)
        self.assertEqual([r["ID"] for r in twice], ["documents", CORS_ID])

    def test_lifecycle_preserves_existing_and_skips_expiration(self):
        merged = upsert_lifecycle_rule([OTHER_LIFE], REQUIRED_LIFE)
        self.assertEqual(merged[0]["Expiration"], {"Days": 30})
        self.assertNotIn("Expiration", merged[1])
        self.assertEqual(
            merged[1]["AbortIncompleteMultipartUpload"]["DaysAfterInitiation"], 7
        )

    def test_lifecycle_empty_config_adds_only_ours(self):
        merged = upsert_lifecycle_rule([], REQUIRED_LIFE)
        self.assertEqual([r["ID"] for r in merged], [LIFE_ID])

    def test_lifecycle_idempotent_rerun_does_not_duplicate(self):
        once = upsert_lifecycle_rule([OTHER_LIFE], REQUIRED_LIFE)
        twice = upsert_lifecycle_rule(once, REQUIRED_LIFE)
        self.assertEqual([r["ID"] for r in twice], ["other", LIFE_ID])

    def test_delete_removes_only_ours_when_others_remain(self):
        action, remaining = plan_rule_removal([DOCS_CORS, {"ID": CORS_ID}], CORS_ID)
        self.assertEqual(action, "put")
        self.assertEqual(remaining, [DOCS_CORS])

    def test_delete_drops_config_when_only_ours_remains(self):
        action, remaining = plan_rule_removal([{"ID": CORS_ID}], CORS_ID)
        self.assertEqual(action, "delete")
        self.assertEqual(remaining, [])

    def test_delete_noop_when_config_empty_or_missing(self):
        action, remaining = plan_rule_removal([], CORS_ID)
        self.assertEqual(action, "noop")
        self.assertEqual(remaining, [])

    def test_get_cors_treats_no_such_config_as_empty(self):
        client = FakeS3(cors_missing=True)
        self.assertEqual(_get_cors_rules(client, "rendasua-user-uploads"), [])

    def test_get_lifecycle_treats_no_such_config_as_empty(self):
        client = FakeS3(life_missing=True)
        self.assertEqual(_get_lifecycle_rules(client, "rendasua-user-uploads"), [])


class ApplyAndRemoveTests(unittest.TestCase):
    def test_apply_merges_live_rules_and_sets_bpa(self):
        client = FakeS3(cors=[DOCS_CORS], lifecycle=[OTHER_LIFE])
        apply_config(PROPS, client=client)
        self.assertEqual(client.puts_bpa, 1)
        self.assertTrue(all(client.bpa.values()))
        self.assertEqual([r["ID"] for r in client.cors], ["documents", CORS_ID])
        self.assertEqual([r["ID"] for r in client.lifecycle], ["other", LIFE_ID])

    def test_apply_from_empty_missing_config(self):
        client = FakeS3(cors_missing=True, life_missing=True)
        apply_config(PROPS, client=client)
        self.assertEqual([r["ID"] for r in client.cors], [CORS_ID])
        self.assertEqual([r["ID"] for r in client.lifecycle], [LIFE_ID])

    def test_apply_twice_is_idempotent(self):
        client = FakeS3(cors=[DOCS_CORS], lifecycle=[OTHER_LIFE])
        apply_config(PROPS, client=client)
        apply_config(PROPS, client=client)
        self.assertEqual([r["ID"] for r in client.cors], ["documents", CORS_ID])
        self.assertEqual([r["ID"] for r in client.lifecycle], ["other", LIFE_ID])

    def test_delete_removes_only_our_rules_and_leaves_bpa(self):
        client = FakeS3(
            cors=[DOCS_CORS, {"ID": CORS_ID}],
            lifecycle=[OTHER_LIFE, {"ID": LIFE_ID}],
        )
        client.puts_bpa = 0
        remove_our_config(PROPS, client=client)
        self.assertEqual(client.puts_bpa, 0)
        self.assertEqual(client.cors, [DOCS_CORS])
        self.assertEqual(client.lifecycle, [OTHER_LIFE])
        self.assertEqual(client.deleted_cors, 0)
        self.assertEqual(client.deleted_lifecycle, 0)

    def test_delete_clears_config_when_only_ours(self):
        client = FakeS3(cors=[{"ID": CORS_ID}], lifecycle=[{"ID": LIFE_ID}])
        remove_our_config(PROPS, client=client)
        self.assertIsNone(client.cors)
        self.assertIsNone(client.lifecycle)
        self.assertEqual(client.deleted_cors, 1)
        self.assertEqual(client.deleted_lifecycle, 1)

    def test_delete_noop_when_no_live_config(self):
        client = FakeS3(cors_missing=True, life_missing=True)
        remove_our_config(PROPS, client=client)
        self.assertIsNone(client.cors)
        self.assertIsNone(client.lifecycle)
        self.assertEqual(client.deleted_cors, 0)
        self.assertEqual(client.deleted_lifecycle, 0)

    def test_handler_delete_does_not_call_put_public_access_block(self):
        client = FakeS3(cors=[DOCS_CORS, {"ID": CORS_ID}], lifecycle=[OTHER_LIFE])
        event = {
            "RequestType": "Delete",
            "PhysicalResourceId": "user-uploads-bucket-config",
            "ResourceProperties": PROPS,
        }
        result = handler(event, None, client=client)
        self.assertEqual(result["PhysicalResourceId"], "user-uploads-bucket-config")
        self.assertEqual(client.puts_bpa, 0)
        self.assertEqual(client.cors, [DOCS_CORS])
        self.assertEqual(client.lifecycle, [OTHER_LIFE])


if __name__ == "__main__":
    unittest.main()
