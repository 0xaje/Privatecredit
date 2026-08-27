import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, AlertTriangle, ChevronDown, CheckCircle2 } from 'lucide-react';

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
                // 1. Disconnected State
                if (!connected) {
                  return (
                    <button
                      onClick={openConnectModal}
                      type="button"
                      className="connect-wallet-glow-btn"
                    >
                      <div className="btn-inner">
                        <Wallet className="w-4 h-4 text-cyan-400" />
                        <span>Connect Wallet</span>
                      </div>
                    </button>
                  );
                }

                // 2. Wrong Network State
                if (chain.unsupported) {
                  return (
                    <button
                      onClick={openChainModal}
                      type="button"
                      className="network-warning-btn"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-300 animate-bounce" />
                      <span>Switch to CC3 Testnet</span>
                    </button>
                  );
                }

                // 3. Connected Institutional Pill
                return (
                  <div className="connected-wallet-cluster">
                    {/* Chain Pill */}
                    <button
                      onClick={openChainModal}
                      type="button"
                      className="chain-select-pill"
                    >
                      <div className="chain-indicator">
                        <span className="chain-dot-active" />
                      </div>
                      <span className="chain-name-text">
                        {chain.name || 'Creditcoin CC3'}
                      </span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {/* Account & Balance Pill */}
                    <button
                      onClick={openAccountModal}
                      type="button"
                      className="account-select-pill"
                    >
                      {account.displayBalance && (
                        <span className="account-balance-text">
                          {account.displayBalance}
                        </span>
                      )}
                      <div className="account-avatar-ring">
                        <div className="account-identicon">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <span className="account-address-text">
                          {account.displayName}
                        </span>
                      </div>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
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
