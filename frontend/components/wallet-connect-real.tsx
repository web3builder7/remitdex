'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Wallet, LogOut, Copy, ExternalLink, ChevronDown } from 'lucide-react';
import { FREIGHTER_ID, XBULL_ID, ALBEDO_ID, RABET_ID } from '@creit.tech/stellar-wallets-kit';
import { useStellarWallet } from '@/components/providers/stellar-wallet-provider';

interface WalletInfo {
  address: string;
  chain: string;
  type: 'evm' | 'solana' | 'stellar' | 'cosmos' | 'near';
}

export function WalletConnectReal() {
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { 
    publicKey: stellarPublicKey, 
    isConnected: isStellarConnected,
    connect: connectStellar,
    disconnect: disconnectStellar 
  } = useStellarWallet();
  
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Check wallet connections
  useEffect(() => {
    if (isEvmConnected && evmAddress) {
      setWalletInfo({
        address: evmAddress,
        chain: getChainName(chainId),
        type: 'evm'
      });
    } else if (isStellarConnected && stellarPublicKey) {
      setWalletInfo({
        address: stellarPublicKey,
        chain: 'stellar',
        type: 'stellar'
      });
    }
  }, [isEvmConnected, evmAddress, chainId, isStellarConnected, stellarPublicKey]);

  const getChainName = (id: number) => {
    const chains: Record<number, string> = {
      1: 'ethereum',
      137: 'polygon',
      56: 'bsc',
      42161: 'arbitrum',
      10: 'optimism',
      43114: 'avalanche'
    };
    return chains[id] || 'unknown';
  };

  const connectMetaMask = async () => {
    const metamask = connectors.find(c => c.id === 'injected');
    if (metamask) {
      connect({ connector: metamask });
    }
  };

  const connectWalletConnect = async () => {
    const wc = connectors.find(c => c.id === 'walletConnect');
    if (wc) {
      connect({ connector: wc });
    }
  };

  const connectPhantom = async () => {
    if ('solana' in window) {
      try {
        const provider = (window as any).solana;
        const resp = await provider.connect();
        const address = resp.publicKey.toString();
        setWalletInfo({
          address,
          chain: 'solana',
          type: 'solana'
        });
        localStorage.setItem('solanaWallet', address);
      } catch (err) {
        console.error('Failed to connect Phantom:', err);
      }
    } else {
      window.open('https://phantom.app/', '_blank');
    }
  };

  const connectStellarWallet = async (walletId: string) => {
    try {
      await connectStellar(walletId);
      setIsDropdownOpen(false);
    } catch (err) {
      console.error('Failed to connect Stellar wallet:', err);
      if (err instanceof Error && err.message.includes('not installed')) {
        const walletUrls: Record<string, string> = {
          [FREIGHTER_ID]: 'https://www.freighter.app/',
          [XBULL_ID]: 'https://xbull.app',
          [ALBEDO_ID]: 'https://albedo.link/',
          [RABET_ID]: 'https://rabet.io/'
        };
        window.open(walletUrls[walletId], '_blank');
      }
    }
  };

  const connectKeplr = async () => {
    if ('keplr' in window) {
      try {
        await (window as any).keplr.enable('cosmoshub-4');
        const key = await (window as any).keplr.getKey('cosmoshub-4');
        const address = key.bech32Address;
        setWalletInfo({
          address,
          chain: 'cosmos',
          type: 'cosmos'
        });
        localStorage.setItem('cosmosWallet', address);
      } catch (err) {
        console.error('Failed to connect Keplr:', err);
      }
    } else {
      window.open('https://www.keplr.app/', '_blank');
    }
  };

  const connectNear = async () => {
    // NEAR wallet requires a redirect flow
    window.open('https://wallet.near.org/', '_blank');
  };

  const handleDisconnect = () => {
    if (walletInfo?.type === 'evm') {
      disconnect();
    } else if (walletInfo?.type === 'solana' && 'solana' in window) {
      (window as any).solana.disconnect();
      localStorage.removeItem('solanaWallet');
    } else if (walletInfo?.type === 'stellar') {
      disconnectStellar();
    } else if (walletInfo?.type === 'cosmos') {
      localStorage.removeItem('cosmosWallet');
    }
    setWalletInfo(null);
  };

  const copyAddress = () => {
    if (walletInfo?.address) {
      navigator.clipboard.writeText(walletInfo.address);
    }
  };

  const formatAddress = (address: string) => {
    if (address.length > 20) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return address;
  };

  const getExplorerUrl = () => {
    if (!walletInfo) return '#';
    
    const explorers: Record<string, string> = {
      ethereum: `https://etherscan.io/address/${walletInfo.address}`,
      polygon: `https://polygonscan.com/address/${walletInfo.address}`,
      bsc: `https://bscscan.com/address/${walletInfo.address}`,
      arbitrum: `https://arbiscan.io/address/${walletInfo.address}`,
      optimism: `https://optimistic.etherscan.io/address/${walletInfo.address}`,
      avalanche: `https://snowtrace.io/address/${walletInfo.address}`,
      solana: `https://explorer.solana.com/address/${walletInfo.address}`,
      stellar: `https://stellar.expert/explorer/public/account/${walletInfo.address}`,
      cosmos: `https://www.mintscan.io/cosmos/account/${walletInfo.address}`,
    };
    
    return explorers[walletInfo.chain] || '#';
  };

  if (walletInfo) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            {formatAddress(walletInfo.address)}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            Connected to {walletInfo.chain}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copyAddress}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open(getExplorerUrl(), '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            View on Explorer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDisconnect} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="default">
          Connect Wallet
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Select Wallet</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={connectMetaMask}>
          <Wallet className="mr-2 h-4 w-4" />
          MetaMask
        </DropdownMenuItem>
        <DropdownMenuItem onClick={connectWalletConnect}>
          <Wallet className="mr-2 h-4 w-4" />
          WalletConnect
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={connectPhantom}>
          <Wallet className="mr-2 h-4 w-4" />
          Phantom (Solana)
        </DropdownMenuItem>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Stellar Wallets</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => connectStellarWallet(FREIGHTER_ID)}>
          <Wallet className="mr-2 h-4 w-4" />
          Freighter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => connectStellarWallet(XBULL_ID)}>
          <Wallet className="mr-2 h-4 w-4" />
          xBull
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => connectStellarWallet(ALBEDO_ID)}>
          <Wallet className="mr-2 h-4 w-4" />
          Albedo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => connectStellarWallet(RABET_ID)}>
          <Wallet className="mr-2 h-4 w-4" />
          Rabet
        </DropdownMenuItem>
        <DropdownMenuItem onClick={connectKeplr}>
          <Wallet className="mr-2 h-4 w-4" />
          Keplr (Cosmos)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={connectNear}>
          <Wallet className="mr-2 h-4 w-4" />
          NEAR Wallet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}