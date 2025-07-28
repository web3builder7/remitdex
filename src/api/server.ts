import express from 'express';
import cors from 'cors';
import { RemittanceEngine } from '../services/RemittanceEngine';
import { config } from 'dotenv';

config();

const app = express();
app.use(cors());
app.use(express.json());

const remittanceEngine = new RemittanceEngine(
  process.env.ONEINCH_API_KEY || '',
  'testnet'
);

// Get remittance quote
app.post('/api/quote', async (req, res) => {
  try {
    const quote = await remittanceEngine.getQuote(req.body);
    res.json({ success: true, quote });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Execute remittance
app.post('/api/remit', async (req, res) => {
  try {
    const { quote, senderAddress, recipientDetails } = req.body;
    const order = await remittanceEngine.executeRemittance(
      quote,
      senderAddress,
      recipientDetails
    );
    res.json({ success: true, order });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Check order status
app.get('/api/order/:orderId', async (req, res) => {
  try {
    const order = await remittanceEngine.getOrderStatus(req.params.orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }
    res.json({ success: true, order });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get supported corridors
app.get('/api/corridors', async (req, res) => {
  try {
    const corridors = await remittanceEngine.getSupportedCorridors();
    res.json({ success: true, corridors });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'RemitDEX API',
    version: '1.0.0' 
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`RemitDEX API running on port ${PORT}`);
  console.log(`
    Endpoints:
    - POST /api/quote     - Get remittance quote
    - POST /api/remit     - Execute remittance
    - GET  /api/order/:id - Check order status
    - GET  /api/corridors - Get supported corridors
    - GET  /health        - Health check
  `);
});

export default app;