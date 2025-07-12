const axios = require('axios');

// Test the address creation API
async function testAddressAPI() {
  try {
    const addressData = {
      address_line_1: '123 Test Street',
      address_line_2: 'Suite 100',
      city: 'Douala',
      state: 'Littoral',
      postal_code: '237',
      country: 'Cameroon',
      is_primary: true,
      address_type: 'home',
      latitude: 4.0511,
      longitude: 9.7679,
    };

    console.log(
      'Testing address creation with data:',
      JSON.stringify(addressData, null, 2)
    );

    // Note: This would need proper authentication headers in a real test
    const response = await axios.post(
      'http://localhost:3000/addresses',
      addressData,
      {
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers here when testing
          // 'Authorization': 'Bearer your-token-here'
        },
      }
    );

    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(
      'Error testing address API:',
      error.response?.data || error.message
    );
  }
}

// Test different countries to verify currency mapping
async function testCurrencyMapping() {
  const testCountries = [
    { country: 'Cameroon', expectedCurrency: 'XAF' },
    { country: 'United States', expectedCurrency: 'USD' },
    { country: 'United Kingdom', expectedCurrency: 'GBP' },
    { country: 'Germany', expectedCurrency: 'EUR' },
    { country: 'Nigeria', expectedCurrency: 'NGN' },
    { country: 'South Africa', expectedCurrency: 'ZAR' },
    { country: 'Kenya', expectedCurrency: 'KES' },
    { country: 'Ghana', expectedCurrency: 'GHS' },
  ];

  console.log('\nTesting currency mapping:');
  for (const test of testCountries) {
    try {
      const addressData = {
        address_line_1: 'Test Address',
        city: 'Test City',
        state: 'Test State',
        postal_code: '12345',
        country: test.country,
      };

      console.log(`\n${test.country} -> Expected: ${test.expectedCurrency}`);
      // In a real test, you would make the API call here
      // For now, just log the test data
      console.log('Test data:', JSON.stringify(addressData, null, 2));
    } catch (error) {
      console.error(`Error testing ${test.country}:`, error.message);
    }
  }
}

// Run tests
async function runTests() {
  console.log('=== Address API Test ===\n');

  await testAddressAPI();
  await testCurrencyMapping();

  console.log('\n=== Test Complete ===');
}

runTests();
