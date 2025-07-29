'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, CheckCircle, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { remittanceAPI, RemittanceOrder } from '@/lib/api';

const STATUS_ICONS = {
  pending: <Clock className="h-5 w-5 text-yellow-500" />,
  processing: <Clock className="h-5 w-5 text-blue-500" />,
  completed: <CheckCircle className="h-5 w-5 text-green-500" />,
  failed: <AlertCircle className="h-5 w-5 text-red-500" />,
};

const STATUS_LABELS = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

export default function TrackPage() {
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<RemittanceOrder | null>(null);

  const handleTrack = async () => {
    if (!orderId.trim()) {
      setError('Please enter an order ID');
      return;
    }

    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const orderData = await remittanceAPI.getOrderStatus(orderId);
      if (!orderData) {
        setError('Order not found. Please check your order ID and try again.');
      } else {
        setOrder(orderData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch order status');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Track Transfer</h1>
        <p className="mt-2 text-muted-foreground">
          Enter your order ID to track your remittance status
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Track Your Order</CardTitle>
          <CardDescription>
            You can find your order ID in the confirmation email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="orderId" className="sr-only">
                Order ID
              </Label>
              <Input
                id="orderId"
                placeholder="Enter order ID (e.g., RMT-1234567890-abc123)"
                value={orderId}
                onChange={(e) => {
                  setOrderId(e.target.value);
                  setError(null);
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleTrack()}
              />
            </div>
            <Button onClick={handleTrack} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              Track
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {order && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Order Status
              {STATUS_ICONS[order.status]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Status Overview */}
              <div className="rounded-lg bg-muted p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-lg font-semibold">
                    {STATUS_LABELS[order.status]}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Order ID: {order.id}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Created: {formatDate(order.createdAt)}
                  {order.completedAt && (
                    <> • Completed: {formatDate(order.completedAt)}</>
                  )}
                </div>
              </div>

              {/* Transfer Details */}
              <div>
                <h3 className="mb-3 font-semibold">Transfer Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">From</span>
                    <span className="text-sm font-medium">
                      {order.sender.chain} • {order.sender.address.slice(0, 6)}...{order.sender.address.slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Amount Sent</span>
                    <span className="text-sm font-medium">
                      ${order.quote.fromAmount} {order.quote.fromToken}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">To</span>
                    <span className="text-sm font-medium">
                      {order.recipient.country} • {order.recipient.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Amount Received</span>
                    <span className="text-sm font-medium">
                      {order.quote.toAmount} {order.quote.toCurrency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction IDs */}
              {(order.htlcId || order.stellarTxHash || order.anchorTxId) && (
                <div>
                  <h3 className="mb-3 font-semibold">Transaction Details</h3>
                  <div className="space-y-2 text-sm">
                    {order.htlcId && (
                      <div>
                        <span className="text-muted-foreground">HTLC ID: </span>
                        <span className="font-mono">{order.htlcId}</span>
                      </div>
                    )}
                    {order.stellarTxHash && (
                      <div>
                        <span className="text-muted-foreground">Stellar TX: </span>
                        <span className="font-mono">{order.stellarTxHash}</span>
                      </div>
                    )}
                    {order.anchorTxId && (
                      <div>
                        <span className="text-muted-foreground">Anchor TX: </span>
                        <span className="font-mono">{order.anchorTxId}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Transfer Route */}
              <div>
                <h3 className="mb-3 font-semibold">Transfer Route</h3>
                <div className="space-y-2">
                  {order.quote.route.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {step.type === 'swap' && 'Token Swap'}
                          {step.type === 'bridge' && 'Cross-chain Bridge'}
                          {step.type === 'anchor' && 'Local Delivery'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {step.protocol} • {step.estimatedTime} min
                        </div>
                      </div>
                      {index < order.quote.route.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Message */}
              {order.status === 'completed' && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your transfer has been completed successfully. The recipient has received {order.quote.toAmount} {order.quote.toCurrency}.
                  </AlertDescription>
                </Alert>
              )}
              
              {order.status === 'processing' && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Your transfer is being processed. This usually takes {order.quote.estimatedTime} minutes.
                  </AlertDescription>
                </Alert>
              )}
              
              {order.status === 'failed' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your transfer has failed. Please contact support with your order ID for assistance.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}