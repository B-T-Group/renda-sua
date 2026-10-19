"""N1: the MyPVit key-refresh Lambdas must never log or return the renew-secret response.

renew-secret returns {"operation_account_code", "secret": "sk_live_...", "expires_in": 3600},
so response.text is the live key. These tests run the real handlers with requests.post and
Secrets Manager faked, capture stdout, and check the key appears nowhere.
"""
import contextlib
import importlib.util
import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import requests

LAMBDA_DIR = Path(__file__).resolve().parents[1] / "src/lambda"
sys.modules.setdefault("boto3", MagicMock())
sys.modules.setdefault("botocore", MagicMock())
sys.modules.setdefault("botocore.exceptions", MagicMock(ClientError=type("ClientError", (Exception,), {})))

# Built at runtime so no live-looking literal sits in the repo.
LIVE_KEY = "_".join(["sk", "live", "0b9d2f3e-4c1a-4e6b-9f7a-1234567890ab"])
REFRESH_PASSWORD = "refresh-password-value-123"
PATH_CODE = "CTCNJRBWZIDALEGT"


def _load(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), LAMBDA_DIR / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


HANDLERS = [_load("refresh-airtel-mobile-payments-key"), _load("refresh-moov-mobile-payments-key")]


def _response(status=200, body=None):
    body = body if body is not None else {
        "operation_account_code": "ACC_TEST",
        "secret": LIVE_KEY,
        "expires_in": 3600,
    }
    resp = requests.models.Response()
    resp.status_code = status
    resp._content = json.dumps(body).encode()
    resp.url = f"https://api.mypvit.pro/{PATH_CODE}/renew-secret"
    return resp


class RefreshLambdaLoggingTest(unittest.TestCase):
    def _run(self, module, post):
        sm = MagicMock()
        sm.get_secret_value.return_value = {
            "SecretString": json.dumps({"MYPVIT_SECRET_KEY_REFRESH_PASSWORD": REFRESH_PASSWORD})
        }
        out = io.StringIO()
        with patch.object(module.boto3, "client", return_value=sm), patch.object(
            module.requests, "post", post
        ), patch.dict("os.environ", {"ENVIRONMENT": "production"}), contextlib.redirect_stdout(out):
            result = module.handler({}, None)
        return result, out.getvalue()

    def assert_no_secret(self, text):
        self.assertNotIn(LIVE_KEY, text)
        self.assertNotIn("sk_live", text)
        self.assertNotIn(REFRESH_PASSWORD, text)
        self.assertNotIn(PATH_CODE, text)

    def test_success_logs_status_only_and_returns_no_response_data(self):
        for module in HANDLERS:
            with self.subTest(module=module.__name__):
                result, logs = self._run(module, MagicMock(return_value=_response()))
                self.assertEqual(result["statusCode"], 200)
                body = json.loads(result["body"])
                self.assertNotIn("responseData", body)
                self.assertEqual(body["responseStatus"], 200)
                self.assertEqual(body["expiresIn"], 3600)
                self.assertIn("Response Status: 200", logs)
                self.assert_no_secret(logs + result["body"])

    def test_non_json_or_unexpected_body_is_not_logged(self):
        for module in HANDLERS:
            with self.subTest(module=module.__name__):
                resp = _response()
                resp._content = f"plain text {LIVE_KEY}".encode()
                result, logs = self._run(module, MagicMock(return_value=resp))
                self.assertIsNone(json.loads(result["body"])["expiresIn"])
                self.assert_no_secret(logs + result["body"])

    def test_http_error_with_secret_body_logs_type_and_status_only(self):
        for module in HANDLERS:
            with self.subTest(module=module.__name__):
                resp = _response(status=500)
                err = requests.exceptions.HTTPError(
                    f"500 Server Error for url: {resp.url} body {LIVE_KEY}", response=resp
                )
                result, logs = self._run(module, MagicMock(side_effect=err))
                self.assertEqual(result["statusCode"], 500)
                self.assertIn("HTTPError (HTTP 500)", logs)
                self.assertEqual(json.loads(result["body"])["error"], "HTTPError (HTTP 500)")
                self.assert_no_secret(logs + result["body"])

    def test_connection_error_logs_type_only(self):
        for module in HANDLERS:
            with self.subTest(module=module.__name__):
                err = requests.exceptions.ConnectionError(f"Max retries exceeded with url: /{PATH_CODE}/renew-secret")
                result, logs = self._run(module, MagicMock(side_effect=err))
                self.assertIn("ConnectionError", logs)
                self.assert_no_secret(logs + result["body"])


if __name__ == "__main__":
    unittest.main()
