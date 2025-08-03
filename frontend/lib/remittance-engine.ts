import { RemittanceEngine } from '@/services/RemittanceEngine';

// Create a singleton instance of RemittanceEngine
let remittanceEngine: RemittanceEngine | null = null;

export function getRemittanceEngine() {
  if (!remittanceEngine) {
    remittanceEngine = new RemittanceEngine(
      process.env.ONEINCH_API_KEY || '',
      'testnet'
    );
  }
  return remittanceEngine;
}