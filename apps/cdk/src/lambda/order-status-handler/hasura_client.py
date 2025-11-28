"""Hasura GraphQL client and queries."""
import os
import requests
from typing import Optional, List
from models import (
    Order,
    BusinessLocation,
    Address,
    AgentLocation,
    Coordinates,
    CompleteOrder,
    Client,
    Business,
    AssignedAgent,
    OrderHold,
    Account,
    BalanceUpdate,
    TransactionInfo,
)
from geocoding import geocode_address, persist_coordinates_to_hasura
from secrets_manager import get_hasura_admin_secret, get_google_maps_api_key


def log_info(message: str, **kwargs):
    """Log info message with optional context."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    print(f"[INFO] [hasura_client] {message}" + (f" | {context_str}" if context_str else ""))


def log_error(message: str, error: Exception = None, **kwargs):
    """Log error message with optional context and exception."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    error_str = f" | error={str(error)}" if error else ""
    print(f"[ERROR] [hasura_client] {message}" + (f" | {context_str}" if context_str else "") + error_str)


def get_order_with_location(
    order_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str,
    google_maps_api_key: Optional[str] = None
) -> Optional[Order]:
    """
    Fetch order with business location and address.
    If coordinates are missing, geocode and persist them.
    
    Args:
        order_id: Order ID to fetch
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        google_maps_api_key: Google Maps API key for geocoding
        
    Returns:
        Order object if found, None otherwise
    """
    query = """
    query GetOrderWithLocation($orderId: uuid!) {
      orders_by_pk(id: $orderId) {
        id
        order_number
        current_status
        business_location {
          id
          name
          address {
            id
            address_line_1
            address_line_2
            city
            state
            postal_code
            country
            latitude
            longitude
          }
        }
      }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payload = {
        "query": query,
        "variables": {"orderId": order_id},
    }
    
    log_info("Fetching order from Hasura", order_id=order_id)
    
    try:
        response = requests.post(
            hasura_endpoint,
            json=payload,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        
        result = response.json()
        if "errors" in result:
            log_error("Hasura query error", order_id=order_id, errors=result['errors'])
            return None
        
        order_data = result.get("data", {}).get("orders_by_pk")
        if not order_data:
            log_error("Order not found in Hasura", order_id=order_id)
            return None
        
        log_info("Order fetched successfully", order_id=order_id)
        
        # Parse business location and address
        business_location_data = order_data.get("business_location")
        if not business_location_data:
            log_error("Business location not found for order", order_id=order_id)
            return None
        
        address_data = business_location_data.get("address")
        if not address_data:
            log_error("Address not found for business location", order_id=order_id)
            return None
        
        # Create address object
        address = Address(
            id=address_data["id"],
            address_line_1=address_data["address_line_1"],
            address_line_2=address_data.get("address_line_2"),
            city=address_data["city"],
            state=address_data["state"],
            postal_code=address_data.get("postal_code"),
            country=address_data["country"],
            latitude=address_data.get("latitude"),
            longitude=address_data.get("longitude"),
        )
        
        log_info(
            "Address parsed from order",
            address_id=address.id,
            has_latitude=address.latitude is not None,
            has_longitude=address.longitude is not None,
        )
        
        # If coordinates are missing, geocode and persist
        if (address.latitude is None or address.longitude is None) and google_maps_api_key:
            log_info("Coordinates missing, starting geocoding", address_id=address.id)
            coordinates = geocode_address(address, google_maps_api_key)
            
            if coordinates:
                log_info(
                    "Geocoding successful",
                    address_id=address.id,
                    latitude=coordinates.latitude,
                    longitude=coordinates.longitude,
                )
                # Update address object with new coordinates
                address.latitude = coordinates.latitude
                address.longitude = coordinates.longitude
                
                # Persist to Hasura
                persist_coordinates_to_hasura(
                    address.id,
                    coordinates,
                    hasura_endpoint,
                    hasura_admin_secret
                )
            else:
                log_error("Failed to geocode address", address_id=address.id)
        
        business_location = BusinessLocation(
            id=business_location_data["id"],
            name=business_location_data.get("name", ""),
            address=address,
        )
        
        order = Order(
            id=order_data["id"],
            order_number=order_data["order_number"],
            business_location=business_location,
            current_status=order_data.get("current_status"),
        )
        
        log_info(
            "Order object created successfully",
            order_id=order.id,
            order_number=order.order_number,
            business_location=order.business_location.name,
        )
        
        return order
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error fetching order from Hasura", error=e, order_id=order_id)
        return None
    except Exception as e:
        log_error("Unexpected error fetching order", error=e, order_id=order_id)
        return None


def get_all_agent_locations(
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> List[AgentLocation]:
    """
    Fetch all agent locations with latest location per agent.
    
    Args:
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        List of AgentLocation objects
    """
    query = """
    query GetAgentLocations {
      agent_locations {
        agent_id
        latitude
        longitude
        created_at
        agent {
          id
          user {
            email
            first_name
            last_name
          }
        }
      }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payload = {
        "query": query,
        "variables": {},
    }
    
    log_info("Fetching all agent locations from Hasura")
    
    try:
        response = requests.post(
            hasura_endpoint,
            json=payload,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        
        result = response.json()
        if "errors" in result:
            log_error("Hasura query error when fetching agent locations", errors=result['errors'])
            return []
        
        agent_locations_data = result.get("data", {}).get("agent_locations", [])
        
        log_info("Agent locations fetched from Hasura", count=len(agent_locations_data))
        
        # Each agent has one location entry, so no deduplication needed
        agent_locations = []
        
        for loc_data in agent_locations_data:
            agent_location = AgentLocation(
                agent_id=loc_data["agent_id"],
                latitude=float(loc_data["latitude"]),
                longitude=float(loc_data["longitude"]),
                created_at=loc_data["created_at"],
                agent=loc_data.get("agent", {}),
            )
            agent_locations.append(agent_location)
        
        log_info("Agent locations parsed successfully", count=len(agent_locations))
        
        return agent_locations
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error fetching agent locations from Hasura", error=e)
        return []
    except Exception as e:
        log_error("Unexpected error fetching agent locations", error=e)
        return []


def get_complete_order_details(
    order_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[CompleteOrder]:
    """
    Fetch complete order details with all required fields for payment processing.
    
    Args:
        order_id: Order ID to fetch
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        CompleteOrder object with all required fields, None if not found
    """
    query = """
    query GetCompleteOrderDetails($orderId: uuid!) {
      orders_by_pk(id: $orderId) {
        id
        order_number
        total_amount
        currency
        client_id
        client {
          user_id
        }
        business {
          user_id
        }
        assigned_agent_id
        assigned_agent {
          user_id
        }
      }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payload = {
        "query": query,
        "variables": {"orderId": order_id},
    }
    
    log_info("Fetching complete order details", order_id=order_id)
    
    try:
        response = requests.post(
            hasura_endpoint,
            json=payload,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        
        result = response.json()
        if "errors" in result:
            log_error("Hasura query error", order_id=order_id, errors=result['errors'])
            return None
        
        order_data = result.get("data", {}).get("orders_by_pk")
        if not order_data:
            log_error("Order not found", order_id=order_id)
            return None
        
        # Parse client
        client_data = order_data.get("client")
        if not client_data:
            log_error("Client not found in order", order_id=order_id)
            return None
        client = Client(user_id=client_data["user_id"])
        
        # Parse business
        business_data = order_data.get("business")
        if not business_data:
            log_error("Business not found in order", order_id=order_id)
            return None
        business = Business(user_id=business_data["user_id"])
        
        # Parse assigned agent (optional)
        assigned_agent = None
        assigned_agent_data = order_data.get("assigned_agent")
        if assigned_agent_data:
            assigned_agent = AssignedAgent(user_id=assigned_agent_data["user_id"])
        
        complete_order = CompleteOrder(
            id=order_data["id"],
            order_number=order_data["order_number"],
            total_amount=float(order_data["total_amount"]),
            currency=order_data["currency"],
            client_id=order_data["client_id"],
            client=client,
            business=business,
            assigned_agent_id=order_data.get("assigned_agent_id"),
            assigned_agent=assigned_agent,
        )
        
        log_info("Complete order details fetched successfully", order_id=order_id)
        return complete_order
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error fetching complete order details", error=e, order_id=order_id)
        return None
    except Exception as e:
        log_error("Unexpected error fetching complete order details", error=e, order_id=order_id)
        return None


def get_or_create_order_hold(
    order_id: str,
    order: CompleteOrder,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[OrderHold]:
    """
    Get or create order hold for an order.
    
    Args:
        order_id: Order ID
        order: CompleteOrder object
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        OrderHold object, None if error
    """
    # First, try to get existing order hold
    query = """
    query GetOrderHold($orderId: uuid!) {
      order_holds(where: { order_id: { _eq: $orderId } }) {
        id
        order_id
        client_id
        agent_id
        client_hold_amount
        agent_hold_amount
        delivery_fees
        currency
        status
        created_at
        updated_at
      }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payload = {
        "query": query,
        "variables": {"orderId": order_id},
    }
    
    log_info("Fetching order hold", order_id=order_id)
    
    try:
        response = requests.post(
            hasura_endpoint,
            json=payload,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        
        result = response.json()
        if "errors" in result:
            log_error("Hasura query error", order_id=order_id, errors=result['errors'])
            return None
        
        order_holds_data = result.get("data", {}).get("order_holds", [])
        
        if order_holds_data:
            hold_data = order_holds_data[0]
            order_hold = OrderHold(
                id=hold_data["id"],
                order_id=hold_data["order_id"],
                client_id=hold_data["client_id"],
                agent_id=hold_data.get("agent_id"),
                client_hold_amount=float(hold_data["client_hold_amount"]),
                agent_hold_amount=float(hold_data["agent_hold_amount"]),
                delivery_fees=float(hold_data["delivery_fees"]),
                currency=hold_data["currency"],
                status=hold_data["status"],
                created_at=hold_data["created_at"],
                updated_at=hold_data["updated_at"],
            )
            log_info("Order hold found", order_id=order_id, hold_id=order_hold.id)
            return order_hold
        
        # Create new order hold if it doesn't exist
        log_info("Order hold not found, creating new one", order_id=order_id)
        
        mutation = """
        mutation CreateOrderHold(
          $orderId: uuid!,
          $clientId: uuid!,
          $currency: currency_enum!,
          $clientHoldAmount: numeric!,
          $deliveryFees: numeric!
        ) {
          insert_order_holds_one(object: {
            order_id: $orderId,
            client_id: $clientId,
            agent_id: null,
            client_hold_amount: $clientHoldAmount,
            agent_hold_amount: 0,
            delivery_fees: $deliveryFees,
            currency: $currency,
            status: "active"
          }) {
            id
            order_id
            client_id
            agent_id
            client_hold_amount
            agent_hold_amount
            delivery_fees
            currency
            status
            created_at
            updated_at
          }
        }
        """
        
        create_payload = {
            "query": mutation,
            "variables": {
                "orderId": order_id,
                "clientId": order.client_id,
                "currency": order.currency,
                "clientHoldAmount": order.total_amount,
                "deliveryFees": 0,
            },
        }
        
        create_response = requests.post(
            hasura_endpoint,
            json=create_payload,
            headers=headers,
            timeout=10
        )
        create_response.raise_for_status()
        
        create_result = create_response.json()
        if "errors" in create_result:
            log_error("Hasura mutation error creating order hold", order_id=order_id, errors=create_result['errors'])
            return None
        
        hold_data = create_result.get("data", {}).get("insert_order_holds_one")
        order_hold = OrderHold(
            id=hold_data["id"],
            order_id=hold_data["order_id"],
            client_id=hold_data["client_id"],
            agent_id=hold_data.get("agent_id"),
            client_hold_amount=float(hold_data["client_hold_amount"]),
            agent_hold_amount=float(hold_data["agent_hold_amount"]),
            delivery_fees=float(hold_data["delivery_fees"]),
            currency=hold_data["currency"],
            status=hold_data["status"],
            created_at=hold_data["created_at"],
            updated_at=hold_data["updated_at"],
        )
        log_info("Order hold created successfully", order_id=order_id, hold_id=order_hold.id)
        return order_hold
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error with order hold", error=e, order_id=order_id)
        return None
    except Exception as e:
        log_error("Unexpected error with order hold", error=e, order_id=order_id)
        return None


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
      }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payload = {
        "query": query,
        "variables": {"userId": user_id, "currency": currency},
    }
    
    log_info("Fetching account", user_id=user_id, currency=currency)
    
    try:
        response = requests.post(
            hasura_endpoint,
            json=payload,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        
        result = response.json()
        if "errors" in result:
            log_error("Hasura query error", user_id=user_id, errors=result['errors'])
            return None
        
        accounts_data = result.get("data", {}).get("accounts", [])
        
        if accounts_data:
            account_data = accounts_data[0]
            account = Account(
                id=account_data["id"],
                user_id=account_data["user_id"],
                currency=account_data["currency"],
                available_balance=float(account_data["available_balance"]),
                withheld_balance=float(account_data["withheld_balance"]),
                total_balance=float(account_data["total_balance"]),
                is_active=account_data["is_active"],
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
          }
        }
        """
        
        create_payload = {
            "query": mutation,
            "variables": {"userId": user_id, "currency": currency},
        }
        
        create_response = requests.post(
            hasura_endpoint,
            json=create_payload,
            headers=headers,
            timeout=10
        )
        create_response.raise_for_status()
        
        create_result = create_response.json()
        if "errors" in create_result:
            log_error("Hasura mutation error creating account", user_id=user_id, errors=create_result['errors'])
            return None
        
        account_data = create_result.get("data", {}).get("insert_accounts_one")
        account = Account(
            id=account_data["id"],
            user_id=account_data["user_id"],
            currency=account_data["currency"],
            available_balance=float(account_data["available_balance"]),
            withheld_balance=float(account_data["withheld_balance"]),
            total_balance=float(account_data["total_balance"]),
            is_active=account_data["is_active"],
        )
        log_info("Account created successfully", user_id=user_id, account_id=account.id)
        return account
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error with account", error=e, user_id=user_id)
        return None
    except Exception as e:
        log_error("Unexpected error with account", error=e, user_id=user_id)
        return None


def determine_transaction_balance_update(
    transaction_type: str,
    amount: float
) -> TransactionInfo:
    """
    Determine balance updates for a transaction type.
    Matches the logic from AccountsService.determineTransactionType in the backend.
    
    Args:
        transaction_type: Type of transaction (release, payment, etc.)
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
    elif transaction_type == "release":
        # Release: increases withheld balance (money moves from available to withheld)
        # Note: This matches backend logic where release increases withheld_balance
        return TransactionInfo(
            isCredit=True,
            balanceUpdate=BalanceUpdate(available=0, withheld=amount),
        )
    elif transaction_type == "payment":
        # Payment: decreases available balance
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
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payload = {
        "query": query,
        "variables": {"accountId": account_id},
    }
    
    log_info("Fetching account for transaction", account_id=account_id, transaction_type=transaction_type)
    
    try:
        response = requests.post(
            hasura_endpoint,
            json=payload,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        
        result = response.json()
        if "errors" in result:
            log_error("Hasura query error", account_id=account_id, errors=result['errors'])
            return None
        
        account_data = result.get("data", {}).get("accounts_by_pk")
        if not account_data:
            log_error("Account not found", account_id=account_id)
            return None
        
        account = Account(
            id=account_data["id"],
            user_id="",  # Not needed for this operation
            currency="",  # Not needed for this operation
            available_balance=float(account_data["available_balance"]),
            withheld_balance=float(account_data["withheld_balance"]),
            total_balance=float(account_data["total_balance"]),
            is_active=True,  # Not needed for this operation
        )
        
        # Determine balance update
        transaction_info = determine_transaction_balance_update(transaction_type, amount)
        balance_update = transaction_info.balanceUpdate
        
        # Calculate new balances
        new_available = account.available_balance + balance_update.available
        new_withheld = account.withheld_balance + balance_update.withheld
        new_total = new_available + new_withheld
        
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
        
        transaction_payload = {
            "query": mutation,
            "variables": {
                "accountId": account_id,
                "amount": amount,
                "transactionType": transaction_type.lower(),
                "memo": memo,
                "referenceId": reference_id,
            },
        }
        
        transaction_response = requests.post(
            hasura_endpoint,
            json=transaction_payload,
            headers=headers,
            timeout=10
        )
        transaction_response.raise_for_status()
        
        transaction_result = transaction_response.json()
        if "errors" in transaction_result:
            log_error("Hasura mutation error inserting transaction", account_id=account_id, errors=transaction_result['errors'])
            return None
        
        transaction_id = transaction_result.get("data", {}).get("insert_account_transactions_one", {}).get("id")
        
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
        
        update_payload = {
            "query": update_mutation,
            "variables": {
                "accountId": account_id,
                "availableBalance": new_available,
                "withheldBalance": new_withheld,
            },
        }
        
        update_response = requests.post(
            hasura_endpoint,
            json=update_payload,
            headers=headers,
            timeout=10
        )
        update_response.raise_for_status()
        
        update_result = update_response.json()
        if "errors" in update_result:
            log_error("Hasura mutation error updating account balances", account_id=account_id, errors=update_result['errors'])
            return None
        
        log_info("Transaction registered successfully", account_id=account_id, transaction_id=transaction_id, transaction_type=transaction_type)
        return transaction_id
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error registering transaction", error=e, account_id=account_id)
        return None
    except Exception as e:
        log_error("Unexpected error registering transaction", error=e, account_id=account_id)
        return None


def update_order_hold_status(
    order_hold_id: str,
    status: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> bool:
    """
    Update order hold status.
    
    Args:
        order_hold_id: Order hold ID
        status: New status
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        True if successful, False otherwise
    """
    mutation = """
    mutation UpdateOrderHold($orderHoldId: uuid!, $status: order_hold_status_enum!) {
      update_order_holds_by_pk(
        pk_columns: { id: $orderHoldId },
        _set: { status: $status }
      ) {
        id
        status
      }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payload = {
        "query": mutation,
        "variables": {"orderHoldId": order_hold_id, "status": status},
    }
    
    log_info("Updating order hold status", order_hold_id=order_hold_id, status=status)
    
    try:
        response = requests.post(
            hasura_endpoint,
            json=payload,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        
        result = response.json()
        if "errors" in result:
            log_error("Hasura mutation error updating order hold", order_hold_id=order_hold_id, errors=result['errors'])
            return False
        
        log_info("Order hold status updated successfully", order_hold_id=order_hold_id, status=status)
        return True
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error updating order hold", error=e, order_hold_id=order_hold_id)
        return False
    except Exception as e:
        log_error("Unexpected error updating order hold", error=e, order_hold_id=order_hold_id)
        return False

