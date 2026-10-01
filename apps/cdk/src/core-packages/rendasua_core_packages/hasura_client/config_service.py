"""Configuration-related Hasura operations."""
from typing import Any, Dict, List, Optional
from .base import HasuraClient, HasuraClientConfig
from .logging import log_info, log_error


def get_cancellation_fee_percent_rows(
    country_code: Optional[str],
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> List[Dict[str, Any]]:
    """
    Active ``cancellation_fee_percent`` rows for the country and the global (NULL country) row.

    Unlike the legacy flat-fee reader this does NOT swallow errors: a Hasura/network
    failure raises, so the caller fails the financial step (it is retried / alerted)
    instead of silently waiving the fee. An empty list means "no row configured".
    """
    country_filter = (
        "{ country_code: { _eq: $countryCode } }\n          " if country_code else ""
    )
    var_decl = ", $countryCode: String!" if country_code else ""
    query = f"""
    query GetCancellationFeePercent($configKey: String!{var_decl}) {{
      application_configurations(
        where: {{
          config_key: {{ _eq: $configKey }}
          status: {{ _eq: "active" }}
          _or: [
          {country_filter}{{ country_code: {{ _is_null: true }} }}
          ]
        }}
      ) {{
        country_code
        number_value
      }}
    }}
    """
    variables: Dict[str, Any] = {"configKey": "cancellation_fee_percent"}
    if country_code:
        variables["countryCode"] = country_code
    client = HasuraClient(HasuraClientConfig(endpoint=hasura_endpoint, admin_secret=hasura_admin_secret))
    data = client.execute(query, variables)
    return data.get("application_configurations", []) or []


def get_cancellation_fee_config(
    country_code: str,
    hasura_endpoint: str,
    hasura_admin_secret: str
) -> Optional[float]:
    """
    DEPRECATED / RETIRED: legacy flat ``cancellation_fee`` reader. The cancellation fee is
    now ``cancellation_fee_percent`` (see ``get_cancellation_fee_percent_rows``); this is
    kept only for backward compatibility and is no longer used by the cancellation flow.

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

