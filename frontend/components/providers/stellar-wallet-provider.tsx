'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { 
  StellarWalletsKit, 
  WalletNetwork, 
  ISupportedWallet,
  FREIGHTER_ID,
  XBULL_ID,
  ALBEDO_ID,
  RABET_ID,
  FreighterModule,
  xBullModule,
  AlbedoModule,
  RabetModule
} from '@creit.tech/stellar-wallets-kit'

interface StellarWalletContextType {
  stellarKit: StellarWalletsKit | null
  isConnected: boolean
  publicKey: string | null
  connect: (walletId: string) => Promise<void>
  disconnect: () => Promise<void>
  signTransaction: (xdr: string) => Promise<string>
}

const StellarWalletContext = createContext<StellarWalletContextType | undefined>(undefined)

export function StellarWalletProvider({ children }: { children: React.ReactNode }) {
  const [stellarKit, setStellarKit] = useState<StellarWalletsKit | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)

  useEffect(() => {
    const kit = new StellarWalletsKit({
      network: WalletNetwork.PUBLIC,
      selectedWalletId: FREIGHTER_ID,
      modules: [
        new FreighterModule(),
        new xBullModule(),
        new AlbedoModule(),
        new RabetModule()
      ]
    })
    setStellarKit(kit)

    const savedWallet = localStorage.getItem('stellarWalletPublicKey')
    const savedWalletId = localStorage.getItem('stellarWalletId')
    if (savedWallet && savedWalletId) {
      kit.setWallet(savedWalletId)
      setPublicKey(savedWallet)
      setIsConnected(true)
    }
  }, [])

  const connect = async (walletId: string) => {
    if (!stellarKit) return

    try {
      await stellarKit.setWallet(walletId)
      const { address } = await stellarKit.getAddress()
      
      setPublicKey(address)
      setIsConnected(true)
      localStorage.setItem('stellarWalletPublicKey', address)
      localStorage.setItem('stellarWalletId', walletId)
      
      window.dispatchEvent(new CustomEvent('stellarWalletConnected', { 
        detail: { publicKey: address, walletId } 
      }))
    } catch (error) {
      console.error('Failed to connect Stellar wallet:', error)
      throw error
    }
  }

  const disconnect = async () => {
    setIsConnected(false)
    setPublicKey(null)
    localStorage.removeItem('stellarWalletPublicKey')
    localStorage.removeItem('stellarWalletId')
    
    window.dispatchEvent(new CustomEvent('stellarWalletDisconnected'))
  }

  const signTransaction = async (xdr: string): Promise<string> => {
    if (!stellarKit || !isConnected || !publicKey) {
      throw new Error('Wallet not connected')
    }

    try {
      const { signedTxXdr } = await stellarKit.signTransaction(xdr, {
        address: publicKey,
        networkPassphrase: WalletNetwork.PUBLIC
      })
      return signedTxXdr
    } catch (error) {
      console.error('Failed to sign transaction:', error)
      throw error
    }
  }

  return (
    <StellarWalletContext.Provider 
      value={{ 
        stellarKit, 
        isConnected, 
        publicKey, 
        connect, 
        disconnect,
        signTransaction 
      }}
    >
      {children}
    </StellarWalletContext.Provider>
  )
}

export const useStellarWallet = () => {
  const context = useContext(StellarWalletContext)
  if (!context) {
    throw new Error('useStellarWallet must be used within StellarWalletProvider')
  }
  return context
}