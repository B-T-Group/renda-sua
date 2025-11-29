"""
Account-related Hasura operations.

This module is a thin wrapper around the generic Hasura client and is
designed to mirror a subset of the functionality currently implemented
in the order-status Lambda's hasura_client module.
"""

from typing import Any, Dict, Optional

from .base import HasuraClient


def get_account_by_user_and_currency(
    client: HasuraClient,
    user_id: str,
    currency: str,
) -> Optional[Dict[str, Any]]:
    query = """
    query GetUserAccount($userId: uuid!, $currency: currency_enum!) {
      accounts(
        where: {
          user_id: { _eq: $userId }
          currency: { _eq: $currency }
          is_active: { _eq: true }
        }
      ) {
        id
        user_id
        currency
        available_balance
        withheld_balance
        total_balance
        is_active
      }
    }
    """
    data = client.execute(
        query,
        {"userId": user_id, "currency": currency},
    )
    accounts = data.get("accounts") or []
    return accounts[0] if accounts else None


