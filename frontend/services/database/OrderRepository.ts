import { RemittanceOrder } from '../../interfaces/IRemittance';

export class OrderRepository {
  private orders: Map<string, RemittanceOrder> = new Map();
  private ordersByUser: Map<string, string[]> = new Map();

  async save(order: RemittanceOrder): Promise<void> {
    this.orders.set(order.id, order);
    
    // Track orders by user
    const userKey = order.sender.address;
    const userOrders = this.ordersByUser.get(userKey) || [];
    userOrders.push(order.id);
    this.ordersByUser.set(userKey, userOrders);
  }

  async findById(id: string): Promise<RemittanceOrder | null> {
    return this.orders.get(id) || null;
  }

  async findByUser(userAddress: string): Promise<RemittanceOrder[]> {
    const orderIds = this.ordersByUser.get(userAddress) || [];
    return orderIds
      .map(id => this.orders.get(id))
      .filter(order => order !== undefined) as RemittanceOrder[];
  }

  async updateStatus(
    orderId: string, 
    status: RemittanceOrder['status'],
    additionalData?: Partial<RemittanceOrder>
  ): Promise<void> {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = status;
      if (additionalData) {
        Object.assign(order, additionalData);
      }
      this.orders.set(orderId, order);
    }
  }

  async getStats(): Promise<{
    totalOrders: number;
    completedOrders: number;
    failedOrders: number;
    totalVolume: number;
    averageAmount: number;
  }> {
    const ordersArray = Array.from(this.orders.values());
    
    const stats = {
      totalOrders: ordersArray.length,
      completedOrders: ordersArray.filter(o => o.status === 'completed').length,
      failedOrders: ordersArray.filter(o => o.status === 'failed').length,
      totalVolume: 0,
      averageAmount: 0
    };

    if (ordersArray.length > 0) {
      stats.totalVolume = ordersArray.reduce((sum, order) => 
        sum + parseFloat(order.quote.fromAmount), 0
      );
      stats.averageAmount = stats.totalVolume / ordersArray.length;
    }

    return stats;
  }

  async getRecentOrders(limit: number = 10): Promise<RemittanceOrder[]> {
    const ordersArray = Array.from(this.orders.values());
    return ordersArray
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}