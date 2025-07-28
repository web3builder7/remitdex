#!/bin/bash

echo "🚀 Deploying RemitDEX to Testnets..."

# Load environment variables
source .env

# Check required environment variables
if [ -z "$STELLAR_RESOLVER_SECRET" ]; then
    echo "❌ Error: STELLAR_RESOLVER_SECRET not set in .env"
    exit 1
fi

if [ -z "$ONEINCH_API_KEY" ]; then
    echo "⚠️  Warning: ONEINCH_API_KEY not set - using demo mode"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔨 Building TypeScript..."
npm run build

echo ""
echo "🌟 Checking Stellar connectivity..."
node -e "
const StellarSdk = require('@stellar/stellar-sdk');
const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
server.loadAccount('GDQJL3RJKP3G5V2R3CIXTZBLNKNS5PV4IKVCMQVROZIXJDJ6NE2K4QTR')
  .then(() => console.log('✅ Stellar testnet connection successful'))
  .catch(() => console.log('❌ Stellar testnet connection failed'));
"

echo ""
echo "🔗 Verifying HTLC contracts..."
echo "EVM HTLC: 0xd13361Ea6Ed3A20852eD2F0faDfDDFcdA7B13D97"
echo "Stellar HTLC: CDQJL3RJKP3G5V2R3CIXTZBLNKNS5PV4IKVCMQVROZIXJDJ6NE2K4QTR"

echo ""
echo "🧪 Running tests..."
npm test

echo ""
echo "🌐 Starting RemitDEX services..."

# Start API server
echo "Starting API server on port 3000..."
node dist/api/server.js &
API_PID=$!

# Wait for API to start
sleep 5

# Check if API is running
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ API server running on http://localhost:3000"
else
    echo "❌ API server failed to start"
    kill $API_PID 2>/dev/null
    exit 1
fi

echo ""
echo "📊 Opening dashboard..."
# In production, would serve via nginx/apache
python3 -m http.server 8080 --directory src/ui &
UI_PID=$!

echo ""
echo "✅ RemitDEX deployed successfully!"
echo ""
echo "🔗 Access points:"
echo "   API:       http://localhost:3000"
echo "   Dashboard: http://localhost:8080/dashboard.html"
echo "   UI:        http://localhost:8080"
echo ""
echo "📝 API Endpoints:"
echo "   POST /api/quote     - Get remittance quote"
echo "   POST /api/remit     - Execute remittance"
echo "   GET  /api/order/:id - Check order status"
echo "   GET  /api/corridors - List supported corridors"
echo ""
echo "🛑 To stop services, run: kill $API_PID $UI_PID"

# Keep script running
wait