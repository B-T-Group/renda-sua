"""
Account-related Hasura operations.

This module is a thin wrapper around the generic Hasura client and is
designed to mirror a subset of the functionality currently implemented
in the order-status Lambda's hasura_client module.
"""

from typing import Optional
import datetime
from rendasua_core_packages.models import Account, TransactionInfo, BalanceUpdate
from rendasua_core_packages.utilities import parse_datetime
from .base import HasuraClient, HasuraClientConfig
from .logging import log_info, log_error


def get_account_by_user_and_currency(
    user_id: str,
    currency: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[Account]:
    """
    Get account by user ID and currency, creating it if it doesn't exist.
    
    Args:
        user_id: User ID
        currency: Currency code
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        Account object, None if error
    """
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
        created_at
        updated_at
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Fetching account", user_id=user_id, currency=currency)
    
    try:
        data = client.execute(query, {"userId": user_id, "currency": currency})
        accounts_data = data.get("accounts", [])
        
        if accounts_data:
            account_data = accounts_data[0]
            account = Account(
                id=account_data["id"],
                user_id=account_data["user_id"],
                currency=account_data["currency"],
                available_balance=float(account_data["available_balance"]),
                withheld_balance=float(account_data["withheld_balance"]),
                total_balance=float(account_data.get("total_balance", 0.0)),
                is_active=account_data.get("is_active", True),
                created_at=parse_datetime(account_data.get("created_at")),
                updated_at=parse_datetime(account_data.get("updated_at")),
            )
            log_info("Account found", user_id=user_id, account_id=account.id)
            return account
        
        # Create account if it doesn't exist
        log_info("Account not found, creating new one", user_id=user_id, currency=currency)
        
        mutation = """
        mutation CreateAccount($userId: uuid!, $currency: currency_enum!) {
          insert_accounts_one(object: {
            user_id: $userId,
            currency: $currency,
            available_balance: 0,
            withheld_balance: 0,
            is_active: true
          }) {
            id
            user_id
            currency
            available_balance
            withheld_balance
            total_balance
            is_active
            created_at
            updated_at
          }
        }
        """
        
        create_data = client.execute(mutation, {"userId": user_id, "currency": currency})
        account_data = create_data.get("insert_accounts_one")
        
        if not account_data:
            log_error("Failed to create account", user_id=user_id)
            return None
        
        account = Account(
            id=account_data["id"],
            user_id=account_data["user_id"],
            currency=account_data["currency"],
            available_balance=float(account_data["available_balance"]),
            withheld_balance=float(account_data["withheld_balance"]),
            total_balance=float(account_data.get("total_balance", 0.0)),
            is_active=account_data.get("is_active", True),
            created_at=parse_datetime(account_data.get("created_at")),
            updated_at=parse_datetime(account_data.get("updated_at")),
        )
        log_info("Account created successfully", user_id=user_id, account_id=account.id)
        return account
        
    except Exception as e:
        log_error("Error with account", error=e, user_id=user_id)
        return None


def determine_transaction_balance_update(
    transaction_type: str,
    amount: float
) -> TransactionInfo:
    """
    Determine balance updates for a transaction type.
    Matches the logic from AccountsService.determineTransactionType in the backend.
    
    Args:
        transaction_type: Type of transaction (release, payment, fee, etc.)
        amount: Transaction amount (always positive)
        
    Returns:
        TransactionInfo object with isCredit and balanceUpdate
    """
    if transaction_type == "deposit":
        # Deposit: increases available balance (money added to account)
        return TransactionInfo(
            isCredit=True,
            balanceUpdate=BalanceUpdate(available=amount, withheld=0),
        )
    elif transaction_type == "hold":
        # Hold: decreases available balance, increases withheld balance
        return TransactionInfo(
            isCredit=False,
            balanceUpdate=BalanceUpdate(available=-amount, withheld=amount),
        )
    elif transaction_type == "release":
        # Release: increases available balance, decreases withheld balance
        return TransactionInfo(
            isCredit=True,
            balanceUpdate=BalanceUpdate(available=amount, withheld=-amount),
        )
    elif transaction_type == "payment":
        # Payment: decreases available balance
        return TransactionInfo(
            isCredit=False,
            balanceUpdate=BalanceUpdate(available=-amount, withheld=0),
        )
    elif transaction_type == "fee":
        # Fee: decreases available balance (money removed from account)
        return TransactionInfo(
            isCredit=False,
            balanceUpdate=BalanceUpdate(available=-amount, withheld=0),
        )
    else:
        raise ValueError(f"Unsupported transaction type: {transaction_type}")


def register_account_transaction(
    account_id: str,
    amount: float,
    transaction_type: str,
    memo: str,
    reference_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[str]:
    """
    Register an account transaction and update account balances.
    
    Args:
        account_id: Account ID
        amount: Transaction amount
        transaction_type: Type of transaction (release, payment, etc.)
        memo: Transaction memo
        reference_id: Reference ID (e.g., order ID)
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        Transaction ID if successful, None otherwise
    """
    # First, get current account
    query = """
    query GetAccountById($accountId: uuid!) {
      accounts_by_pk(id: $accountId) {
        id
        available_balance
        withheld_balance
        total_balance
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Fetching account for transaction", account_id=account_id, transaction_type=transaction_type)
    
    try:
        data = client.execute(query, {"accountId": account_id})
        account_data = data.get("accounts_by_pk")
        
        if not account_data:
            log_error("Account not found", account_id=account_id)
            return None
        
        account = Account(
            id=account_data["id"],
            user_id="",  # Not needed for this operation
            currency="",  # Not needed for this operation
            available_balance=float(account_data.get("available_balance", 0.0)),
            withheld_balance=float(account_data.get("withheld_balance", 0.0)),
            total_balance=float(account_data.get("total_balance", 0.0)),
            is_active=True,  # Not needed for this operation
            created_at=datetime.datetime.now(),
            updated_at=datetime.datetime.now(),
        )
        
        # Determine balance update
        transaction_info = determine_transaction_balance_update(transaction_type, amount)
        balance_update = transaction_info.balanceUpdate
        
        # Calculate new balances (handle None values by defaulting to 0)
        current_available = account.available_balance or 0
        current_withheld = account.withheld_balance or 0
        new_available = current_available + balance_update.available
        new_withheld = current_withheld + balance_update.withheld
        new_total = new_available + new_withheld
        
        # Validate sufficient funds before processing transaction
        # For hold transactions, check available balance
        if transaction_type == "hold":
            if current_available < abs(balance_update.available):
                log_error(
                    "Insufficient available balance for hold transaction",
                    account_id=account_id,
                    available_balance=current_available,
                    required_amount=abs(balance_update.available),
                )
                return None
        
        # For release transactions, check withheld balance
        elif transaction_type == "release":
            if current_withheld < abs(balance_update.withheld):
                log_error(
                    "Insufficient withheld balance for release transaction",
                    account_id=account_id,
                    withheld_balance=current_withheld,
                    required_amount=abs(balance_update.withheld),
                )
                return None
        
        # For other debit transactions that decrease available balance, check available balance
        elif balance_update.available < 0:
            if current_available < abs(balance_update.available):
                log_error(
                    "Insufficient available balance for transaction",
                    account_id=account_id,
                    available_balance=current_available,
                    required_amount=abs(balance_update.available),
                )
                return None
        
        # For other transactions that decrease withheld balance, check withheld balance
        elif balance_update.withheld < 0:
            if current_withheld < abs(balance_update.withheld):
                log_error(
                    "Insufficient withheld balance for transaction",
                    account_id=account_id,
                    withheld_balance=current_withheld,
                    required_amount=abs(balance_update.withheld),
                )
                return None
        
        # Insert transaction
        mutation = """
        mutation InsertTransaction(
          $accountId: uuid!,
          $amount: numeric!,
          $transactionType: transaction_type_enum!,
          $memo: String,
          $referenceId: uuid
        ) {
          insert_account_transactions_one(object: {
            account_id: $accountId,
            amount: $amount,
            transaction_type: $transactionType,
            memo: $memo,
            reference_id: $referenceId
          }) {
            id
          }
        }
        """
        
        transaction_data = client.execute(
            mutation,
            {
                "accountId": account_id,
                "amount": amount,
                "transactionType": transaction_type.lower(),
                "memo": memo,
                "referenceId": reference_id,
            },
        )
        
        transaction_id = transaction_data.get("insert_account_transactions_one", {}).get("id")
        
        if not transaction_id:
            log_error("Failed to insert transaction", account_id=account_id)
            return None
        
        # Update account balances
        update_mutation = """
        mutation UpdateAccountBalances(
          $accountId: uuid!,
          $availableBalance: numeric!,
          $withheldBalance: numeric!
        ) {
          update_accounts_by_pk(
            pk_columns: { id: $accountId },
            _set: {
              available_balance: $availableBalance,
              withheld_balance: $withheldBalance,
              updated_at: "now()"
            }
          ) {
            id
          }
        }
        """
        
        client.execute(
            update_mutation,
            {
                "accountId": account_id,
                "availableBalance": new_available,
                "withheldBalance": new_withheld,
            },
        )
        
        log_info("Transaction registered successfully", account_id=account_id, transaction_id=transaction_id, transaction_type=transaction_type)
        return transaction_id
        
    except Exception as e:
        log_error("Error registering transaction", error=e, account_id=account_id)
        return None


