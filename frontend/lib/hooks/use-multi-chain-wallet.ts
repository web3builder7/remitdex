import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useStellarWallet } from '@/components/providers/stellar-wallet-provider'
import { useState, useEffect } from 'react'

export type ChainType = 'evm' | 'stellar' | 'solana' | 'cosmos' | 'near'

interface MultiChainWallet {
  address: string | null
  chainType: ChainType | null
  isConnected: boolean
  connect: (type: ChainType, options?: any) => Promise<void>
  disconnect: () => Promise<void>
  signMessage?: (message: string) => Promise<string>
  signTransaction?: (transaction: any) => Promise<any>
}

export function useMultiChainWallet(): MultiChainWallet {
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount()
  const { disconnect: disconnectEvm } = useDisconnect()
  const { 
    publicKey: stellarPublicKey, 
    isConnected: isStellarConnected,
    disconnect: disconnectStellar,
    signTransaction: signStellarTransaction
  } = useStellarWallet()

  const [currentChainType, setCurrentChainType] = useState<ChainType | null>(null)

  useEffect(() => {
    if (isEvmConnected) {
      setCurrentChainType('evm')
    } else if (isStellarConnected) {
      setCurrentChainType('stellar')
    } else {
      setCurrentChainType(null)
    }
  }, [isEvmConnected, isStellarConnected])

  const address = evmAddress || stellarPublicKey || null
  const isConnected = isEvmConnected || isStellarConnected

  const connect = async (type: ChainType, options?: any) => {
    // Disconnect from other chains first
    await disconnect()

    switch (type) {
      case 'evm':
        // EVM connection is handled by the UI components
        break
      case 'stellar':
        // Stellar connection is handled by the UI components
        break
      case 'solana':
        // Implement Solana connection
        break
      case 'cosmos':
        // Implement Cosmos connection
        break
      case 'near':
        // Implement NEAR connection
        break
    }
  }

  const disconnect = async () => {
    if (isEvmConnected) {
      disconnectEvm()
    }
    if (isStellarConnected) {
      await disconnectStellar()
    }
    // Add other chain disconnections as needed
    setCurrentChainType(null)
  }

  const signTransaction = async (transaction: any) => {
    if (currentChainType === 'stellar' && signStellarTransaction) {
      return await signStellarTransaction(transaction)
    }
    // Add other chain transaction signing
    throw new Error('Transaction signing not available for current chain')
  }

  return {
    address,
    chainType: currentChainType,
    isConnected,
    connect,
    disconnect,
    signTransaction
  }
}