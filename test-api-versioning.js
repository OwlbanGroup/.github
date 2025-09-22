const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000';
let serverProcess;

// Helper function to make API requests with different version headers
async function testApiCall(endpoint, method = 'GET', data = null, version = null) {
    const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (version) {
        config.headers['Accept-Version'] = version;
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

    // Test 1: Basic endpoint without version header
    console.log('Test 1: Basic endpoint without version header');
    const test1 = await testApiCall('/api/financial/status');
    console.log(`Status: ${test1.status}`);
    console.log(`Success: ${test1.success}`);
    console.log(`Response includes version info: ${test1.data?.version ? '✅' : '❌'}`);
    console.log('---\n');

    // Test 2: Request with valid version header
    console.log('Test 2: Request with valid version header (v1.0)');
    const test2 = await testApiCall('/api/financial/status', 'GET', null, '1.0');
    console.log(`Status: ${test2.status}`);
    console.log(`Success: ${test2.success}`);
    console.log(`Version in response: ${test2.data?.version || 'N/A'}`);
    console.log('---\n');

    // Test 3: Request with invalid version header
    console.log('Test 3: Request with invalid version header (v99.0)');
    const test3 = await testApiCall('/api/financial/status', 'GET', null, '99.0');
    console.log(`Status: ${test3.status}`);
    console.log(`Success: ${test3.success}`);
    console.log(`Error message: ${test3.data?.error || 'N/A'}`);
    console.log('---\n');

    // Test 4: Test with AI endpoint
    console.log('Test 4: AI endpoint with version header');
    const test4 = await testApiCall('/api/ai/openai-chat', 'POST', {
        messages: [{ role: 'user', content: 'Hello, test message' }]
    }, '1.0');
    console.log(`Status: ${test4.status}`);
    console.log(`Success: ${test4.success}`);
    console.log(`Response includes version: ${test4.data?.version ? '✅' : '❌'}`);
    console.log('---\n');

    // Test 5: Test version info endpoint (if exists)
    console.log('Test 5: Version info endpoint');
    const test5 = await testApiCall('/api/version');
    console.log(`Status: ${test5.status}`);
    console.log(`Success: ${test5.success}`);
    console.log(`Version info: ${JSON.stringify(test5.data, null, 2)}`);
    console.log('---\n');

    // Summary
    console.log('📊 Test Summary:');
    const tests = [test1, test2, test3, test4, test5];
    const passed = tests.filter(t => t.success).length;
    console.log(`Passed: ${passed}/${tests.length}`);

    if (passed === tests.length) {
        console.log('🎉 All tests passed! API versioning middleware is working correctly.');
    } else {
        console.log('⚠️ Some tests failed. Please check the middleware implementation.');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testApiCall, runTests };
