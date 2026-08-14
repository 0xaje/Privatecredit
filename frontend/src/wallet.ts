import { BrowserProvider, Contract, type ContractTransactionResponse, type Signer } from 'ethers';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { appKit, creditcoinTestnet } from './appkit';
import deploymentManifest from '../../config/deployments.json';

export const deployment = {
  ...deploymentManifest,
  contracts: {
    ...deploymentManifest.contracts,
    uscVerifier: import.meta.env.VITE_USC_VERIFIER_ADDRESS || deploymentManifest.contracts.uscVerifier,
  },
};

export function useCreditcoinWallet() {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');

  async function getSigner(): Promise<Signer> {
    if (!isConnected || !address || !walletProvider) throw new Error('Connect a wallet before signing.');
    const provider = new BrowserProvider(walletProvider as any);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== deployment.chainId) {
      await appKit.switchNetwork(creditcoinTestnet);
      throw new Error('Wrong network. Switch to Creditcoin CC3 Testnet and try again.');
    }
    return provider.getSigner();
  }

  async function send(contractAddress: string, abi: string[], method: string, args: any[], value?: string): Promise<ContractTransactionResponse> {
    if (!contractAddress) throw new Error('Contract address is not configured for this environment.');
    const signer = await getSigner();
    const contract = new Contract(contractAddress, abi, signer);
    return contract[method](...args, value ? { value } : {});
  }

  return { address: address || '', isConnected, getSigner, send, appKit };
}
