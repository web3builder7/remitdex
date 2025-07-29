'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { remittanceAPI, Corridor } from '@/lib/api';
import Link from 'next/link';

const EXCHANGE_RATES = {
  PHP: { rate: 56.50, trend: 'up', change: 0.5 },
  NGN: { rate: 1520.00, trend: 'down', change: -2.3 },
  ARS: { rate: 850.00, trend: 'up', change: 1.2 },
  EUR: { rate: 0.92, trend: 'down', change: -0.1 },
  GBP: { rate: 0.79, trend: 'up', change: 0.3 },
  INR: { rate: 83.12, trend: 'up', change: 0.8 },
};

export default function RatesPage() {
  const [loading, setLoading] = useState(true);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    loadCorridors();
  }, []);

  const loadCorridors = async () => {
    setLoading(true);
    try {
      const data = await remittanceAPI.getSupportedCorridors();
      setCorridors(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load corridors:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Exchange Rates</h1>
          <p className="mt-2 text-muted-foreground">
            Live exchange rates and supported corridors
          </p>
        </div>
        <Button onClick={loadCorridors} variant="outline" size="sm">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Exchange Rates Grid */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Current Rates</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(EXCHANGE_RATES).map(([currency, data]) => (
            <Card key={currency}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">USD/{currency}</CardTitle>
                  {data.trend === 'up' ? (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.rate.toFixed(2)}</div>
                <div className={`text-sm ${data.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                  {data.trend === 'up' ? '+' : ''}{data.change}%
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {formatTime(lastUpdated)}
        </p>
      </div>

      {/* Supported Corridors */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Supported Corridors</h2>
        {loading ? (
          <Card>
            <CardContent className="py-8 text-center">
              <RefreshCw className="mx-auto mb-2 h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading corridors...</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {corridors.map((corridor, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {corridor.from} → {corridor.to}
                  </CardTitle>
                  <CardDescription>
                    Available currencies: {corridor.currencies.join(', ')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Delivery Methods</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {corridor.methods.map((method) => (
                          <span
                            key={method}
                            className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                          >
                            {method.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        <span className="font-medium">Delivery Time:</span> {corridor.estimatedTime}
                      </span>
                      <span>
                        <span className="font-medium">Max:</span> ${corridor.maxAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Link href="/send">
                    <Button className="mt-4 w-full" variant="outline">
                      Send Money
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Fee Information */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Our Fees</CardTitle>
          <CardDescription>
            Transparent pricing with no hidden charges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Platform Fee</span>
              <span className="font-semibold">0.3%</span>
            </div>
            <div className="flex justify-between">
              <span>1inch Aggregation Fee</span>
              <span className="font-semibold">0.3%</span>
            </div>
            <div className="flex justify-between">
              <span>Bridge Fee</span>
              <span className="font-semibold">0.1%</span>
            </div>
            <div className="flex justify-between">
              <span>Anchor Fee</span>
              <span className="font-semibold">0.2-0.5%</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">Total Fees</span>
              <span className="font-semibold text-primary">0.9-1.2%</span>
            </div>
          </div>
          <Alert className="mt-4">
            <AlertDescription>
              Compare with traditional remittance services that charge 7-10% in fees!
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}