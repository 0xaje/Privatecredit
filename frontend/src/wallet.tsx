import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { BrowserProvider, Contract, type ContractTransactionResponse, type Signer } from 'ethers';
import deploymentManifest from '../../config/privatecredit-cc3-live-v3.json';

export const deployment = {
  ...deploymentManifest,
  contracts: {
    ...deploymentManifest.contracts,
    uscVerifier: import.meta.env.VITE_USC_VERIFIER_ADDRESS || deploymentManifest.contracts.uscVerifier,
  },
};

const CC3_CHAIN_ID_DEC = deployment.chainId || 102031;
const CC3_CHAIN_ID_HEX = `0x${CC3_CHAIN_ID_DEC.toString(16)}`;

interface WalletContextType {
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

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string>('');
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const checkNetwork = async (eth: any): Promise<boolean> => {
    try {
      const currentChainHex = await eth.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(currentChainHex, 16);
      setChainId(currentChainId);

      if (currentChainId !== CC3_CHAIN_ID_DEC) {
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CC3_CHAIN_ID_HEX }],
          });
          return true;
        } catch (switchError: any) {
          if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902 || switchError.code === -32603) {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: CC3_CHAIN_ID_HEX,
                chainName: 'Creditcoin CC3 Testnet',
                nativeCurrency: { name: 'Creditcoin', symbol: 'tCTC', decimals: 18 },
                rpcUrls: [deployment.rpcUrl || 'https://rpc.cc3-testnet.creditcoin.network'],
                blockExplorerUrls: ['https://creditcoin.blockscout.com'],
              }],
            });
            return true;
          }
          throw switchError;
        }
      }
      return true;
    } catch (err: any) {
      console.warn('Network switch issue:', err);
      return false;
    }
  };

  const syncAccounts = useCallback(async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    const eth = (window as any).ethereum;
    try {
      const accounts: string[] = await eth.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        const currentChainHex = await eth.request({ method: 'eth_chainId' });
        setChainId(parseInt(currentChainHex, 16));
      } else {
        setAddress('');
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    syncAccounts();

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
        } else {
          setAddress('');
        }
      };
      const handleChainChanged = (chainHex: string) => {
        setChainId(parseInt(chainHex, 16));
      };

      eth.on?.('accountsChanged', handleAccountsChanged);
      eth.on?.('chainChanged', handleChainChanged);

      return () => {
        eth.removeListener?.('accountsChanged', handleAccountsChanged);
        eth.removeListener?.('chainChanged', handleChainChanged);
      };
    }
  }, [syncAccounts]);

  const connect = async () => {
    setError(null);
    setIsConnecting(true);
    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('No browser wallet detected. Please install MetaMask, Rabby, or Coinbase Wallet.');
      }

      const eth = (window as any).ethereum;
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts selected');
      }

      setAddress(accounts[0]);
      await checkNetwork(eth);
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      const msg = err?.message || 'Wallet connection failed';
      setError(msg);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    setAddress('');
    setChainId(null);
    setError(null);
  };

  const getSigner = async (): Promise<Signer> => {
    if (!address || typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error('Connect your wallet before signing.');
    }
    const eth = (window as any).ethereum;
    await checkNetwork(eth);
    const provider = new BrowserProvider(eth);
    return provider.getSigner();
  };

  const send = async (
    contractAddress: string,
    abi: any[],
    method: string,
    args: any[],
    value?: string
  ): Promise<ContractTransactionResponse> => {
    if (!contractAddress) throw new Error('Contract address is not configured for this environment.');
    const signer = await getSigner();
    const contract = new Contract(contractAddress, abi, signer);
    return contract[method](...args, value ? { value } : {});
  };

  const isConnected = !!address;

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected,
        isConnecting,
        chainId,
        error,
        connect,
        disconnect,
        getSigner,
        send,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useCreditcoinWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useCreditcoinWallet must be used within a WalletProvider');
  }
  return context;
}
