import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, AlertTriangle } from 'lucide-react';

export function CustomConnectButton() {
  return (
    <div className="relative flex items-center shrink-0">
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          authenticationStatus,
          mounted,
        }) => {
          const ready = mounted && authenticationStatus !== 'loading';
          const connected =
            ready &&
            account &&
            chain &&
            (!authenticationStatus || authenticationStatus === 'authenticated');

          return (
            <div
              {...(!ready && {
                'aria-hidden': true,
                style: {
                  opacity: 0,
                  pointerEvents: 'none',
                  userSelect: 'none',
                },
              })}
            >
              {(() => {
                // 1. Not connected state
                if (!connected) {
                  return (
                    <button
                      onClick={openConnectModal}
                      type="button"
                      className="px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all text-xs font-mono shadow-md active:scale-95 cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border border-cyan-400/30"
                      style={{
                        background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                        color: '#ffffff',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        boxShadow: '0 0 15px rgba(2, 132, 199, 0.3)',
                      }}
                    >
                      <Wallet className="w-4 h-4" />
                      <span>CONNECT WALLET</span>
                    </button>
                  );
                }

                // 2. Unsupported / Wrong Network state
                if (chain.unsupported) {
                  return (
                    <button
                      onClick={openChainModal}
                      type="button"
                      className="px-3 py-1.5 bg-red-600/90 text-white font-bold text-xs font-mono rounded-lg transition-all cursor-pointer hover:bg-red-700 flex items-center gap-1.5 border border-red-400/40 animate-pulse shadow-lg"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Switch to CC3</span>
                    </button>
                  );
                }

                // 3. Connected state
                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openChainModal}
                      type="button"
                      className="px-2.5 py-1.5 bg-slate-800/80 border border-slate-700/70 text-slate-300 font-semibold text-xs font-mono rounded-lg transition-all flex items-center gap-1.5 cursor-pointer hover:bg-slate-700/80"
                    >
                      {chain.hasIcon && (
                        <div
                          style={{
                            background: chain.iconBackground,
                            width: 12,
                            height: 12,
                            borderRadius: 999,
                            overflow: 'hidden',
                            marginRight: 4,
                          }}
                        >
                          {chain.iconUrl && (
                            <img
                              alt={chain.name ?? 'Chain icon'}
                              src={chain.iconUrl}
                              style={{ width: 12, height: 12 }}
                            />
                          )}
                        </div>
                      )}
                      <span>{chain.name}</span>
                    </button>

                    <button
                      onClick={openAccountModal}
                      type="button"
                      className="px-3 py-1.5 bg-slate-900/90 border border-cyan-500/40 text-slate-100 font-bold text-xs font-mono rounded-lg transition-all flex items-center gap-2 cursor-pointer hover:bg-slate-800 shadow-md"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>{account.displayName}</span>
                      {account.displayBalance ? (
                        <span className="text-slate-400 font-normal">({account.displayBalance})</span>
                      ) : null}
                    </button>
                  </div>
                );
              })()}
            </div>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
