"""
Commission-related Hasura operations.

This module provides functions for fetching commission-related data from Hasura,
including commission configurations, partners, HQ user, and commission orders.
"""

from typing import Optional, List
import datetime
from rendasua_core_packages.models import Partner, User, Order, CommissionPayout, Agent, Business
from rendasua_core_packages.utilities import parse_datetime
from .base import HasuraClient
from .logging import log_info, log_error
from rendasua_core_packages.commission_handler.types import (
    CommissionConfig,
    CommissionOrder as CommissionOrderType,
    AssignedAgent,
)


def get_commission_configs(client: HasuraClient) -> CommissionConfig:
    """
    Fetch commission configurations from application_configurations table.
    
    Args:
        client: HasuraClient instance
        
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
    
    log_info("Fetching commission configurations")
    
    try:
        data = client.execute(query)
        configs_data = data.get("application_configurations", [])
        
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
        
    except Exception as e:
        log_error("Error fetching commission configs", error=e)
        # Return defaults on error
        return CommissionConfig(
            rendasua_item_commission_percentage=5.0,
            unverified_agent_base_delivery_commission=50.0,
            verified_agent_base_delivery_commission=0.0,
            unverified_agent_per_km_delivery_commission=80.0,
            verified_agent_per_km_delivery_commission=20.0,
        )


def get_active_partners(client: HasuraClient) -> List[Partner]:
    """
    Fetch active partners from partners table.
    
    Args:
        client: HasuraClient instance
        
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
    
    log_info("Fetching active partners")
    
    try:
        data = client.execute(query)
        partners_data = data.get("partners", [])
        
        partners = []
        for partner_data in partners_data:
            partner = Partner(
                id=partner_data["id"],
                user_id=partner_data["user_id"],
                company_name=partner_data["company_name"],
                base_delivery_fee_commission=float(partner_data["base_delivery_fee_commission"]),
                per_km_delivery_fee_commission=float(partner_data["per_km_delivery_fee_commission"]),
                item_commission=float(partner_data["item_commission"]),
                is_active=partner_data.get("is_active", True),
                created_at=parse_datetime(partner_data.get("created_at")),
                updated_at=parse_datetime(partner_data.get("updated_at")),
            )
            partners.append(partner)
        
        log_info("Active partners fetched", count=len(partners))
        return partners
        
    except Exception as e:
        log_error("Error fetching partners", error=e)
        return []


def get_rendasua_hq_user(client: HasuraClient) -> Optional[User]:
    """
    Fetch RendaSua HQ user by email.
    
    Args:
        client: HasuraClient instance
        
    Returns:
        User if found, None otherwise
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
        created_at
        updated_at
      }
    }
    """
    
    log_info("Fetching RendaSua HQ user")
    
    try:
        data = client.execute(query)
        users_data = data.get("users", [])
        
        if not users_data:
            log_error("RendaSua HQ user not found")
            return None
        
        user_data = users_data[0]
        hq_user = User(
            id=user_data["id"],
            user_type_id=user_data.get("user_type_id"),
            identifier=user_data["identifier"],
            first_name=user_data["first_name"],
            last_name=user_data["last_name"],
            email=user_data["email"],
            phone_number=user_data.get("phone_number"),
            created_at=parse_datetime(user_data.get("created_at")),
            updated_at=parse_datetime(user_data.get("updated_at")),
        )
        
        log_info("RendaSua HQ user fetched", user_id=hq_user.id)
        return hq_user
        
    except Exception as e:
        log_error("Error fetching HQ user", error=e)
        return None


def get_commission_order(client: HasuraClient, order_id: str) -> Optional[CommissionOrderType]:
    """
    Fetch order with all commission-related fields.
    
    Args:
        client: HasuraClient instance
        order_id: Order ID to fetch
        
    Returns:
        CommissionOrderType if found, None otherwise
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
          id
          user_id
          is_verified
          created_at
          updated_at
        }
        business {
          id
          user_id
          name
          created_at
          updated_at
        }
      }
    }
    """
    
    log_info("Fetching commission order", order_id=order_id)
    
    try:
        data = client.execute(query, {"orderId": order_id})
        order_data = data.get("orders_by_pk")
        
        if not order_data:
            log_error("Commission order not found", order_id=order_id)
            return None
        
        # Construct Pydantic Agent model from assigned_agent relation
        agent_model = None
        assigned_agent = None
        if order_data.get("assigned_agent"):
            agent_data = order_data["assigned_agent"]
            # Create full Pydantic Agent model
            agent_model = Agent.model_construct(
                id=agent_data["id"],
                user_id=agent_data["user_id"],
                is_verified=agent_data.get("is_verified"),
                created_at=parse_datetime(agent_data.get("created_at")),
                updated_at=parse_datetime(agent_data.get("updated_at")),
            )
            # Extract fields for lightweight AssignedAgent type used by CommissionOrderType
            assigned_agent = AssignedAgent(
                user_id=agent_model.user_id,
                is_verified=agent_model.is_verified or False,
            )
        
        # Construct Pydantic Business model from business relation
        business_model = None
        business_user_id = ""
        if order_data.get("business"):
            business_data = order_data["business"]
            # Create full Pydantic Business model
            business_model = Business.model_construct(
                id=business_data["id"],
                user_id=business_data["user_id"],
                name=business_data.get("name", ""),
                created_at=parse_datetime(business_data.get("created_at")),
                updated_at=parse_datetime(business_data.get("updated_at")),
            )
            business_user_id = business_model.user_id
        
        if not business_user_id:
            log_error("Business user_id not found in order", order_id=order_id)
            return None
        
        # Create CommissionOrderType
        commission_order = CommissionOrderType(
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
        
    except Exception as e:
        log_error("Error fetching commission order", error=e, order_id=order_id)
        return None


def audit_commission_payout(
    client: HasuraClient,
    order_id: str,
    recipient_user_id: str,
    recipient_type: str,
    commission_type: str,
    amount: float,
    currency: str,
    account_transaction_id: str,
    commission_percentage: Optional[float] = None
) -> Optional[str]:
    """
    Insert commission payout record in commission_payouts table.
    
    Args:
        client: HasuraClient instance
        order_id: Order ID
        recipient_user_id: Recipient user ID
        recipient_type: Type of recipient (partner, rendasua, agent, business)
        commission_type: Type of commission (base_delivery_fee, per_km_delivery_fee, item_sale, order_subtotal)
        amount: Commission amount
        currency: Currency code
        account_transaction_id: Account transaction ID
        commission_percentage: Optional commission percentage
        
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
    
    log_info(
        "Auditing commission payout",
        order_id=order_id,
        recipient_user_id=recipient_user_id,
        recipient_type=recipient_type,
        commission_type=commission_type,
        amount=amount,
    )
    
    try:
        data = client.execute(mutation, {"payout": payout_input})
        payout_data = data.get("insert_commission_payouts_one")
        
        if not payout_data:
            log_error("Failed to insert commission payout", order_id=order_id)
            return None
        
        payout_id = payout_data["id"]
        log_info("Commission payout audited", payout_id=payout_id, order_id=order_id)
        return payout_id
        
    except Exception as e:
        log_error("Error auditing commission payout", error=e, order_id=order_id)
        return None

