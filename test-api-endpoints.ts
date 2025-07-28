import axios from 'axios';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config();

// Wait for server to start
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAPIEndpoints() {
  console.log('🌐 Testing RemitDEX API Endpoints\n');
  console.log('Starting API server...\n');

  // Start the API server on a different port for testing
  const serverProcess = spawn('node', ['dist/api/server.js'], {
    env: { ...process.env, PORT: '3456' },
    detached: false
  });

  let serverReady = false;

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
    if (data.toString().includes('running on port')) {
      serverReady = true;
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });

  // Wait for server to be ready
  let attempts = 0;
  while (!serverReady && attempts < 30) {
    await wait(1000);
    attempts++;
  }

  if (!serverReady) {
    console.log('❌ Server failed to start');
    serverProcess.kill();
    return;
  }

  const API_URL = 'http://localhost:3456';

  try {
    // Test 1: Health Check
    console.log('\n1️⃣ Testing Health Check Endpoint\n');
    try {
      const health = await axios.get(`${API_URL}/health`);
      console.log('✅ GET /health');
      console.log('Response:', JSON.stringify(health.data, null, 2));
    } catch (error: any) {
      console.log('❌ GET /health failed:', error.message);
    }

    // Test 2: Get Supported Corridors
    console.log('\n2️⃣ Testing Corridors Endpoint\n');
    try {
      const corridors = await axios.get(`${API_URL}/api/corridors`);
      console.log('✅ GET /api/corridors');
      console.log(`Found ${corridors.data.corridors.length} corridors:`);
      corridors.data.corridors.forEach((c: any) => {
        console.log(`  - ${c.from} → ${c.to}: ${c.currencies.join(', ')}`);
      });
    } catch (error: any) {
      console.log('❌ GET /api/corridors failed:', error.message);
    }

    // Test 3: Get Quote
    console.log('\n3️⃣ Testing Quote Endpoint\n');
    const quoteRequest = {
      fromChain: 'ethereum',
      fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      fromAmount: '100',
      toCountry: 'Philippines',
      toCurrency: 'PHP',
      deliveryMethod: 'gcash'
    };

    try {
      const quoteResponse = await axios.post(`${API_URL}/api/quote`, quoteRequest);
      console.log('✅ POST /api/quote');
      console.log('Request:', JSON.stringify(quoteRequest, null, 2));
      console.log('Response:', JSON.stringify(quoteResponse.data.quote, null, 2));
    } catch (error: any) {
      console.log('❌ POST /api/quote failed:', error.response?.data || error.message);
    }

    // Test 4: Execute Remittance (Mock)
    console.log('\n4️⃣ Testing Remittance Execution Endpoint\n');
    const remitRequest = {
      quote: {
        fromChain: 'ethereum',
        fromToken: 'USDC',
        fromAmount: '100',
        toCountry: 'Philippines',
        toCurrency: 'PHP',
        toAmount: '5594.50',
        exchangeRate: 56.50,
        totalFees: 0.9,
        estimatedTime: 4,
        route: []
      },
      senderAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E789',
      recipientDetails: {
        name: 'Juan Dela Cruz',
        deliveryMethod: 'gcash',
        phoneNumber: '+639123456789',
        accountName: 'Juan Dela Cruz'
      }
    };

    try {
      console.log('⚠️  Skipping actual remittance execution (requires blockchain interaction)');
      console.log('Would execute remittance with:');
      console.log(`  From: ${remitRequest.senderAddress}`);
      console.log(`  To: ${remitRequest.recipientDetails.name} (${remitRequest.recipientDetails.phoneNumber})`);
      console.log(`  Amount: $${remitRequest.quote.fromAmount} → ${remitRequest.quote.toAmount} PHP`);
    } catch (error: any) {
      console.log('❌ POST /api/remit failed:', error.response?.data || error.message);
    }

    // Test 5: Check Order Status
    console.log('\n5️⃣ Testing Order Status Endpoint\n');
    const mockOrderId = 'RMT-1234567890-abc123';
    try {
      const orderStatus = await axios.get(`${API_URL}/api/order/${mockOrderId}`);
      console.log('✅ GET /api/order/:id');
      console.log('Response:', JSON.stringify(orderStatus.data, null, 2));
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('✅ GET /api/order/:id - Correctly returns 404 for non-existent order');
      } else {
        console.log('❌ GET /api/order/:id failed:', error.message);
      }
    }

    // Test 6: Invalid Requests
    console.log('\n6️⃣ Testing Error Handling\n');

    // Test invalid quote request
    try {
      await axios.post(`${API_URL}/api/quote`, {});
    } catch (error: any) {
      console.log('✅ Invalid quote request correctly rejected:', error.response?.data?.error);
    }

    // Test invalid corridor
    try {
      await axios.post(`${API_URL}/api/quote`, {
        ...quoteRequest,
        toCountry: 'Mars',
        toCurrency: 'MARS'
      });
    } catch (error: any) {
      console.log('✅ Invalid corridor correctly rejected:', error.response?.data?.error);
    }

    console.log('\n✅ API Endpoint Testing Complete!');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    // Kill the server process
    console.log('\nStopping API server...');
    serverProcess.kill();
  }
}

// First build the project
console.log('Building project...\n');
const buildProcess = spawn('npm', ['run', 'build'], {
  stdio: 'inherit'
});

buildProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Build successful\n');
    // Run the API tests
    testAPIEndpoints().catch(console.error);
  } else {
    console.log('\n❌ Build failed');
  }
});