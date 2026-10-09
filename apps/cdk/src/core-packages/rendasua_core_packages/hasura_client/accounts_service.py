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
    hasura_admin_secret: str,
    business_location_id: Optional[str] = None,
) -> Optional[Account]:
    """
    Get account by user ID and currency, optionally scoped to a business_location_id.
    Creates the account if it doesn't exist.
    When business_location_id is set, returns the location-scoped account; otherwise the legacy account.

    Args:
        user_id: User ID
        currency: Currency code
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        business_location_id: Optional business location ID for location-scoped accounts

    Returns:
        Account object, None if error
    """
    if business_location_id:
        return _get_or_create_account(
            user_id=user_id,
            currency=currency,
            hasura_endpoint=hasura_endpoint,
            hasura_admin_secret=hasura_admin_secret,
            business_location_id=business_location_id,
        )
    return _get_or_create_legacy_account(
        user_id=user_id,
        currency=currency,
        hasura_endpoint=hasura_endpoint,
        hasura_admin_secret=hasura_admin_secret,
    )


def _get_or_create_legacy_account(
    user_id: str,
    currency: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
) -> Optional[Account]:
    query = """
    query GetUserAccount($userId: uuid!, $currency: currency_enum!) {
      accounts(
        where: {
          user_id: { _eq: $userId }
          currency: { _eq: $currency }
          business_location_id: { _is_null: true }
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
    return _get_or_create_account_impl(
        user_id=user_id,
        currency=currency,
        hasura_endpoint=hasura_endpoint,
        hasura_admin_secret=hasura_admin_secret,
        query=query,
        query_vars={"userId": user_id, "currency": currency},
        mutation=mutation,
        mutation_vars={"userId": user_id, "currency": currency},
    )


def _get_or_create_account(
    user_id: str,
    currency: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
    business_location_id: str,
) -> Optional[Account]:
    query = """
    query GetUserAccountByLocation($userId: uuid!, $currency: currency_enum!, $businessLocationId: uuid!) {
      accounts(
        where: {
          user_id: { _eq: $userId }
          currency: { _eq: $currency }
          business_location_id: { _eq: $businessLocationId }
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
    mutation = """
    mutation CreateAccount($userId: uuid!, $currency: currency_enum!, $businessLocationId: uuid!) {
      insert_accounts_one(object: {
        user_id: $userId,
        currency: $currency,
        business_location_id: $businessLocationId,
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
    return _get_or_create_account_impl(
        user_id=user_id,
        currency=currency,
        hasura_endpoint=hasura_endpoint,
        hasura_admin_secret=hasura_admin_secret,
        query=query,
        query_vars={"userId": user_id, "currency": currency, "businessLocationId": business_location_id},
        mutation=mutation,
        mutation_vars={"userId": user_id, "currency": currency, "businessLocationId": business_location_id},
    )


def _get_or_create_account_impl(
    user_id: str,
    currency: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
    query: str,
    query_vars: dict,
    mutation: str,
    mutation_vars: dict,
) -> Optional[Account]:
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Fetching account", user_id=user_id, currency=currency)

    try:
        data = client.execute(query, query_vars)
        accounts_data = data.get("accounts", [])

        if accounts_data:
            account_data = accounts_data[0]
            account = _account_from_data(account_data)
            log_info("Account found", user_id=user_id, account_id=account.id)
            return account

        log_info("Account not found, creating new one", user_id=user_id, currency=currency)
        create_data = client.execute(mutation, mutation_vars)
        account_data = create_data.get("insert_accounts_one")

        if not account_data:
            log_error("Failed to create account", user_id=user_id)
            return None

        account = _account_from_data(account_data)
        log_info("Account created successfully", user_id=user_id, account_id=account.id)
        return account

    except Exception as e:
        log_error("Error with account", error=e, user_id=user_id)
        return None


def _account_from_data(account_data: dict) -> Account:
    return Account(
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


def _guard_floor(delta: float) -> float:
    """Balance a decreasing column must already have. An unchanged column uses a floor that always passes."""
    return abs(delta) if delta < 0 else -1_000_000_000_000.0


def _delete_ledger_row(client: HasuraClient, transaction_id: str) -> None:
    try:
        client.execute(
            """
            mutation DeleteUnguardedLedgerRow($id: uuid!) {
              delete_account_transactions_by_pk(id: $id) { id }
            }
            """,
            {"id": transaction_id},
        )
    except Exception as error:
        log_error(
            "ledger_guard_delete_failed",
            transaction_id=transaction_id,
            error=error,
        )


def register_account_transaction(
    account_id: str,
    amount: float,
    transaction_type: str,
    memo: str,
    reference_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
    idempotency_key: Optional[str] = None,
) -> Optional[str]:
    """
    Register an account transaction and update account balances.

    When ``idempotency_key`` is set the move happens at most once: if a row with
    that key already exists its id is returned and balances are left alone. The
    row insert and the balance ``_inc`` run in one Hasura mutation request (one
    Postgres transaction), and the key is UNIQUE on account_transactions, so a
    racing duplicate aborts both and moves nothing.
    
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
        if idempotency_key:
            existing_id = _find_transaction_by_idempotency_key(client, idempotency_key)
            if existing_id:
                log_info(
                    "Transaction already registered for idempotency key; skipping",
                    account_id=account_id,
                    idempotency_key=idempotency_key,
                    transaction_id=existing_id,
                )
                return existing_id

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
        
        # Insert the ledger row and apply the balance delta in ONE GraphQL request.
        # Hasura runs every root field of a mutation request in a single Postgres
        # transaction, so either both land or neither does:
        #   * a duplicate idempotency key (UNIQUE) aborts the insert and the balance
        #     move together, so a retried or concurrent duplicate never moves money;
        #   * a guard that matches 0 rows does not roll the insert back, so that row
        #     is deleted before we return; a retry is not blocked by a key that
        #     never moved money;
        #   * `_inc` is applied by Postgres to the current row, so a concurrent backend
        #     move on the same account (the backend also uses `_inc`) is never
        #     overwritten by this snapshot (the old `_set` of absolute balances was a
        #     lost update).
        # The snapshot check above is a fast reject. The where clause is the authority:
        # a concurrent debit that already spent the funds matches 0 rows, so this
        # request does not drive the balance negative.
        mutation = """
        mutation RegisterLedgerMove(
          $accountId: uuid!,
          $amount: numeric!,
          $transactionType: transaction_type_enum!,
          $memo: String,
          $referenceId: uuid,
          $idempotencyKey: String,
          $inc: accounts_inc_input!,
          $minAvailable: numeric!,
          $minWithheld: numeric!
        ) {
          insert_account_transactions_one(object: {
            account_id: $accountId,
            amount: $amount,
            transaction_type: $transactionType,
            memo: $memo,
            reference_id: $referenceId,
            idempotency_key: $idempotencyKey
          }) {
            id
          }
          update_accounts(
            where: {
              id: { _eq: $accountId }
              available_balance: { _gte: $minAvailable }
              withheld_balance: { _gte: $minWithheld }
            },
            _inc: $inc,
            _set: { updated_at: "now()" }
          ) {
            affected_rows
            returning {
              available_balance
              withheld_balance
            }
          }
        }
        """

        try:
            transaction_data = client.execute(
                mutation,
                {
                    "accountId": account_id,
                    "amount": amount,
                    "transactionType": transaction_type.lower(),
                    "memo": memo,
                    "referenceId": reference_id,
                    "idempotencyKey": idempotency_key,
                    "inc": {
                        "available_balance": balance_update.available,
                        "withheld_balance": balance_update.withheld,
                    },
                    "minAvailable": _guard_floor(balance_update.available),
                    "minWithheld": _guard_floor(balance_update.withheld),
                },
            )
        except Exception:
            # A concurrent run inserted the same key first: the whole request rolled
            # back, so nothing moved. Report the winner's row.
            if idempotency_key:
                existing_id = _find_transaction_by_idempotency_key(client, idempotency_key)
                if existing_id:
                    log_info(
                        "Idempotency key won by a concurrent insert; skipping",
                        account_id=account_id,
                        idempotency_key=idempotency_key,
                        transaction_id=existing_id,
                    )
                    return existing_id
            raise

        transaction_id = (transaction_data.get("insert_account_transactions_one") or {}).get("id")
        update_result = transaction_data.get("update_accounts") or {}

        if not transaction_id or not update_result.get("affected_rows"):
            # A failed guard still inserts in this request (0 rows is not an error).
            # Drop that row so the idempotency key does not block a later retry,
            # and do not report success: the balance did not move.
            if transaction_id:
                _delete_ledger_row(client, transaction_id)
                log_error(
                    "ledger_guard_rejected",
                    account_id=account_id,
                    transaction_id=transaction_id,
                    transaction_type=transaction_type,
                    amount=amount,
                    idempotency_key=idempotency_key,
                )
            else:
                log_error(
                    "ledger_move_incomplete",
                    account_id=account_id,
                    affected_rows=update_result.get("affected_rows"),
                    idempotency_key=idempotency_key,
                )
            return None

        returned = (update_result.get("returning") or [{}])[0]
        new_available = float(returned.get("available_balance") or 0)
        new_withheld = float(returned.get("withheld_balance") or 0)
        if new_available < 0 or new_withheld < 0:
            log_error(
                "ledger_balance_negative_after_move",
                account_id=account_id,
                transaction_id=transaction_id,
                transaction_type=transaction_type,
                amount=amount,
                available_balance=new_available,
                withheld_balance=new_withheld,
            )

        log_info("Transaction registered successfully", account_id=account_id, transaction_id=transaction_id, transaction_type=transaction_type)
        return transaction_id
        
    except Exception as e:
        log_error("Error registering transaction", error=e, account_id=account_id)
        return None




def _find_transaction_by_idempotency_key(client: HasuraClient, idempotency_key: str) -> Optional[str]:
    data = client.execute(
        """
        query TransactionByIdempotencyKey($key: String!) {
          account_transactions(where: { idempotency_key: { _eq: $key } }, limit: 1) {
            id
          }
        }
        """,
        {"key": idempotency_key},
    )
    rows = data.get("account_transactions") or []
    return rows[0]["id"] if rows else None


def get_reference_held_amount(
    account_id: str,
    reference_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
    exclude_release_key_prefix: Optional[str] = None,
) -> float:
    """
    Amount still withheld on ``account_id`` for ledger rows referencing ``reference_id``
    (sum of holds minus sum of releases).

    Releases whose idempotency key starts with ``exclude_release_key_prefix`` are not
    subtracted, so a caller retrying its own keyed releases sees the amount that was
    held before its first attempt. Raises on Hasura errors so callers fail closed.
    """
    release_filter = '{ transaction_type: { _eq: "release" } }'
    variables: dict = {"accountId": account_id, "referenceId": reference_id}
    if exclude_release_key_prefix:
        release_filter = (
            '{ transaction_type: { _eq: "release" }, _or: ['
            "{ idempotency_key: { _is_null: true } }, "
            "{ idempotency_key: { _nlike: $excludePattern } }] }"
        )
        variables["excludePattern"] = f"{exclude_release_key_prefix}%"
    pattern_var = ", $excludePattern: String!" if exclude_release_key_prefix else ""
    query = f"""
    query ReferenceHeldAmount($accountId: uuid!, $referenceId: uuid!{pattern_var}) {{
      holds: account_transactions_aggregate(where: {{
        account_id: {{ _eq: $accountId }},
        reference_id: {{ _eq: $referenceId }},
        transaction_type: {{ _eq: "hold" }}
      }}) {{ aggregate {{ sum {{ amount }} }} }}
      releases: account_transactions_aggregate(where: {{
        account_id: {{ _eq: $accountId }},
        reference_id: {{ _eq: $referenceId }},
        _and: [{release_filter}]
      }}) {{ aggregate {{ sum {{ amount }} }} }}
    }}
    """
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    data = client.execute(query, variables)

    def _sum(alias: str) -> float:
        agg = ((data.get(alias) or {}).get("aggregate") or {}).get("sum") or {}
        return float(agg.get("amount") or 0)

    return max(0.0, round(_sum("holds") - _sum("releases"), 2))
