'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Wallet, LogOut, Copy, ExternalLink } from 'lucide-react';

// Mock wallet connection for demonstration
// In production, you would use actual wallet libraries like:
// - @web3-react/core for EVM chains
// - @solana/wallet-adapter-react for Solana
// - @stellar/freighter-api for Stellar
// - near-api-js for NEAR

interface WalletInfo {
  address: string;
  chain: string;
  balance?: string;
}

export function WalletConnect() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);

  // Check if wallet is already connected
  useEffect(() => {
    const savedWallet = localStorage.getItem('connectedWallet');
    if (savedWallet) {
      setWalletInfo(JSON.parse(savedWallet));
      setConnected(true);
    }
  }, []);

  const connectWallet = async (walletType: string) => {
    setConnecting(true);
    
    try {
      // Simulate wallet connection
      // In production, this would be actual wallet connection logic
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockWallet: WalletInfo = {
        address: '0x' + Math.random().toString(16).substr(2, 40),
        chain: 'ethereum',
        balance: '100.00'
      };
      
      setWalletInfo(mockWallet);
      setConnected(true);
      localStorage.setItem('connectedWallet', JSON.stringify(mockWallet));
      
      // Trigger a custom event that other components can listen to
      window.dispatchEvent(new CustomEvent('walletConnected', { detail: mockWallet }));
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setConnected(false);
    setWalletInfo(null);
    localStorage.removeItem('connectedWallet');
    window.dispatchEvent(new CustomEvent('walletDisconnected'));
  };

  const copyAddress = () => {
    if (walletInfo?.address) {
      navigator.clipboard.writeText(walletInfo.address);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (connected && walletInfo) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            {formatAddress(walletInfo.address)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Connected Wallet</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copyAddress}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem>
            <ExternalLink className="mr-2 h-4 w-4" />
            View on Explorer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={disconnectWallet} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" disabled={connecting}>
          {connecting ? 'Connecting...' : 'Connect Wallet'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Select Wallet</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => connectWallet('metamask')}>
          <img src="/metamask.svg" alt="MetaMask" className="mr-2 h-4 w-4" />
          MetaMask
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => connectWallet('walletconnect')}>
          <img src="/walletconnect.svg" alt="WalletConnect" className="mr-2 h-4 w-4" />
          WalletConnect
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => connectWallet('phantom')}>
          <img src="/phantom.svg" alt="Phantom" className="mr-2 h-4 w-4" />
          Phantom (Solana)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => connectWallet('freighter')}>
          <img src="/freighter.svg" alt="Freighter" className="mr-2 h-4 w-4" />
          Freighter (Stellar)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => connectWallet('keplr')}>
          <img src="/keplr.svg" alt="Keplr" className="mr-2 h-4 w-4" />
          Keplr (Cosmos)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => connectWallet('near')}>
          <img src="/near.svg" alt="NEAR" className="mr-2 h-4 w-4" />
          NEAR Wallet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}