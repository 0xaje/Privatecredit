import { useMemo, useCallback, type ReactNode } from 'react';
import { useAccount, useChainId, useDisconnect, useWalletClient } from 'wagmi';
import { BrowserProvider, Contract, type ContractTransactionResponse, type Signer } from 'ethers';
import { WalletContext, type WalletContextType } from './walletContext';

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { disconnectAsync } = useDisconnect();
  const { data: walletClient } = useWalletClient();

  const getSigner = useCallback(async (): Promise<Signer> => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const provider = new BrowserProvider((window as any).ethereum);
      return provider.getSigner();
    }
    if (!walletClient) {
      throw new Error('Connect your wallet before signing.');
    }
    const transport = (walletClient as any).transport;
    const provider = new BrowserProvider(transport);
    return provider.getSigner();
  }, [walletClient]);

  const send = useCallback(async (
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
  }, [getSigner]);

  const connect = useCallback(async () => {
    // Handled by RainbowKit modal
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await disconnectAsync();
    } catch {
      // ignore
    }
  }, [disconnectAsync]);

  const contextValue = useMemo<WalletContextType>(() => ({
    address: address || '',
    isConnected: !!address && isConnected,
    isConnecting,
    chainId: chainId || null,
    error: null,
    connect,
    disconnect,
    getSigner,
    send,
  }), [address, isConnected, isConnecting, chainId, connect, disconnect, getSigner, send]);

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}
