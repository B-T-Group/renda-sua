"""
Notification helpers shared across Lambdas.

Initially focuses on email notifications via SendGrid, starting with
order cancellation flows, and can be expanded over time.
"""

from .email import send_cancellation_notifications

__all__ = ["send_cancellation_notifications"]


