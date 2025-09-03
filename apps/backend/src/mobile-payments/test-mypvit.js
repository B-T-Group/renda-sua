const axios = require('axios');
const crypto = require('crypto');

// MyPVit Test Configuration
const config = {
  baseUrl: 'https://api.mypvit.pro',
  merchantSlug: 'MR_1755783875',
  // Environment-specific secret key
  secretKey:
    process.env.NODE_ENV === 'production'
      ? 'CJF0DPOVZU87UUK8'
      : 'CTCNJRBWZIDALEGT',
  // Environment-specific account ID
  accountId:
    process.env.NODE_ENV === 'production'
      ? 'ACC_001122334455'
      : 'ACC_68A722C33473B',
  // Environment-specific endpoints
  paymentEndpoint:
    process.env.NODE_ENV === 'production'
      ? 'OLHRVTQPJBQEIHRT'
      : 'X5T3RIBYQUDFBZSH',
  kycEndpoint:
    process.env.NODE_ENV === 'production'
      ? 'LRMFT2YW3YCCHKEH'
      : 'W2OZPE4QDSWH3Z5R',
  balanceEndpoint:
    process.env.NODE_ENV === 'production'
      ? 'NQUPMQFT35COWOWW'
      : 'LIRYOTW7QL3DCDPJ',
  secretRenewalEndpoint:
    process.env.NODE_ENV === 'production'
      ? 'XI1OVAQBUCK8WEJC'
      : 'RYXA6SLFNRBFFQJX',
};

// Create HTTP client with interceptors
const httpClient = axios.create({
  baseURL: config.baseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Add request interceptor for authentication
httpClient.interceptors.request.use((config) => {
  return config;
});

// Test functions
async function testConnection() {
  try {
    console.log('🔍 Testing MyPVit connection...');

    // Test balance check
    const balanceResponse = await httpClient.get(
      `/${config.balanceEndpoint}/balance`
    );
    console.log('✅ Balance check successful:', balanceResponse.data);

    return true;
  } catch (error) {
    console.error(
      '❌ Connection test failed:',
      error.response?.data || error.message
    );
    return false;
  }
}

async function testPaymentInitiation() {
  try {
    console.log('💳 Testing payment initiation...');

    const paymentData = {
      amount: 1000,
      currency: 'XAF',
      reference: 'T' + Date.now().toString().slice(-8),
      description: 'Test payment from Rendasua',
      customer_phone: '+241123456789',
      customer_email: 'test@rendasua.com',
      callback_url: 'https://api.rendasua.com/mobile-payments/callback/mypvit',
      return_url: 'https://rendasua.com/payment/success',
    };

    const response = await httpClient.post(
      `/${config.paymentEndpoint}/rest`,
      paymentData
    );
    console.log('✅ Payment initiation successful:', response.data);

    return response.data;
  } catch (error) {
    console.error(
      '❌ Payment initiation failed:',
      error.response?.data || error.message
    );
    return null;
  }
}

async function testKYC() {
  try {
    console.log('🆔 Testing KYC verification...');

    const kycData = {
      customerPhone: '+241123456789',
      customerName: 'Test Customer',
      customerId: 'TEST123',
      customerEmail: 'test@rendasua.com',
    };

    const response = await httpClient.post(
      `/${config.kycEndpoint}/kyc`,
      kycData
    );
    console.log('✅ KYC verification successful:', response.data);

    return response.data;
  } catch (error) {
    console.error(
      '❌ KYC verification failed:',
      error.response?.data || error.message
    );
    return null;
  }
}

async function testSecretRenewal() {
  try {
    console.log('🔑 Testing secret key renewal...');

    const response = await httpClient.post(
      `/${config.secretRenewalEndpoint}/renew-secret`
    );
    console.log('✅ Secret key renewal successful:', response.data);

    return response.data;
  } catch (error) {
    console.error(
      '❌ Secret key renewal failed:',
      error.response?.data || error.message
    );
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting MyPVit Integration Tests\n');

  // Test 1: Connection
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.log('\n❌ Connection test failed. Stopping tests.');
    return;
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: KYC
  await testKYC();

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Payment Initiation
  const paymentResult = await testPaymentInitiation();

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: Secret Renewal (optional - may not work in test environment)
  await testSecretRenewal();

  console.log('\n' + '='.repeat(50));
  console.log('🎉 MyPVit Integration Tests Completed!');

  if (paymentResult && paymentResult.success) {
    console.log('\n📋 Next Steps:');
    console.log('1. Check the payment URL:', paymentResult.payment_url);
    console.log('2. Test the payment flow in the MyPVit test environment');
    console.log('3. Verify callback handling');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testConnection,
  testPaymentInitiation,
  testKYC,
  testSecretRenewal,
  runTests,
};
