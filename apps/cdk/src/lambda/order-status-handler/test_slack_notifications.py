import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

import slack_notifications


class SlackNotificationPayloadTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(
            os.environ,
            {
                "ENVIRONMENT": "production",
                "PUBLIC_WEB_APP_URL": "https://app.rendasua.com/",
            },
            clear=False,
        )
        self.env.start()

    def tearDown(self):
        self.env.stop()

    def _order_data(self):
        return {
            "orderId": "order-123",
            "orderNumber": "ORD-001",
            "orderStatus": "cancelled",
            "clientName": "Ada <Lovelace>",
            "businessName": "Market & Co",
            "businessLocationName": "Main > West",
            "deliveryAddress": "1 <High> Street",
            "deliveryFee": 2.5,
            "fastDeliveryFee": 1.25,
            "paymentMethod": "mobile_money",
            "paymentStatus": "refunded",
            "totalAmount": 19.75,
            "currency": "XAF",
            "orderItems": [
                {"name": "Rice & Beans", "quantity": 2},
                {"name": "Oil <1L>", "quantity": 1},
            ],
        }

    def _flatten_block_text(self, payload):
        parts = []
        for block in payload["blocks"]:
            if "text" in block:
                parts.append(block["text"]["text"])
            for field in block.get("fields", []):
                parts.append(field["text"])
            for element in block.get("elements", []):
                parts.append(element["text"])
        return "\n".join(parts)

    def test_cancelled_payload_includes_context_totals_and_escaped_details(self):
        payload = slack_notifications.build_order_slack_payload(
            "order.cancelled",
            self._order_data(),
            {"completedTotal": 42, "cancelledTotal": 7},
            "Customer changed <mind>",
            "client & support",
        )

        text = self._flatten_block_text(payload)

        self.assertIn("*Environment:* `production`", text)
        self.assertIn("<https://app.rendasua.com/orders/order-123|Open in dashboard>", text)
        self.assertIn("Ada &lt;Lovelace&gt;", text)
        self.assertIn("Market &amp; Co — Main &gt; West", text)
        self.assertIn("Customer changed &lt;mind&gt;", text)
        self.assertIn("client &amp; support", text)
        self.assertIn("*All-time completed orders:*\n42", text)
        self.assertIn("*All-time cancelled orders:*\n7", text)
        self.assertIn("Rice &amp; Beans x2", text)
        self.assertIn("Oil &lt;1L&gt; x1", text)

    def test_completed_payload_includes_lifecycle_totals_without_cancellation_fields(self):
        order_data = {**self._order_data(), "orderStatus": "complete"}

        payload = slack_notifications.build_order_slack_payload(
            "order.completed",
            order_data,
            {"completedTotal": 100, "cancelledTotal": 3},
            "should not render",
            "client",
        )

        text = self._flatten_block_text(payload)

        self.assertIn("*✅ Order Completed!*", text)
        self.assertIn("*All-time completed orders:*\n100", text)
        self.assertIn("*All-time cancelled orders:*\n3", text)
        self.assertNotIn("Cancelled by", text)
        self.assertNotIn("should not render", text)


class SlackNotificationPostingTests(unittest.TestCase):
    @patch("slack_notifications._sleep_before_retry")
    @patch("slack_notifications._post_once")
    def test_post_retries_transient_slack_failures(self, post_once, sleep_before_retry):
        post_once.side_effect = [(500, "server error"), (429, "rate limited"), (200, "ok")]

        sent = slack_notifications.post_slack_order_alert({"blocks": []}, " https://hooks ")

        self.assertTrue(sent)
        self.assertEqual(post_once.call_count, 3)
        post_once.assert_called_with("https://hooks", {"blocks": []})
        self.assertEqual(sleep_before_retry.call_count, 2)

    @patch("slack_notifications._sleep_before_retry")
    @patch("slack_notifications._post_once")
    def test_post_does_not_retry_permanent_slack_failures(
        self, post_once, sleep_before_retry
    ):
        post_once.return_value = (400, "invalid_payload")

        sent = slack_notifications.post_slack_order_alert({"blocks": []}, "https://hooks")

        self.assertFalse(sent)
        self.assertEqual(post_once.call_count, 1)
        sleep_before_retry.assert_not_called()

    @patch("slack_notifications._sleep_before_retry")
    @patch("slack_notifications._post_once")
    def test_post_retries_request_exceptions_until_success(
        self, post_once, sleep_before_retry
    ):
        post_once.side_effect = [
            requests.Timeout("timed out"),
            requests.ConnectionError("reset"),
            (200, ""),
        ]

        sent = slack_notifications.post_slack_order_alert({"blocks": []}, "https://hooks")

        self.assertTrue(sent)
        self.assertEqual(post_once.call_count, 3)
        self.assertEqual(sleep_before_retry.call_count, 2)


class SlackNotificationSendTests(unittest.TestCase):
    def test_send_skips_development_unless_enabled(self):
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}, clear=True):
            with patch("slack_notifications.post_slack_order_alert") as post_alert:
                sent = slack_notifications.send_slack_for_order_event(
                    "order.created",
                    {"orderId": "order-123"},
                )

        self.assertFalse(sent)
        post_alert.assert_not_called()

    def test_send_posts_when_development_flag_enabled(self):
        with patch.dict(
            os.environ,
            {
                "ENVIRONMENT": "development",
                "SLACK_ORDER_ALERTS_IN_DEVELOPMENT": "true",
                "SLACK_ORDER_WEBHOOK_URL": "https://hooks",
            },
            clear=True,
        ):
            with patch("slack_notifications.post_slack_order_alert", return_value=True) as post_alert:
                sent = slack_notifications.send_slack_for_order_event(
                    "order.created",
                    {"orderId": "order-123", "orderNumber": "ORD-001"},
                )

        self.assertTrue(sent)
        post_alert.assert_called_once()


if __name__ == "__main__":
    unittest.main()
