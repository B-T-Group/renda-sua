"""Hasura GraphQL queries for commission data."""
from typing import Optional, List
import requests
import sys
import os

# Add parent directory to path to import from hasura_client
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hasura_client import log_info, log_error
from .models import (
    Partner,
    CommissionConfig,
    RendasuaHQUser,
    CommissionOrder,
    CommissionAssignedAgent,
)


def get_commission_configs(
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> CommissionConfig:
    """
    Fetch commission configurations from application_configurations table.
    
    Args:
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        CommissionConfig with values from database or defaults
    """
    query = """
    query GetCommissionConfigs {
      application_configurations(
        where: { 
          config_key: { _in: [
            "rendasua_item_commission_percentage",
            "unverified_agent_base_delivery_commission",
            "verified_agent_base_delivery_commission",
            "unverified_agent_per_km_delivery_commission",
            "verified_agent_per_km_delivery_commission"
          ]}
        }
      ) {
        config_key
        number_value
      }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payload = {
        "query": query,
    }
    
    log_info("Fetching commission configurations")
    
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
            log_error("Hasura query error fetching commission configs", errors=result['errors'])
            # Return defaults on error
            return _get_default_commission_config()
        
        configs_data = result.get("data", {}).get("application_configurations", [])
        
        # Build config map
        config_map = {}
        for config in configs_data:
            config_map[config["config_key"]] = config["number_value"]
        
        # Return config with defaults for missing values
        return CommissionConfig(
            rendasua_item_commission_percentage=config_map.get(
                "rendasua_item_commission_percentage", 5.0
            ),
            unverified_agent_base_delivery_commission=config_map.get(
                "unverified_agent_base_delivery_commission", 50.0
            ),
            verified_agent_base_delivery_commission=config_map.get(
                "verified_agent_base_delivery_commission", 0.0
            ),
            unverified_agent_per_km_delivery_commission=config_map.get(
                "unverified_agent_per_km_delivery_commission", 80.0
            ),
            verified_agent_per_km_delivery_commission=config_map.get(
                "verified_agent_per_km_delivery_commission", 20.0
            ),
        )
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error fetching commission configs", error=e)
        return _get_default_commission_config()
    except Exception as e:
        log_error("Unexpected error fetching commission configs", error=e)
        return _get_default_commission_config()


def _get_default_commission_config() -> CommissionConfig:
    """Get default commission configuration."""
    return CommissionConfig(
        rendasua_item_commission_percentage=5.0,
        unverified_agent_base_delivery_commission=50.0,
        verified_agent_base_delivery_commission=0.0,
        unverified_agent_per_km_delivery_commission=80.0,
        verified_agent_per_km_delivery_commission=20.0,
    )


def get_active_partners(
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> List[Partner]:
    """
    Fetch active partners from partners table.
    
    Args:
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        List of active Partner objects
    """
    query = """
    query GetActivePartners {
      partners(where: { is_active: { _eq: true } }) {
        id
        user_id
        company_name
        base_delivery_fee_commission
        per_km_delivery_fee_commission
        item_commission
        is_active
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
    }
    
    log_info("Fetching active partners")
    
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
            log_error("Hasura query error fetching partners", errors=result['errors'])
            return []
        
        partners_data = result.get("data", {}).get("partners", [])
        
        partners = []
        for partner_data in partners_data:
            partner = Partner(
                id=partner_data["id"],
                user_id=partner_data["user_id"],
                company_name=partner_data["company_name"],
                base_delivery_fee_commission=float(partner_data["base_delivery_fee_commission"]),
                per_km_delivery_fee_commission=float(partner_data["per_km_delivery_fee_commission"]),
                item_commission=float(partner_data["item_commission"]),
                is_active=partner_data["is_active"],
                created_at=partner_data["created_at"],
                updated_at=partner_data["updated_at"],
            )
            partners.append(partner)
        
        log_info("Active partners fetched", count=len(partners))
        return partners
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error fetching partners", error=e)
        return []
    except Exception as e:
        log_error("Unexpected error fetching partners", error=e)
        return []


def get_rendasua_hq_user(
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[RendasuaHQUser]:
    """
    Fetch RendaSua HQ user by email.
    
    Args:
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        RendasuaHQUser if found, None otherwise
    """
    query = """
    query GetRendasuaHQUser {
      users(where: { email: { _eq: "hq@rendasua.com" } }) {
        id
        user_type_id
        identifier
        first_name
        last_name
        email
        phone_number
      }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payload = {
        "query": query,
    }
    
    log_info("Fetching RendaSua HQ user")
    
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
            log_error("Hasura query error fetching HQ user", errors=result['errors'])
            return None
        
        users_data = result.get("data", {}).get("users", [])
        
        if not users_data:
            log_error("RendaSua HQ user not found")
            return None
        
        user_data = users_data[0]
        hq_user = RendasuaHQUser(
            id=user_data["id"],
            user_type_id=user_data["user_type_id"],
            identifier=user_data["identifier"],
            first_name=user_data["first_name"],
            last_name=user_data["last_name"],
            email=user_data["email"],
            phone_number=user_data["phone_number"],
        )
        
        log_info("RendaSua HQ user fetched", user_id=hq_user.id)
        return hq_user
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error fetching HQ user", error=e)
        return None
    except Exception as e:
        log_error("Unexpected error fetching HQ user", error=e)
        return None


def get_commission_order(
    order_id: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[CommissionOrder]:
    """
    Fetch order with all commission-related fields.
    
    Args:
        order_id: Order ID to fetch
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        CommissionOrder if found, None otherwise
    """
    query = """
    query GetCommissionOrder($orderId: uuid!) {
      orders_by_pk(id: $orderId) {
        id
        order_number
        base_delivery_fee
        per_km_delivery_fee
        subtotal
        currency
        assigned_agent_id
        assigned_agent {
          user_id
          is_verified
        }
        business {
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
    
    log_info("Fetching commission order", order_id=order_id)
    
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
            log_error("Hasura query error fetching commission order", order_id=order_id, errors=result['errors'])
            return None
        
        order_data = result.get("data", {}).get("orders_by_pk")
        if not order_data:
            log_error("Commission order not found", order_id=order_id)
            return None
        
        # Parse assigned agent
        assigned_agent = None
        if order_data.get("assigned_agent"):
            agent_data = order_data["assigned_agent"]
            assigned_agent = CommissionAssignedAgent(
                user_id=agent_data["user_id"],
                is_verified=agent_data.get("is_verified", False),
            )
        
        # Parse business user_id
        business_user_id = order_data.get("business", {}).get("user_id", "")
        if not business_user_id:
            log_error("Business user_id not found in order", order_id=order_id)
            return None
        
        commission_order = CommissionOrder(
            id=order_data["id"],
            order_number=order_data["order_number"],
            base_delivery_fee=float(order_data["base_delivery_fee"]),
            per_km_delivery_fee=float(order_data["per_km_delivery_fee"]),
            subtotal=float(order_data["subtotal"]),
            currency=order_data["currency"],
            assigned_agent_id=order_data.get("assigned_agent_id"),
            assigned_agent=assigned_agent,
            business_user_id=business_user_id,
        )
        
        log_info("Commission order fetched", order_id=order_id, order_number=commission_order.order_number)
        return commission_order
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error fetching commission order", order_id=order_id, error=e)
        return None
    except Exception as e:
        log_error("Unexpected error fetching commission order", order_id=order_id, error=e)
        return None


def audit_commission_payout(
    order_id: str,
    recipient_user_id: str,
    recipient_type: str,
    commission_type: str,
    amount: float,
    currency: str,
    account_transaction_id: str,
    commission_percentage: Optional[float],
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[str]:
    """
    Insert commission payout record in commission_payouts table.
    
    Args:
        order_id: Order ID
        recipient_user_id: Recipient user ID
        recipient_type: Type of recipient (partner, rendasua, agent, business)
        commission_type: Type of commission (base_delivery_fee, per_km_delivery_fee, item_sale, order_subtotal)
        amount: Commission amount
        currency: Currency code
        account_transaction_id: Account transaction ID
        commission_percentage: Optional commission percentage
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        Commission payout ID if successful, None otherwise
    """
    mutation = """
    mutation InsertCommissionPayout($payout: commission_payouts_insert_input!) {
      insert_commission_payouts_one(object: $payout) {
        id
      }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasura_admin_secret,
    }
    
    payout_input = {
        "order_id": order_id,
        "recipient_user_id": recipient_user_id,
        "recipient_type": recipient_type,
        "commission_type": commission_type,
        "amount": amount,
        "currency": currency,
        "account_transaction_id": account_transaction_id,
    }
    
    if commission_percentage is not None:
        payout_input["commission_percentage"] = commission_percentage
    
    payload = {
        "query": mutation,
        "variables": {"payout": payout_input},
    }
    
    log_info(
        "Auditing commission payout",
        order_id=order_id,
        recipient_user_id=recipient_user_id,
        recipient_type=recipient_type,
        commission_type=commission_type,
        amount=amount,
    )
    
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
            log_error("Hasura mutation error inserting commission payout", order_id=order_id, errors=result['errors'])
            return None
        
        payout_data = result.get("data", {}).get("insert_commission_payouts_one")
        if not payout_data:
            log_error("Failed to insert commission payout", order_id=order_id)
            return None
        
        payout_id = payout_data["id"]
        log_info("Commission payout audited", payout_id=payout_id, order_id=order_id)
        return payout_id
        
    except requests.exceptions.RequestException as e:
        log_error("HTTP error auditing commission payout", order_id=order_id, error=e)
        return None
    except Exception as e:
        log_error("Unexpected error auditing commission payout", order_id=order_id, error=e)
        return None

