import { createContext, useContext } from 'react';
import type { ContractTransactionResponse, Signer } from 'ethers';

export interface WalletContextType {
  address: string;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getSigner: () => Promise<Signer>;
  send: (contractAddress: string, abi: any[], method: string, args: any[], value?: string) => Promise<ContractTransactionResponse>;
}

export const WalletContext = createContext<WalletContextType | null>(null);

export function useCreditcoinWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useCreditcoinWallet must be used within a WalletProvider');
  }
  return context;
}
