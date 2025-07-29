'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Loader2 } from 'lucide-react';
import { remittanceAPI, RemittanceQuote } from '@/lib/api';

const SUPPORTED_CHAINS = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'bsc', label: 'Binance Smart Chain' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'arbitrum', label: 'Arbitrum' },
];

const SUPPORTED_TOKENS = [
  { value: 'USDC', label: 'USDC' },
  { value: 'USDT', label: 'USDT' },
  { value: 'DAI', label: 'DAI' },
];

const SUPPORTED_COUNTRIES = [
  { value: 'Philippines', label: 'Philippines', code: 'PH', currency: 'PHP' },
  { value: 'Nigeria', label: 'Nigeria', code: 'NG', currency: 'NGN' },
  { value: 'Argentina', label: 'Argentina', code: 'AR', currency: 'ARS' },
];

const DELIVERY_METHODS = {
  PH: [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'gcash', label: 'GCash' },
    { value: 'paymaya', label: 'PayMaya' },
  ],
  NG: [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'mobile_money', label: 'Mobile Money' },
  ],
  AR: [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'mobile_wallet', label: 'Mobile Wallet' },
  ],
};

export default function SendMoneyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<RemittanceQuote | null>(null);
  
  const [formData, setFormData] = useState({
    fromChain: '',
    fromToken: '',
    amount: '',
    toCountry: '',
    deliveryMethod: '',
  });

  const selectedCountry = SUPPORTED_COUNTRIES.find(c => c.value === formData.toCountry);
  const availableDeliveryMethods = selectedCountry ? DELIVERY_METHODS[selectedCountry.code as keyof typeof DELIVERY_METHODS] : [];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleGetQuote = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const quoteData = await remittanceAPI.getQuote({
        fromChain: formData.fromChain,
        fromToken: formData.fromToken,
        fromAmount: formData.amount,
        toCountry: formData.toCountry,
        toCurrency: selectedCountry?.currency || '',
        deliveryMethod: formData.deliveryMethod,
      });

      console.log(quoteData,"quotedata");
      
      setQuote(quoteData);
    } catch (err: any) {
      setError(err.message || 'Failed to get quote');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSend = () => {
    if (quote) {
      // Store quote in sessionStorage for the next page
      sessionStorage.setItem('currentQuote', JSON.stringify(quote));
      sessionStorage.setItem('formData', JSON.stringify(formData));
      router.push('/send/confirm');
    }
  };

  const isFormValid = 
    formData.fromChain && 
    formData.fromToken && 
    formData.amount && 
    Number(formData.amount) >= 10 &&
    formData.toCountry && 
    formData.deliveryMethod;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Send Money</h1>
        <p className="mt-2 text-muted-foreground">
          Send money to your loved ones with the best rates and lowest fees
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle>Transfer Details</CardTitle>
            <CardDescription>
              Fill in the details below to get an instant quote
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* From Chain */}
            <div className="space-y-2">
              <Label htmlFor="fromChain">From Chain</Label>
              <Select value={formData.fromChain} onValueChange={(value) => handleInputChange('fromChain', value)}>
                <SelectTrigger id="fromChain">
                  <SelectValue placeholder="Select blockchain" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CHAINS.map(chain => (
                    <SelectItem key={chain.value} value={chain.value}>
                      {chain.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Token */}
            <div className="space-y-2">
              <Label htmlFor="fromToken">Token</Label>
              <Select value={formData.fromToken} onValueChange={(value) => handleInputChange('fromToken', value)}>
                <SelectTrigger id="fromToken">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_TOKENS.map(token => (
                    <SelectItem key={token.value} value={token.value}>
                      {token.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="100"
                min="10"
                max="10000"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">Minimum: $10, Maximum: $10,000</p>
            </div>

            {/* To Country */}
            <div className="space-y-2">
              <Label htmlFor="toCountry">To Country</Label>
              <Select value={formData.toCountry} onValueChange={(value) => {
                handleInputChange('toCountry', value);
                handleInputChange('deliveryMethod', ''); // Reset delivery method
              }}>
                <SelectTrigger id="toCountry">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_COUNTRIES.map(country => (
                    <SelectItem key={country.value} value={country.value}>
                      {country.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Delivery Method */}
            {formData.toCountry && (
              <div className="space-y-2">
                <Label htmlFor="deliveryMethod">Delivery Method</Label>
                <Select value={formData.deliveryMethod} onValueChange={(value) => handleInputChange('deliveryMethod', value)}>
                  <SelectTrigger id="deliveryMethod">
                    <SelectValue placeholder="Select delivery method" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDeliveryMethods.map(method => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              className="w-full" 
              size="lg"
              onClick={handleGetQuote}
              disabled={!isFormValid || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Quote...
                </>
              ) : (
                <>
                  Get Quote
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Quote Section */}
        {quote && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Quote Details</CardTitle>
              <CardDescription>
                Review your transfer details before proceeding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">You Send</span>
                      <span className="font-semibold">${quote.fromAmount} {quote.fromToken}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Exchange Rate</span>
                      <span className="font-semibold">1 USD = {quote.exchangeRate} {quote.toCurrency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Fees</span>
                      <span className="font-semibold">{quote.totalFees}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Delivery Time</span>
                      <span className="font-semibold">{quote.estimatedTime} minutes</span>
                    </div>
                    <div className="my-2 border-t pt-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-semibold">Recipient Gets</span>
                        <span className="text-lg font-bold text-primary">
                          {quote.toAmount} {quote.toCurrency}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Transfer Route</h4>
                  {quote.route.map((step, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                        {index + 1}
                      </div>
                      <span className="flex-1">
                        {step.type === 'swap' && 'Swap via 1inch'}
                        {step.type === 'bridge' && 'Bridge to Stellar'}
                        {step.type === 'anchor' && `Deliver via ${step.protocol}`}
                      </span>
                      <span className="text-muted-foreground">{step.fees}% fee</span>
                    </div>
                  ))}
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleConfirmSend}
                >
                  Continue to Recipient Details
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}