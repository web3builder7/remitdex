'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from '@/lib/wagmi-config'
import { StellarWalletProvider } from './stellar-wallet-provider'

const queryClient = new QueryClient()

export function MultiChainWalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <StellarWalletProvider>
          {children}
        </StellarWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}