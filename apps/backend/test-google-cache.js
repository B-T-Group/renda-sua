// Simple test script to verify Google cache implementation
// This script can be run to test the caching functionality

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testDistanceMatrixCache() {
  console.log('Testing Distance Matrix Cache...');

  try {
    // Test 1: First request (should call Google API and cache)
    console.log('\n1. Making first request (should call Google API)...');
    const response1 = await axios.post(`${BASE_URL}/google/distance-matrix`, {
      destination_address_ids: ['test-dest-1', 'test-dest-2'],
      origin_address_id: 'test-origin-1',
    });
    console.log('First request response:', response1.data.status);

    // Test 2: Second request (should use cache)
    console.log('\n2. Making second request (should use cache)...');
    const response2 = await axios.post(`${BASE_URL}/google/distance-matrix`, {
      destination_address_ids: ['test-dest-1', 'test-dest-2'],
      origin_address_id: 'test-origin-1',
    });
    console.log('Second request response:', response2.data.status);

    console.log('\n✅ Distance Matrix Cache Test Completed');
  } catch (error) {
    console.error('❌ Distance Matrix Cache Test Failed:', error.message);
  }
}

async function testGeocodeCache() {
  console.log('\nTesting Geocode Cache...');

  try {
    // Test 1: First request (should call Google API and cache)
    console.log(
      '\n1. Making first geocode request (should call Google API)...'
    );
    const response1 = await axios.get(
      `${BASE_URL}/google/geocode?lat=1.234&lng=5.678`
    );
    console.log('First geocode request success:', response1.data.success);

    // Test 2: Second request (should use cache)
    console.log('\n2. Making second geocode request (should use cache)...');
    const response2 = await axios.get(
      `${BASE_URL}/google/geocode?lat=1.234&lng=5.678`
    );
    console.log('Second geocode request success:', response2.data.success);

    console.log('\n✅ Geocode Cache Test Completed');
  } catch (error) {
    console.error('❌ Geocode Cache Test Failed:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Google Cache Tests...\n');

  await testDistanceMatrixCache();
  await testGeocodeCache();

  console.log('\n🎉 All tests completed!');
  console.log('\nNote: These tests require:');
  console.log('- Backend server running on localhost:3000');
  console.log('- Valid Google Maps API key configured');
  console.log('- Valid address IDs in the database');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testDistanceMatrixCache, testGeocodeCache };
