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
    if (walletClient) {
      const { account, chain, transport } = walletClient;
      const network = {
        chainId: chain.id,
        name: chain.name,
      };
      const provider = new BrowserProvider(transport, network);
      return provider.getSigner(account.address);
    }
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const provider = new BrowserProvider((window as any).ethereum);
      return provider.getSigner();
    }
    throw new Error('Connect your wallet before signing.');
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
    const overrides: any = {};
    if (value && value !== '0') {
      overrides.value = BigInt(value);
    }

    try {
      return await contract[method](...args, overrides);
    } catch (err: any) {
      // If RPC failed to coalesce error or estimate gas, fallback with explicit gas limit
      const errMsg = err?.message || String(err);
      if (errMsg.includes('coalesce') || errMsg.includes('estimateGas') || errMsg.includes('UNPREDICTABLE_GAS_LIMIT')) {
        overrides.gasLimit = 600000n;
        return await contract[method](...args, overrides);
      }
      throw err;
    }
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
