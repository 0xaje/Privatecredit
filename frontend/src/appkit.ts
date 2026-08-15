import { createAppKit } from '@reown/appkit/react';
import { defineChain } from '@reown/appkit/networks';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import deployment from '../../config/deployments.json';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;
if (!projectId) {
  throw new Error('VITE_REOWN_PROJECT_ID is required to start the live frontend.');
}

export const creditcoinTestnet = defineChain({
  id: deployment.chainId,
  caipNetworkId: `eip155:${deployment.chainId}`,
  chainNamespace: 'eip155',
  name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Creditcoin', symbol: 'tCTC', decimals: 18 },
  rpcUrls: { default: { http: [deployment.rpcUrl] } },
  blockExplorers: { default: { name: 'Creditcoin Explorer', url: deployment.explorerUrl } },
});

export const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [creditcoinTestnet],
  defaultNetwork: creditcoinTestnet,
  projectId,
  metadata: {
    name: 'PrivateCredit Graph',
    description: 'Verifiable cross-chain credit underwriting on Creditcoin',
    url: window.location.origin,
    icons: [],
  },
  features: { analytics: false, email: false, socials: false },
  customRpcUrls: { [creditcoinTestnet.caipNetworkId]: [{ url: deployment.rpcUrl }] },
});
