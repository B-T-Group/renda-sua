"""AWS Secrets Manager helper functions."""
import json
import boto3
import os
from typing import Dict, Optional


def get_secret(secret_name: str) -> Dict[str, str]:
    """
    Retrieve secret from AWS Secrets Manager.
    
    Args:
        secret_name: Name of the secret to retrieve
        
    Returns:
        Dictionary containing secret values
    """
    client = boto3.client('secretsmanager')
    
    try:
        response = client.get_secret_value(
            SecretId=secret_name,
        )
        
        if 'SecretString' in response:
            return json.loads(response['SecretString'])
        else:
            raise ValueError(f"Secret {secret_name} does not contain SecretString")
            
    except Exception as e:
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
    return secrets.get('HASURA_GRAPHQL_ADMIN_SECRET')


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
    secret_name = f"{environment}-rendasua-backend-secrets"
    secrets = get_secret(secret_name)
    return secrets.get('SENDGRID_API_KEY')

