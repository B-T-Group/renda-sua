import json
import os
from datetime import datetime
from typing import Dict, Any

import boto3
import requests
from botocore.exceptions import ClientError


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda function to refresh Airtel mobile payments key
    """
    print(f"Starting Airtel mobile payments key refresh for environment: {os.environ.get('ENVIRONMENT')}")

    try:
        # Get environment variables
        operation_account_code = os.environ.get('AIRTEL_OPERATION_ACCOUNT_CODE', 'ACC_68A722C33473B')
        reception_url_code = os.environ.get('RECEPTION_URL_CODE', 'TRUVU')
        mypvit_secret_key = os.environ.get('MYPVIT_SECRET_KEY_REFRESH_PATH', 'CTCNJRBWZIDALEGT')

        if not all([operation_account_code, reception_url_code, mypvit_secret_key]):
            raise ValueError('Missing required environment variables')

        print(f"Airtel Operation Account Code: {operation_account_code}")
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

        print('Making POST request to MyPVit renew-secret endpoint for Airtel')

        # Make POST request to MyPVit renew-secret endpoint
        api_url = f'https://api.mypvit.pro/{mypvit_secret_key}/renew-secret'
        print(f"Making request to: {api_url}")
        
        response = requests.post(
            api_url,
            data=form_data,
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout=30,
        )

        print(f"MyPVit API Response Status: {response.status_code}")
        print(f"MyPVit API Response Data: {response.text}")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'provider': 'airtel',
                'message': 'Airtel mobile payments key refresh request completed',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'environment': os.environ.get('ENVIRONMENT'),
                'responseStatus': response.status_code,
                'responseData': response.text,
            }),
        }

    except Exception as error:
        print(f"Error refreshing Airtel mobile payments key: {str(error)}")

        if isinstance(error, requests.exceptions.RequestException):
            print(f"Request Error Details: {str(error)}")
            if hasattr(error, 'response') and error.response is not None:
                print(f"Response Status: {error.response.status_code}")
                print(f"Response Text: {error.response.text}")

        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'provider': 'airtel',
                'error': str(error),
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'environment': os.environ.get('ENVIRONMENT'),
            }),
        }
