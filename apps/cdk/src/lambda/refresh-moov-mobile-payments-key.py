import json
import os
from datetime import datetime
from typing import Dict, Any

import boto3
import requests
from botocore.exceptions import ClientError


def _expires_in(response: Any) -> Any:
    """Only the non-secret expires_in field of the renew-secret response, if present."""
    try:
        body = response.json()
        return body.get('expires_in') if isinstance(body, dict) else None
    except Exception:
        return None


def _safe_error(error: Exception) -> str:
    """
    Error text that is safe to log. A requests exception's text can carry the request URL
    (with the code-url-secret path) or a response body (renew-secret returns the live secret),
    so only its type and HTTP status are kept.
    """
    if isinstance(error, requests.exceptions.RequestException):
        status = getattr(getattr(error, 'response', None), 'status_code', None)
        return f"{type(error).__name__}" + (f" (HTTP {status})" if status is not None else '')
    return str(error)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda function to refresh MOOV mobile payments key
    """
    print(f"Starting MOOV mobile payments key refresh for environment: {os.environ.get('ENVIRONMENT')}")

    try:
        # Get environment variables
        operation_account_code = os.environ.get('MOOV_OPERATION_ACCOUNT_CODE', 'ACC_68A722C33473B')
        reception_url_code = os.environ.get('RECEPTION_URL_CODE', 'TRUVU')
        mypvit_secret_key = os.environ.get('MYPVIT_SECRET_KEY_REFRESH_PATH', 'CTCNJRBWZIDALEGT')

        if not all([operation_account_code, reception_url_code, mypvit_secret_key]):
            raise ValueError('Missing required environment variables')

        print(f"MOOV Operation Account Code: {operation_account_code}")
        print(f"Reception URL Code: {reception_url_code}")

        # Get refresh key password from AWS Secrets Manager
        secrets_manager = boto3.client('secretsmanager')
        secret_name = f"{os.environ.get('ENVIRONMENT')}-rendasua-backend-secrets"

        print(f"Fetching secret from: {secret_name}")

        try:
            secret_response = secrets_manager.get_secret_value(SecretId=secret_name)
        except ClientError as e:
            raise Exception(f"Failed to retrieve secret: {str(e)}")

        if not secret_response.get('SecretString'):
            raise Exception('Secret value is empty or not found')

        secret_data = json.loads(secret_response['SecretString'])
        refresh_key_password = secret_data.get('MYPVIT_SECRET_KEY_REFRESH_PASSWORD')

        if not refresh_key_password:
            raise Exception('MYPVIT_SECRET_KEY_REFRESH_PASSWORD not found in secret')

        print('Successfully retrieved refresh key password from Secrets Manager')

        # Prepare form data
        form_data = {
            'operationAccountCode': operation_account_code,
            'receptionUrlCode': reception_url_code,
            'password': refresh_key_password,
        }

        print('Making POST request to MyPVit renew-secret endpoint for MOOV')

        # Make POST request to MyPVit renew-secret endpoint
        api_url = f'https://api.mypvit.pro/{mypvit_secret_key}/renew-secret'
        # api_url embeds the code-url-secret path segment: never log it.
        
        response = requests.post(
            api_url,
            data=form_data,
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout=30,
        )

        # The renew-secret response body is {operation_account_code, secret, expires_in}:
        # `secret` is the live sk_live key, so the body is never logged or returned.
        expires_in = _expires_in(response)
        print(f"MyPVit API Response Status: {response.status_code} (expires_in: {expires_in})")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'provider': 'moov',
                'message': 'MOOV mobile payments key refresh request completed',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'environment': os.environ.get('ENVIRONMENT'),
                'responseStatus': response.status_code,
                'expiresIn': expires_in,
            }),
        }

    except Exception as error:
        safe_error = _safe_error(error)
        print(f"Error refreshing MOOV mobile payments key: {safe_error}")

        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'provider': 'moov',
                'error': safe_error,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'environment': os.environ.get('ENVIRONMENT'),
            }),
        }
