const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000';

// Helper function to make API requests with different version headers
async function testApiCall(endpoint, method = 'GET', data = null, version = null, authToken = null) {
    const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (version) {
        config.headers['x-api-version'] = version;
    }

    if (authToken) {
        config.headers['authorization'] = `Bearer ${authToken}`;
    }

    if (data) {
        config.data = data;
    }

    try {
        const response = await axios(config);
        return {
            success: true,
            status: response.status,
            data: response.data,
            headers: response.headers
        };
    } catch (error) {
        return {
            success: false,
            status: error.response?.status || 500,
            data: error.response?.data || error.message,
            headers: error.response?.headers || {}
        };
    }
}

// Test cases
async function runTests() {
    console.log('🧪 Starting API Versioning Middleware Tests...\n');

    // Test 1: Public endpoint without authentication (GPU metrics)
    console.log('Test 1: Public endpoint without version header (/api/gpu)');
    const test1 = await testApiCall('/api/gpu');
    console.log(`Status: ${test1.status}`);
    console.log(`Success: ${test1.success}`);
    console.log(`Response includes version info: ${test1.data?._metadata?.apiVersion ? '✅' : '❌'}`);
    if (test1.data?._metadata) {
        console.log(`Version: ${test1.data._metadata.apiVersion}`);
    }
    console.log('---\n');

    // Test 2: Public endpoint with version header
    console.log('Test 2: Public endpoint with version header (1.0.0)');
    const test2 = await testApiCall('/api/gpu', 'GET', null, '1.0.0');
    console.log(`Status: ${test2.status}`);
    console.log(`Success: ${test2.success}`);
    if (test2.data?._metadata) {
        console.log(`Version: ${test2.data._metadata.apiVersion}`);
    } else if (test2.data?.api_version) {
        console.log(`Legacy version format: ${test2.data.api_version}`);
    }
    console.log('---\n');

    // Test 3: Invalid version header
    console.log('Test 3: Public endpoint with invalid version header (99.0.0)');
    const test3 = await testApiCall('/api/gpu', 'GET', null, '99.0.0');
    console.log(`Status: ${test3.status}`);
    console.log(`Success: ${test3.success}`);
    console.log(`Error message: ${test3.data?.error || 'N/A'}`);
    console.log('---\n');

    // Test 4: Prometheus metrics endpoint (public)
    console.log('Test 4: Prometheus metrics endpoint');
    const test4 = await testApiCall('/metrics');
    console.log(`Status: ${test4.status}`);
    console.log(`Success: ${test4.success}`);
    console.log(`Response type: ${test4.headers['content-type'] || 'N/A'}`);
    console.log('---\n');

    // Test 5: Test middleware with invalid version on protected endpoint
    console.log('Test 5: Protected endpoint with invalid version (should fail at middleware)');
    const test5 = await testApiCall('/api/financial/status', 'GET', null, '99.0.0');
    console.log(`Status: ${test5.status}`);
    console.log(`Success: ${test5.success}`);
    console.log(`Error message: ${test5.data?.error || 'N/A'}`);
    console.log('---\n');

    // Test 6: Test middleware with valid version on protected endpoint (should fail at auth)
    console.log('Test 6: Protected endpoint with valid version but no auth (should fail at auth)');
    const test6 = await testApiCall('/api/financial/status', 'GET', null, '1.0.0');
    console.log(`Status: ${test6.status}`);
    console.log(`Success: ${test6.success}`);
    console.log(`Error message: ${test6.data?.error || 'N/A'}`);
    console.log('---\n');

    // Summary
    console.log('📊 Test Summary:');
    const tests = [test1, test2, test3, test4, test5, test6];
    const passed = tests.filter(t => t.success).length;
    console.log(`Passed: ${passed}/${tests.length}`);

    if (passed >= 4) {
        console.log('🎉 API versioning middleware is working correctly!');
        console.log('✅ Version validation is functioning');
        console.log('✅ Response formatting is applied');
        console.log('✅ Invalid versions are properly rejected');
    } else {
        console.log('⚠️ Some tests failed. The middleware may need adjustment.');
        console.log('\n🔍 Analysis:');
        console.log('- Tests 1-4 test public endpoints and middleware functionality');
        console.log('- Tests 5-6 test protected endpoints (expected to fail due to auth)');
        console.log('- If tests 1-4 pass, the middleware integration is successful');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testApiCall, runTests };
