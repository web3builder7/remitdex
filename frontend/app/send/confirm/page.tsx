'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { remittanceAPI, RemittanceQuote } from '@/lib/api';

interface RecipientDetails {
  name: string;
  email: string;
  phoneNumber: string;
  accountNumber?: string;
  bankName?: string;
  swiftCode?: string;
  routingNumber?: string;
  accountName?: string;
  provider?: string;
}

export default function ConfirmPage() {
  const router = useRouter();
  const { address: evmAddress, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  const [quote, setQuote] = useState<RemittanceQuote | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [recipientDetails, setRecipientDetails] = useState<RecipientDetails>({
    name: '',
    email: '',
    phoneNumber: '',
  });

  useEffect(() => {
    // Retrieve quote and form data from sessionStorage
    const storedQuote = sessionStorage.getItem('currentQuote');
    const storedFormData = sessionStorage.getItem('formData');
    
    if (!storedQuote || !storedFormData) {
      router.push('/send');
      return;
    }
    
    setQuote(JSON.parse(storedQuote));
    setFormData(JSON.parse(storedFormData));
  }, [router]);

  const handleInputChange = (field: keyof RecipientDetails, value: string) => {
    setRecipientDetails(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!quote || !formData) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let senderAddress: string | undefined;
      
      // Check for EVM wallet connection
      if (isConnected && evmAddress) {
        senderAddress = evmAddress;
      } else {
        // Check for other wallet types
        const stellarKey = localStorage.getItem('stellarWallet');
        const solanaKey = localStorage.getItem('solanaWallet');
        const cosmosKey = localStorage.getItem('cosmosWallet');
        
        if (stellarKey) {
          senderAddress = stellarKey;
        } else if (solanaKey) {
          senderAddress = solanaKey;
        } else if (cosmosKey) {
          senderAddress = cosmosKey;
        }
      }
      
      if (!senderAddress) {
        setError('Please connect your wallet first');
        return;
      }
      
      const order = await remittanceAPI.executeRemittance(
        quote,
        senderAddress,
        recipientDetails
      );
      
      setOrderId(order.id);
      setSuccess(true);
      
      // Clear session storage
      sessionStorage.removeItem('currentQuote');
      sessionStorage.removeItem('formData');
    } catch (err: any) {
      setError(err.message || 'Failed to process remittance');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    if (!recipientDetails.name || !recipientDetails.email || !recipientDetails.phoneNumber) {
      return false;
    }
    
    // Additional validation based on delivery method
    if (formData?.deliveryMethod === 'bank_transfer') {
      return !!(recipientDetails.accountNumber && recipientDetails.bankName);
    }
    
    if (formData?.deliveryMethod === 'gcash' || formData?.deliveryMethod === 'paymaya') {
      return !!recipientDetails.accountName;
    }
    
    if (formData?.deliveryMethod === 'mobile_money') {
      return !!recipientDetails.provider;
    }
    
    return true;
  };

  if (!quote || !formData) {
    return null;
  }

  if (success && orderId) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
              <h2 className="mb-2 text-2xl font-bold">Remittance Initiated!</h2>
              <p className="mb-6 text-muted-foreground">
                Your transfer has been successfully initiated
              </p>
              
              <div className="mb-6 rounded-lg bg-muted p-4">
                <p className="mb-2 text-sm text-muted-foreground">Order ID</p>
                <p className="font-mono text-lg font-semibold">{orderId}</p>
              </div>
              
              <p className="mb-6 text-sm text-muted-foreground">
                You will receive email updates about your transfer status.
                The recipient will be notified once the funds are available.
              </p>
              
              <div className="flex gap-4 justify-center">
                <Button variant="outline" onClick={() => router.push('/track')}>
                  Track Transfer
                </Button>
                <Button onClick={() => router.push('/send')}>
                  Send Another
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => router.push('/send')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Quote
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Confirm Transfer</h1>
        <p className="mt-2 text-muted-foreground">
          Enter recipient details to complete the transfer
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recipient Details Form */}
        <Card>
          <CardHeader>
            <CardTitle>Recipient Details</CardTitle>
            <CardDescription>
              Who should receive the money?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Details */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={recipientDetails.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@example.com"
                value={recipientDetails.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                placeholder="+1234567890"
                value={recipientDetails.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
              />
            </div>

            {/* Bank Transfer Details */}
            {formData.deliveryMethod === 'bank_transfer' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    placeholder="1234567890"
                    value={recipientDetails.accountNumber || ''}
                    onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    placeholder="Bank of Example"
                    value={recipientDetails.bankName || ''}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="swiftCode">SWIFT Code (Optional)</Label>
                  <Input
                    id="swiftCode"
                    placeholder="EXMPUS33"
                    value={recipientDetails.swiftCode || ''}
                    onChange={(e) => handleInputChange('swiftCode', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* E-Wallet Details */}
            {(formData.deliveryMethod === 'gcash' || formData.deliveryMethod === 'paymaya') && (
              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  placeholder="Account holder name"
                  value={recipientDetails.accountName || ''}
                  onChange={(e) => handleInputChange('accountName', e.target.value)}
                />
              </div>
            )}

            {/* Mobile Money Details */}
            {formData.deliveryMethod === 'mobile_money' && (
              <div className="space-y-2">
                <Label htmlFor="provider">Mobile Money Provider</Label>
                <Input
                  id="provider"
                  placeholder="MTN, Airtel, etc."
                  value={recipientDetails.provider || ''}
                  onChange={(e) => handleInputChange('provider', e.target.value)}
                />
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Transfer Summary */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Transfer Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">From</span>
                    <span className="font-semibold">{formData.fromChain}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="font-semibold">${quote.fromAmount} {quote.fromToken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">To</span>
                    <span className="font-semibold">{quote.toCountry}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Delivery</span>
                    <span className="font-semibold">{formData.deliveryMethod.replace('_', ' ')}</span>
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

              <Alert>
                <AlertDescription>
                  By clicking confirm, you authorize the transfer of ${quote.fromAmount} {quote.fromToken} from your wallet.
                  The recipient will receive {quote.toAmount} {quote.toCurrency} via {formData.deliveryMethod.replace('_', ' ')}.
                </AlertDescription>
              </Alert>

              <Button 
                className="w-full" 
                size="lg"
                onClick={handleSubmit}
                disabled={!isFormValid() || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm & Send'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}