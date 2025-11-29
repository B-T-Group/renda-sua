"""
Core shared Python packages for Lambda functions.

This package is deployed as part of the core-packages Lambda layer and is
intended to remain lightweight while centralising shared logic such as:

- Pydantic models generated from Hasura
- Commission calculation helpers
- Notification helpers (e.g. SendGrid wrappers)
- Secrets Manager helpers
- Hasura client wrappers by domain (accounts, locations, users, etc.)
"""


