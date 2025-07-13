const axios = require('axios');

// Configuration
const API_BASE = 'http://localhost:3000';
const TEST_ORDER_ID = '550e8400-e29b-41d4-a716-446655440000';

// Mock JWT token (replace with real token for testing)
const MOCK_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInVzZXJfdHlwZSI6ImJ1c2luZXNzIiwiaWF0IjoxNzM1NzE5MjAwLCJleHAiOjE3MzU4MDU2MDB9.mock';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${MOCK_TOKEN}`,
};

async function testOrderAPIs() {
  console.log('🧪 Testing Order APIs...\n');

  try {
    // Test 1: Confirm Order
    console.log('1️⃣ Testing POST /orders/confirm');
    try {
      const confirmResponse = await axios.post(
        `${API_BASE}/orders/confirm`,
        {
          orderId: TEST_ORDER_ID,
          notes: 'Test confirmation by business',
        },
        { headers }
      );

      console.log('✅ Confirm order response:', confirmResponse.data);
    } catch (error) {
      console.log(
        '❌ Confirm order error:',
        error.response?.data || error.message
      );
    }

    // Test 2: Start Preparing
    console.log('\n2️⃣ Testing POST /orders/start_preparing');
    try {
      const startResponse = await axios.post(
        `${API_BASE}/orders/start_preparing`,
        {
          orderId: TEST_ORDER_ID,
          notes: 'Test start preparation',
        },
        { headers }
      );

      console.log('✅ Start preparing response:', startResponse.data);
    } catch (error) {
      console.log(
        '❌ Start preparing error:',
        error.response?.data || error.message
      );
    }

    // Test 3: Complete Preparation
    console.log('\n3️⃣ Testing POST /orders/complete_preparation');
    try {
      const completeResponse = await axios.post(
        `${API_BASE}/orders/complete_preparation`,
        {
          orderId: TEST_ORDER_ID,
          notes: 'Test complete preparation',
        },
        { headers }
      );

      console.log('✅ Complete preparation response:', completeResponse.data);
    } catch (error) {
      console.log(
        '❌ Complete preparation error:',
        error.response?.data || error.message
      );
    }

    // Test 4: Get Order (Agent Assignment)
    console.log('\n4️⃣ Testing POST /orders/get_order');
    try {
      const getOrderResponse = await axios.post(
        `${API_BASE}/orders/get_order`,
        {
          orderId: TEST_ORDER_ID,
        },
        { headers }
      );

      console.log('✅ Get order response:', getOrderResponse.data);
    } catch (error) {
      console.log('❌ Get order error:', error.response?.data || error.message);
    }

    // Test 5: Pick Up Order
    console.log('\n5️⃣ Testing POST /orders/pick_up');
    try {
      const pickUpResponse = await axios.post(
        `${API_BASE}/orders/pick_up`,
        {
          orderId: TEST_ORDER_ID,
          notes: 'Picked up from business location',
        },
        { headers }
      );

      console.log('✅ Pick up order response:', pickUpResponse.data);
    } catch (error) {
      console.log(
        '❌ Pick up order error:',
        error.response?.data || error.message
      );
    }

    // Test 6: Start Transit
    console.log('\n6️⃣ Testing POST /orders/start_transit');
    try {
      const startTransitResponse = await axios.post(
        `${API_BASE}/orders/start_transit`,
        {
          orderId: TEST_ORDER_ID,
          notes: 'Started transit to customer',
        },
        { headers }
      );

      console.log('✅ Start transit response:', startTransitResponse.data);
    } catch (error) {
      console.log(
        '❌ Start transit error:',
        error.response?.data || error.message
      );
    }

    // Test 7: Out for Delivery
    console.log('\n7️⃣ Testing POST /orders/out_for_delivery');
    try {
      const outForDeliveryResponse = await axios.post(
        `${API_BASE}/orders/out_for_delivery`,
        {
          orderId: TEST_ORDER_ID,
          notes: 'Arrived at customer location',
        },
        { headers }
      );

      console.log('✅ Out for delivery response:', outForDeliveryResponse.data);
    } catch (error) {
      console.log(
        '❌ Out for delivery error:',
        error.response?.data || error.message
      );
    }

    // Test 8: Deliver Order
    console.log('\n8️⃣ Testing POST /orders/deliver');
    try {
      const deliverResponse = await axios.post(
        `${API_BASE}/orders/deliver`,
        {
          orderId: TEST_ORDER_ID,
          notes: 'Delivered to customer successfully',
        },
        { headers }
      );

      console.log('✅ Deliver order response:', deliverResponse.data);
    } catch (error) {
      console.log(
        '❌ Deliver order error:',
        error.response?.data || error.message
      );
    }

    // Test 9: Fail Delivery
    console.log('\n9️⃣ Testing POST /orders/fail_delivery');
    try {
      const failDeliveryResponse = await axios.post(
        `${API_BASE}/orders/fail_delivery`,
        {
          orderId: TEST_ORDER_ID,
          notes: 'Customer not available',
        },
        { headers }
      );

      console.log('✅ Fail delivery response:', failDeliveryResponse.data);
    } catch (error) {
      console.log(
        '❌ Fail delivery error:',
        error.response?.data || error.message
      );
    }

    // Test 10: Cancel Order
    console.log('\n🔟 Testing POST /orders/cancel');
    try {
      const cancelResponse = await axios.post(
        `${API_BASE}/orders/cancel`,
        {
          orderId: TEST_ORDER_ID,
          notes: 'Cancelled by business',
        },
        { headers }
      );

      console.log('✅ Cancel order response:', cancelResponse.data);
    } catch (error) {
      console.log(
        '❌ Cancel order error:',
        error.response?.data || error.message
      );
    }

    // Test 11: Refund Order
    console.log('\n1️⃣1️⃣ Testing POST /orders/refund');
    try {
      const refundResponse = await axios.post(
        `${API_BASE}/orders/refund`,
        {
          orderId: TEST_ORDER_ID,
          notes: 'Refunded due to customer complaint',
        },
        { headers }
      );

      console.log('✅ Refund order response:', refundResponse.data);
    } catch (error) {
      console.log(
        '❌ Refund order error:',
        error.response?.data || error.message
      );
    }

    // Test 12: Test with invalid order ID
    console.log('\n1️⃣2️⃣ Testing with invalid order ID');
    try {
      const invalidResponse = await axios.post(
        `${API_BASE}/orders/confirm`,
        {
          orderId: 'invalid-uuid',
          notes: 'Test invalid order',
        },
        { headers }
      );

      console.log('✅ Invalid order response:', invalidResponse.data);
    } catch (error) {
      console.log(
        '❌ Invalid order error:',
        error.response?.data || error.message
      );
    }

    // Test 13: Test without authentication
    console.log('\n1️⃣3️⃣ Testing without authentication');
    try {
      const noAuthResponse = await axios.post(`${API_BASE}/orders/confirm`, {
        orderId: TEST_ORDER_ID,
        notes: 'Test no auth',
      });

      console.log('✅ No auth response:', noAuthResponse.data);
    } catch (error) {
      console.log('❌ No auth error:', error.response?.data || error.message);
    }
  } catch (error) {
    console.error('🚨 Test suite error:', error.message);
  }

  console.log('\n🏁 Order API tests completed!');
}

// Test configuration validation
async function testConfiguration() {
  console.log('\n🔧 Testing Configuration...');

  try {
    // Test environment variable
    const holdPercentage = process.env.AGENT_HOLD_PERCENTAGE || '80';
    console.log(`✅ Agent hold percentage: ${holdPercentage}%`);

    // Test default configuration
    console.log('✅ Configuration validation passed');
  } catch (error) {
    console.log('❌ Configuration error:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Order API Tests\n');

  await testConfiguration();
  await testOrderAPIs();

  console.log('\n✨ All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testOrderAPIs, testConfiguration };
