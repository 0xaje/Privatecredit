import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  injectedWallet,
  walletConnectWallet,
  coinbaseWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { defineChain } from 'viem';
import deploymentManifest from '../../../../config/privatecredit-cc3-live-v3.json';

// 1. Creditcoin CC3 Testnet
export const creditcoinTestnet = defineChain({
  id: deploymentManifest.chainId || 102031,
  name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Creditcoin', symbol: 'tCTC', decimals: 18 },
  rpcUrls: {
    default: { http: [deploymentManifest.rpcUrl || 'https://rpc.cc3-testnet.creditcoin.network'] },
    public: { http: [deploymentManifest.rpcUrl || 'https://rpc.cc3-testnet.creditcoin.network'] },
  },
  blockExplorers: {
    default: {
      name: 'Creditcoin Explorer',
      url: 'https://creditcoin.blockscout.com',
    },
  },
  testnet: true,
});

// 2. Sepolia Testnet (Source Chain for USC Evidence)
export const sepoliaChain = defineChain({
  id: 11155111,
  name: 'Sepolia Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.sepolia.org'] },
    public: { http: ['https://rpc.sepolia.org'] },
  },
  blockExplorers: {
    default: {
      name: 'Etherscan',
      url: 'https://sepolia.etherscan.io',
    },
  },
  testnet: true,
});

// 3. Configure RainbowKit connectors
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || 'c4f79cc821944d9680842e34466bfb';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Supported Wallets',
      wallets: [injectedWallet, metaMaskWallet, walletConnectWallet, coinbaseWallet],
    },
  ],
  {
    appName: 'PrivateCredit Graph',
    projectId,
  }
);

// 4. Create Wagmi config
export const config = createConfig({
  connectors,
  chains: [creditcoinTestnet, sepoliaChain],
  transports: {
    [creditcoinTestnet.id]: http(creditcoinTestnet.rpcUrls.default.http[0]),
    [sepoliaChain.id]: http(sepoliaChain.rpcUrls.default.http[0]),
  },
});
