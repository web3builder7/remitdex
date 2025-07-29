import { RemittanceOrder } from '../../interfaces/IRemittance';

interface Metrics {
  totalVolume: number;
  totalTransactions: number;
  successRate: number;
  averageTransactionSize: number;
  corridorVolumes: Map<string, number>;
  chainVolumes: Map<string, number>;
  hourlyVolumes: number[];
  failureReasons: Map<string, number>;
}

export class MetricsCollector {
  private metrics: Metrics = {
    totalVolume: 0,
    totalTransactions: 0,
    successRate: 0,
    averageTransactionSize: 0,
    corridorVolumes: new Map(),
    chainVolumes: new Map(),
    hourlyVolumes: new Array(24).fill(0),
    failureReasons: new Map()
  };

  private orders: RemittanceOrder[] = [];

  recordOrder(order: RemittanceOrder) {
    this.orders.push(order);
    this.updateMetrics(order);
  }

  private updateMetrics(order: RemittanceOrder) {
    const amount = parseFloat(order.quote.fromAmount);
    
    // Update totals
    this.metrics.totalVolume += amount;
    this.metrics.totalTransactions++;
    
    // Update corridor volumes
    const corridorKey = `${order.quote.fromChain}-${order.quote.toCountry}`;
    const currentCorridorVolume = this.metrics.corridorVolumes.get(corridorKey) || 0;
    this.metrics.corridorVolumes.set(corridorKey, currentCorridorVolume + amount);
    
    // Update chain volumes
    const currentChainVolume = this.metrics.chainVolumes.get(order.quote.fromChain) || 0;
    this.metrics.chainVolumes.set(order.quote.fromChain, currentChainVolume + amount);
    
    // Update hourly volume
    const hour = new Date().getHours();
    this.metrics.hourlyVolumes[hour] += amount;
    
    // Update success rate
    const completedOrders = this.orders.filter(o => o.status === 'completed').length;
    this.metrics.successRate = (completedOrders / this.metrics.totalTransactions) * 100;
    
    // Update average transaction size
    this.metrics.averageTransactionSize = this.metrics.totalVolume / this.metrics.totalTransactions;
    
    // Track failures
    if (order.status === 'failed') {
      const reason = 'Unknown'; // In production, extract from error
      const currentCount = this.metrics.failureReasons.get(reason) || 0;
      this.metrics.failureReasons.set(reason, currentCount + 1);
    }
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  getCorridorStats(): Array<{
    corridor: string;
    volume: number;
    percentage: number;
  }> {
    const stats = Array.from(this.metrics.corridorVolumes.entries())
      .map(([corridor, volume]) => ({
        corridor,
        volume,
        percentage: (volume / this.metrics.totalVolume) * 100
      }))
      .sort((a, b) => b.volume - a.volume);
    
    return stats;
  }

  getChainStats(): Array<{
    chain: string;
    volume: number;
    transactions: number;
  }> {
    const chainTxCounts = new Map<string, number>();
    
    this.orders.forEach(order => {
      const count = chainTxCounts.get(order.quote.fromChain) || 0;
      chainTxCounts.set(order.quote.fromChain, count + 1);
    });
    
    return Array.from(this.metrics.chainVolumes.entries())
      .map(([chain, volume]) => ({
        chain,
        volume,
        transactions: chainTxCounts.get(chain) || 0
      }))
      .sort((a, b) => b.volume - a.volume);
  }

  getHourlyVolumes(): number[] {
    return [...this.metrics.hourlyVolumes];
  }

  getRecentOrders(limit: number = 10): RemittanceOrder[] {
    return this.orders
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  exportMetrics(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
      corridorStats: this.getCorridorStats(),
      chainStats: this.getChainStats(),
      hourlyVolumes: this.getHourlyVolumes()
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  // Prometheus-compatible metrics export
  getPrometheusMetrics(): string {
    const lines = [
      `# HELP remitdex_total_volume Total volume processed in USD`,
      `# TYPE remitdex_total_volume counter`,
      `remitdex_total_volume ${this.metrics.totalVolume}`,
      
      `# HELP remitdex_total_transactions Total number of transactions`,
      `# TYPE remitdex_total_transactions counter`,
      `remitdex_total_transactions ${this.metrics.totalTransactions}`,
      
      `# HELP remitdex_success_rate Success rate percentage`,
      `# TYPE remitdex_success_rate gauge`,
      `remitdex_success_rate ${this.metrics.successRate}`,
      
      `# HELP remitdex_average_transaction Average transaction size in USD`,
      `# TYPE remitdex_average_transaction gauge`,
      `remitdex_average_transaction ${this.metrics.averageTransactionSize}`,
    ];
    
    // Add corridor metrics
    this.metrics.corridorVolumes.forEach((volume, corridor) => {
      lines.push(`remitdex_corridor_volume{corridor="${corridor}"} ${volume}`);
    });
    
    // Add chain metrics
    this.metrics.chainVolumes.forEach((volume, chain) => {
      lines.push(`remitdex_chain_volume{chain="${chain}"} ${volume}`);
    });
    
    return lines.join('\n');
  }
}