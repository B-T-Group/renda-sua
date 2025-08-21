import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import axios from 'axios';

interface RefreshMobilePaymentsKeyEvent {
  environment: string;
}

interface RefreshMobilePaymentsKeyResponse {
  statusCode: number;
  body: string;
}

export const handler = async (
  event: RefreshMobilePaymentsKeyEvent
): Promise<RefreshMobilePaymentsKeyResponse> => {
  console.log(
    'Starting mobile payments key refresh for environment:',
    process.env.ENVIRONMENT
  );

  try {
    // Get environment variables
    const operationAccountCode =
      process.env.OPERATION_ACCOUNT_CODE || 'ACC_68A722C33473B';
    const receptionUrlCode = process.env.RECEPTION_URL_CODE || 'TRUVU';

    if (!operationAccountCode || !receptionUrlCode) {
      throw new Error(
        'Missing required environment variables: OPERATION_ACCOUNT_CODE or RECEPTION_URL_CODE'
      );
    }

    console.log('Operation Account Code:', operationAccountCode);
    console.log('Reception URL Code:', receptionUrlCode);

    // Get refresh key password from AWS Secrets Manager
    const secretsManager = new SecretsManagerClient();
    const secretName = 'development-rendasua-backend-secrets';

    console.log('Fetching secret from:', secretName);

    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    const secretResponse = await secretsManager.send(command);

    if (!secretResponse.SecretString) {
      throw new Error('Secret value is empty or not found');
    }

    const secretData = JSON.parse(secretResponse.SecretString);
    const refreshKeyPassword = secretData.MYPVIT_SECRET_KEY_REFRESH_PASSWORD;

    if (!refreshKeyPassword) {
      throw new Error('MYPVIT_SECRET_KEY_REFRESH_PASSWORD not found in secret');
    }

    console.log(
      'Successfully retrieved refresh key password from Secrets Manager'
    );

    // Prepare form data
    const formData = {
      operationAccountCode: operationAccountCode,
      receptionUrlCode: receptionUrlCode,
      password: refreshKeyPassword,
    };

    console.log('Making POST request to MyPVit renew-secret endpoint');
    console.log('Form data (password hidden):', {
      operationAccountCode: formData.operationAccountCode,
      receptionUrlCode: formData.receptionUrlCode,
      password: '***HIDDEN***',
    });

    // Make POST request to MyPVit renew-secret endpoint
    const response = await axios.post(
      'https://api.mypvit.pro/CTCNJRBWZIDALEGT/renew-secret',
      new URLSearchParams(formData).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      }
    );

    console.log('MyPVit API Response Status:', response.status);
    console.log('MyPVit API Response Headers:', response.headers);
    console.log('MyPVit API Response Data:', response.data);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Mobile payments key refresh request completed',
        timestamp: new Date().toISOString(),
        environment: process.env.ENVIRONMENT,
        responseStatus: response.status,
        responseData: response.data,
      }),
    };
  } catch (error) {
    console.error('Error refreshing mobile payments key:', error);

    // Log additional error details
    if (axios.isAxiosError(error)) {
      console.error('Axios Error Details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
      });
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        environment: process.env.ENVIRONMENT,
      }),
    };
  }
};
