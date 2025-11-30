"""AWS Secrets Manager helper functions."""
import json
import boto3
import os
from typing import Dict, Optional


def log_info(message: str, **kwargs):
    """Log info message with optional context."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    print(f"[INFO] [secrets_manager] {message}" + (f" | {context_str}" if context_str else ""))


def log_error(message: str, error: Exception | None = None, **kwargs):
    """Log error message with optional context and exception."""
    context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
    error_str = f" | error={str(error)}" if error else ""
    print(f"[ERROR] [secrets_manager] {message}" + (f" | {context_str}" if context_str else "") + error_str)


def get_secret(secret_name: str) -> Dict[str, str]:
    """
    Retrieve secret from AWS Secrets Manager.
    
    Args:
        secret_name: Name of the secret to retrieve
        
    Returns:
        Dictionary containing secret values
    """
    log_info("Retrieving secret from Secrets Manager", secret_name=secret_name)
    
    client = boto3.client('secretsmanager')
    
    try:
        response = client.get_secret_value(
            SecretId=secret_name,
        )
        
        if 'SecretString' in response:
            secrets = json.loads(response['SecretString'])
            log_info("Secret retrieved successfully", secret_name=secret_name, keys=list(secrets.keys()))
            return secrets
        else:
            log_error("Secret does not contain SecretString", secret_name=secret_name)
            raise ValueError(f"Secret {secret_name} does not contain SecretString")
            
    except Exception as e:
        log_error("Failed to retrieve secret", error=e, secret_name=secret_name)
        raise Exception(f"Failed to retrieve secret {secret_name}: {str(e)}")


def get_hasura_admin_secret(environment: str) -> str:
    """
    Get Hasura admin secret from Secrets Manager.
    
    Args:
        environment: Environment name (development or production)
        
    Returns:
        Hasura admin secret string
    """
    secret_name = f"{environment}-rendasua-backend-secrets"
    secrets = get_secret(secret_name)
    admin_secret = secrets.get('HASURA_GRAPHQL_ADMIN_SECRET')
    if not admin_secret:
        log_error("Hasura admin secret not found in secrets", environment=environment, secret_name=secret_name)
        raise ValueError(f"Hasura admin secret not found in secrets {secret_name}")
    return admin_secret


def get_google_maps_api_key(environment: str) -> Optional[str]:
    """
    Get Google Maps API key from Secrets Manager.
    
    Args:
        environment: Environment name (development or production)
        
    Returns:
        Google Maps API key or None if not found
    """
    secret_name = f"{environment}-rendasua-backend-secrets"
    secrets = get_secret(secret_name)
    return secrets.get('GOOGLE_MAPS_API_KEY')


def get_sendgrid_api_key(environment: str) -> Optional[str]:
    """
    Get SendGrid API key from Secrets Manager.
    
    Args:
        environment: Environment name (development or production)
        
    Returns:
        SendGrid API key or None if not found
    """
    log_info("Retrieving SendGrid API key", environment=environment)
    
    try:
        secret_name = f"{environment}-rendasua-backend-secrets"
        secrets = get_secret(secret_name)
        api_key = secrets.get('SENDGRID_API_KEY')
        
        if api_key:
            # Log partial key for verification (first 8 chars only)
            masked_key = api_key[:8] + "..." if len(api_key) > 8 else "***"
            log_info("SendGrid API key retrieved successfully", key_preview=masked_key)
            return api_key
        else:
            log_error("SendGrid API key not found in secrets", environment=environment, secret_name=secret_name)
            log_info("Available secret keys", keys=list(secrets.keys())[:10])  # Log first 10 keys
            return None
            
    except Exception as e:
        log_error("Failed to retrieve SendGrid API key", error=e, environment=environment)
        return None

