"""Configuration-related Hasura operations."""
from typing import Optional
from .base import HasuraClient, HasuraClientConfig
from .logging import log_info, log_error


def get_cancellation_fee_config(
    country_code: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[float]:
    """
    Get cancellation fee configuration for a country.
    
    Args:
        country_code: Country code (e.g., 'GA', 'CM')
        hasura_endpoint: Hasura GraphQL endpoint
        hasura_admin_secret: Hasura admin secret
        
    Returns:
        Cancellation fee amount if found, None otherwise
    """
    query = """
    query GetCancellationFee($countryCode: String!, $configKey: String!) {
      application_configurations(
        where: {
          config_key: { _eq: $configKey }
          country_code: { _eq: $countryCode }
          status: { _eq: "active" }
        }
        limit: 1
      ) {
        id
        number_value
      }
    }
    """
    
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    log_info("Fetching cancellation fee config", country_code=country_code)
    
    try:
        data = client.execute(query, {"countryCode": country_code, "configKey": "cancellation_fee"})
        configs = data.get("application_configurations", [])
        
        if not configs:
            log_info("Cancellation fee config not found", country_code=country_code)
            return None
        
        config = configs[0]
        fee_value = config.get("number_value")
        if fee_value is None:
            log_info("Cancellation fee config has no number_value", country_code=country_code)
            return None
        
        fee = float(fee_value)
        log_info("Cancellation fee config found", country_code=country_code, fee=fee)
        return fee
        
    except Exception as e:
        log_error("Error fetching cancellation fee config", error=e, country_code=country_code)
        return None

