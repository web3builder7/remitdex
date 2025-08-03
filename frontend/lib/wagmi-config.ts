import { createConfig, http } from 'wagmi'
import { mainnet, polygon, bsc, arbitrum, optimism, avalanche } from 'wagmi/chains'
import { walletConnect, injected } from 'wagmi/connectors'

export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'

export const wagmiConfig = createConfig({
  chains: [mainnet, polygon, bsc, arbitrum, optimism, avalanche],
  connectors: [
    injected(),
    walletConnect({ 
      projectId,
      showQrModal: true,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [avalanche.id]: http(),
  },
})