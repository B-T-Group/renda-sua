"""
Domain-specific Hasura client helpers.

This package provides a small, shared wrapper around Hasura's GraphQL
API plus service modules that operate on specific domains such as
accounts, locations, and users.
"""

from .base import HasuraClient, HasuraClientConfig
from .logging import log_info, log_error

# Order-related functions
from .orders_service import (
    get_order_with_location,
    get_complete_order_details,
    get_order_details_for_notification,
    get_order_business_location_country,
)

# Order hold-related functions
from .order_holds_service import (
    get_or_create_order_hold,
    update_order_hold_status,
)

# Account-related functions
from .accounts_service import (
    get_account_by_user_and_currency,
    register_account_transaction,
    determine_transaction_balance_update,
)

# Transaction-related functions
from .transactions_service import (
    register_cancellation_fee_transactions,
)

# Configuration-related functions
from .config_service import (
    get_cancellation_fee_config,
)

# Location-related functions
from .location_service import (
    get_all_agent_locations,
)

__all__ = [
    # Base client
    "HasuraClient",
    "HasuraClientConfig",
    # Logging
    "log_info",
    "log_error",
    # Orders
    "get_order_with_location",
    "get_complete_order_details",
    "get_order_details_for_notification",
    "get_order_business_location_country",
    # Order holds
    "get_or_create_order_hold",
    "update_order_hold_status",
    # Accounts
    "get_account_by_user_and_currency",
    "register_account_transaction",
    "determine_transaction_balance_update",
    # Transactions
    "register_cancellation_fee_transactions",
    # Configuration
    "get_cancellation_fee_config",
    # Locations
    "get_all_agent_locations",
]


