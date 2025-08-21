import json
import os
import urllib.parse
from datetime import datetime
from typing import Dict, Any

import boto3
import requests
from botocore.exceptions import ClientError


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda function to refresh mobile payments key
    
    Args:
        event: Lambda event containing environment information
        context: Lambda context
    
    Returns:
        Dict containing status code and response body
    """
    print(f"Starting mobile payments key refresh for environment: {os.environ.get('ENVIRONMENT')}")

    try:
        # Get environment variables
        operation_account_code = os.environ.get('OPERATION_ACCOUNT_CODE', 'ACC_68A722C33473B')
        reception_url_code = os.environ.get('RECEPTION_URL_CODE', 'TRUVU')

        if not operation_account_code or not reception_url_code:
            raise ValueError(
                'Missing required environment variables: OPERATION_ACCOUNT_CODE or RECEPTION_URL_CODE'
            )

        print(f"Operation Account Code: {operation_account_code}")
        print(f"Reception URL Code: {reception_url_code}")

        # Get refresh key password from AWS Secrets Manager
        secrets_manager = boto3.client('secrets-manager')
        secret_name = 'development-rendasua-backend-secrets'

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

        print('Making POST request to MyPVit renew-secret endpoint')
        print('Form data (password hidden):', {
            'operationAccountCode': form_data['operationAccountCode'],
            'receptionUrlCode': form_data['receptionUrlCode'],
            'password': '***HIDDEN***',
        })

        # Make POST request to MyPVit renew-secret endpoint
        response = requests.post(
            'https://api.mypvit.pro/CTCNJRBWZIDALEGT/renew-secret',
            data=form_data,
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout=30,
        )

        print(f"MyPVit API Response Status: {response.status_code}")
        print(f"MyPVit API Response Headers: {dict(response.headers)}")
        print(f"MyPVit API Response Data: {response.text}")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'message': 'Mobile payments key refresh request completed',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'environment': os.environ.get('ENVIRONMENT'),
                'responseStatus': response.status_code,
                'responseData': response.text,
            }),
        }

    except Exception as error:
        print(f"Error refreshing mobile payments key: {str(error)}")

        # Log additional error details for requests errors
        if isinstance(error, requests.exceptions.RequestException):
            print(f"Request Error Details: {str(error)}")
            if hasattr(error, 'response') and error.response is not None:
                print(f"Response Status: {error.response.status_code}")
                print(f"Response Text: {error.response.text}")

        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(error),
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'environment': os.environ.get('ENVIRONMENT'),
            }),
        }
