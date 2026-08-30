import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { deployment, useCreditcoinWallet } from '../wallet';
import { Gavel, DollarSign, ArrowUpRight, CheckCircle2, Zap } from 'lucide-react';
import { formatUnits, parseEther } from 'ethers';

interface LoansViewProps {
  borrowerAddress: string;
  onLoanAction: () => void;
}

const MARKETPLACE_ABI = [
  'function createBorrowRequest(uint256 amount,uint256 maxAprBps,uint256 maxDuration,uint256 collateralAmount) external returns (uint256)',
  'function createLenderOffer(uint256 requestId,uint256 aprBps,uint256 duration,uint256 requiredCollateral) external payable returns (uint256)',
  'function acceptOffer(uint256 offerId) external payable',
];
const VAULT_ABI = ['function repayLoan(uint256 loanId) external payable'];

export default function LoansView({ borrowerAddress, onLoanAction }: LoansViewProps) {
  const [deskTab, setDeskTab] = useState<'borrow' | 'lender' | 'repay' | 'auctions'>('borrow');
  const [capacity, setCapacity] = useState<{ available: string; used: string; locked: string } | null>(null);
  const [auctions, setAuctions] = useState<any[]>([]);

  // Borrow Form (Formatted human units)
  const [borrowAmountCTC, setBorrowAmountCTC] = useState<string>('1.0');
  const [maxAprPct, setMaxAprPct] = useState<number>(8.5);
  const [durationDays, setDurationDays] = useState<number>(30);
  const collateralPct = 20; // 20% collateral required for Tier 1

  // Lender Offer Form
  const [targetRequestId, setTargetRequestId] = useState<string>('1');
  const [offerPrincipalCTC, setOfferPrincipalCTC] = useState<string>('1.0');
  const [offerAprPct, setOfferAprPct] = useState<number>(8.0);
  const offerDurationDays = 30;
  const [offerCollateralCTC, setOfferCollateralCTC] = useState<string>('0.2');

  // Repayment Form
  const [repayLoanId, setRepayLoanId] = useState<string>('1');
  const [repayAmountCTC, setRepayAmountCTC] = useState<string>('1.02');

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const { address, isConnected, send } = useCreditcoinWallet();
  const activeAddress = address || borrowerAddress;

  const loadData = useCallback(() => {
    if (activeAddress) {
      api.getCapacity(activeAddress)
        .then(res => setCapacity({ available: res.availableCapacity, used: res.usedCapacity, locked: res.defaultedLockedCapacity || '0' }))
        .catch(() => setCapacity(null));
    }
    api.getAuctions()
      .then(res => setAuctions(res.auctions || []))
      .catch(() => setAuctions([]));
  }, [activeAddress]);

  useEffect(() => {
    loadData();
    const unsubscribe = api.subscribeToEvents(() => {
      loadData();
      onLoanAction();
    });
    return () => unsubscribe();
  }, [loadData, onLoanAction]);

  const availNum = capacity ? Number(formatUnits(capacity.available, 18)) : 0;
  const usedNum = capacity ? Number(formatUnits(capacity.used, 18)) : 0;

  const runTransaction = async (action: () => Promise<any>, label: string) => {
    if (!isConnected || !activeAddress) {
      setIsError(true);
      setResult('Please connect your Web3 wallet via RainbowKit in the top right.');
      return;
    }
    setSubmitting(true);
    setResult(null);
    setIsError(false);
    try {
      const tx = await action();
      const receipt = await tx.wait();
      setResult(`${label} confirmed on Creditcoin CC3! Tx: ${receipt.hash}`);
      onLoanAction();
      loadData();
    } catch (error: any) {
      setIsError(true);
      setResult(error.shortMessage || error.message || 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Submit Borrow Request
  const handleBorrowSubmit = () => {
    const amountWei = parseEther(borrowAmountCTC || '0');
    const collateralWei = parseEther(((Number(borrowAmountCTC || 0) * collateralPct) / 100).toFixed(6));
    const durationSeconds = durationDays * 86400;
    const aprBps = Math.round(maxAprPct * 100);

    return runTransaction(
      () => send(deployment.contracts.loanMarketplace, MARKETPLACE_ABI, 'createBorrowRequest', [
        amountWei.toString(),
        aprBps,
        durationSeconds,
        collateralWei.toString(),
      ]),
      'Borrow Request'
    );
  };

  // 2. Submit Funded Lender Offer
  const handleLenderOfferSubmit = () => {
    const principalWei = parseEther(offerPrincipalCTC || '0');
    const reqCollateralWei = parseEther(offerCollateralCTC || '0');
    const durationSeconds = offerDurationDays * 86400;
    const aprBps = Math.round(offerAprPct * 100);

    return runTransaction(
      () => send(deployment.contracts.loanMarketplace, MARKETPLACE_ABI, 'createLenderOffer', [
        Number(targetRequestId),
        aprBps,
        durationSeconds,
        reqCollateralWei.toString(),
      ], principalWei.toString()),
      'Funded Lender Offer'
    );
  };

  // 3. Submit Repayment
  const handleRepaySubmit = () => {
    const repayWei = parseEther(repayAmountCTC || '0');
    return runTransaction(
      () => send(deployment.contracts.loanVault, VAULT_ABI, 'repayLoan', [Number(repayLoanId)], repayWei.toString()),
      'Loan Repayment'
    );
  };

  // 4. Liquidate / Buy Defaulted Debt
  const handleBidAuction = async (auctionId: string, reservePriceWei: string) => {
    if (!activeAddress) return;
    setSubmitting(true);
    setResult(null);
    setIsError(false);
    try {
      await api.bidAuction(auctionId, activeAddress, reservePriceWei);
      setResult(`Debt claim purchased successfully! Payout routed to lender.`);
      loadData();
      onLoanAction();
    } catch (err: any) {
      setIsError(true);
      setResult(`Auction bid failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="workspace-header">
        <div className="workspace-title">
          <Zap className="w-5 h-5 text-sky-400" />
          <span>Credit Market & Lending Desk</span>
        </div>
      </div>

      {/* Subtab Switcher */}
      <div className="subtab-switcher">
        <button
          className={`subtab-btn ${deskTab === 'borrow' ? 'active' : ''}`}
          onClick={() => { setDeskTab('borrow'); setResult(null); }}
        >
          Borrow Desk
        </button>
        <button
          className={`subtab-btn ${deskTab === 'lender' ? 'active' : ''}`}
          onClick={() => { setDeskTab('lender'); setResult(null); }}
        >
          Lender Desk
        </button>
        <button
          className={`subtab-btn ${deskTab === 'repay' ? 'active' : ''}`}
          onClick={() => { setDeskTab('repay'); setResult(null); }}
        >
          Repay Desk
        </button>
        <button
          className={`subtab-btn ${deskTab === 'auctions' ? 'active' : ''}`}
          onClick={() => { setDeskTab('auctions'); setResult(null); }}
        >
          Auctions ({auctions.filter(a => a.status === 'ACTIVE').length})
        </button>
      </div>

      {/* Capacity HUD */}
      <div className="stats-grid-2">
        <div className="glass-stat-card">
          <div className="glass-stat-label">Available Capacity</div>
          <div className="glass-stat-val" style={{ color: '#38bdf8' }}>{availNum.toFixed(2)} CTC</div>
        </div>
        <div className="glass-stat-card">
          <div className="glass-stat-label">Active Borrowed</div>
          <div className="glass-stat-val" style={{ color: '#f59e0b' }}>{usedNum.toFixed(2)} CTC</div>
        </div>
      </div>

      {/* ─── 1. BORROW DESK ─── */}
      {deskTab === 'borrow' && (
        <div>
          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Loan Amount</label>
              <span className="form-hint">Max: {availNum.toFixed(2)} CTC</span>
            </div>
            <div className="input-container">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max={availNum}
                value={borrowAmountCTC}
                onChange={e => setBorrowAmountCTC(e.target.value)}
                className="styled-input"
                placeholder="1.0"
              />
              <span className="input-currency-tag">CTC</span>
            </div>
            <div className="preset-chips-row">
              <button className="preset-chip" onClick={() => setBorrowAmountCTC('0.5')}>0.5 CTC</button>
              <button className="preset-chip" onClick={() => setBorrowAmountCTC('1.0')}>1.0 CTC</button>
              <button className="preset-chip" onClick={() => setBorrowAmountCTC((availNum * 0.5).toFixed(2))}>50% Cap</button>
              <button className="preset-chip" onClick={() => setBorrowAmountCTC(availNum.toFixed(2))}>Max Cap</button>
            </div>
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Max Accepted APR</label>
              <span className="form-hint" style={{ color: '#38bdf8' }}>{maxAprPct}%</span>
            </div>
            <input
              type="range"
              min="3"
              max="25"
              step="0.5"
              value={maxAprPct}
              onChange={e => setMaxAprPct(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#0ea5e9' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Loan Duration</label>
            <div className="preset-chips-row" style={{ marginTop: 0 }}>
              {[7, 14, 30, 90].map(days => (
                <button
                  key={days}
                  className={`preset-chip ${durationDays === days ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    background: durationDays === days ? 'rgba(14,165,233,0.2)' : undefined,
                    borderColor: durationDays === days ? '#0ea5e9' : undefined,
                    color: durationDays === days ? '#38bdf8' : undefined,
                  }}
                  onClick={() => setDurationDays(days)}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          <div className="glass-stat-card" style={{ marginBottom: '14px', background: 'rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span>Required Collateral ({collateralPct}% LTV tier):</span>
              <span style={{ fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                {((Number(borrowAmountCTC || 0) * collateralPct) / 100).toFixed(3)} CTC
              </span>
            </div>
          </div>

          <button
            className="execute-btn"
            onClick={handleBorrowSubmit}
            disabled={submitting || availNum <= 0 || Number(borrowAmountCTC) <= 0}
          >
            {submitting ? 'Awaiting Signature...' : 'Submit Borrow Request'}
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── 2. LENDER DESK ─── */}
      {deskTab === 'lender' && (
        <div>
          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Target Borrow Request ID</label>
              <span className="form-hint">Open market requests</span>
            </div>
            <div className="input-container">
              <input
                type="text"
                value={targetRequestId}
                onChange={e => setTargetRequestId(e.target.value)}
                className="styled-input"
                placeholder="1"
              />
              <span className="input-currency-tag">#ID</span>
            </div>
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Capital to Fund</label>
            </div>
            <div className="input-container">
              <input
                type="number"
                step="0.1"
                value={offerPrincipalCTC}
                onChange={e => setOfferPrincipalCTC(e.target.value)}
                className="styled-input"
                placeholder="1.0"
              />
              <span className="input-currency-tag">CTC</span>
            </div>
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Offered APR</label>
              <span className="form-hint" style={{ color: '#10b981' }}>{offerAprPct}%</span>
            </div>
            <input
              type="range"
              min="3"
              max="20"
              step="0.5"
              value={offerAprPct}
              onChange={e => setOfferAprPct(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#10b981' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Required Collateral</label>
            <div className="input-container">
              <input
                type="number"
                step="0.05"
                value={offerCollateralCTC}
                onChange={e => setOfferCollateralCTC(e.target.value)}
                className="styled-input"
                placeholder="0.2"
              />
              <span className="input-currency-tag">CTC</span>
            </div>
          </div>

          <button
            className="execute-btn"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            onClick={handleLenderOfferSubmit}
            disabled={submitting || Number(offerPrincipalCTC) <= 0}
          >
            {submitting ? 'Awaiting Signature...' : 'Deposit & Fund Offer'}
            <DollarSign className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── 3. REPAY DESK ─── */}
      {deskTab === 'repay' && (
        <div>
          <div className="form-group">
            <label className="form-label">Active Loan ID</label>
            <div className="input-container">
              <input
                type="text"
                value={repayLoanId}
                onChange={e => setRepayLoanId(e.target.value)}
                className="styled-input"
                placeholder="1"
              />
              <span className="input-currency-tag">#ID</span>
            </div>
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Repayment Amount (Principal + Interest)</label>
            </div>
            <div className="input-container">
              <input
                type="number"
                step="0.01"
                value={repayAmountCTC}
                onChange={e => setRepayAmountCTC(e.target.value)}
                className="styled-input"
                placeholder="1.02"
              />
              <span className="input-currency-tag">CTC</span>
            </div>
          </div>

          <div className="glass-stat-card" style={{ marginBottom: '14px', background: 'rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#10b981' }}>
              <CheckCircle2 className="w-4 h-4" />
              <span>Full repayment instantly unlocks borrower capacity and releases collateral.</span>
            </div>
          </div>

          <button
            className="execute-btn"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
            onClick={handleRepaySubmit}
            disabled={submitting || Number(repayAmountCTC) <= 0}
          >
            {submitting ? 'Awaiting Signature...' : 'Execute Full Repayment'}
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── 4. DEBT AUCTIONS DESK ─── */}
      {deskTab === 'auctions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {auctions.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
              <Gavel className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No defaulted debt notes on auction.</div>
            </div>
          ) : (
            auctions.map(a => {
              const isSettled = a.status === 'SETTLED';
              const principalFmt = a.principal ? Number(formatUnits(a.principal, 18)).toFixed(2) : '0';
              const discountPct = (a.discountBps / 100).toFixed(0);
              const buyPrice = (Number(principalFmt) * (1 - a.discountBps / 10000)).toFixed(2);

              return (
                <div
                  key={a.id}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: isSettled ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f8fafc' }}>Loan #{a.loanId} Claim</span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px', background: isSettled ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: isSettled ? '#34d399' : '#fbbf24' }}>
                      {a.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '10px' }}>
                    <span>Debt: {principalFmt} CTC</span>
                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>Discount: -{discountPct}%</span>
                  </div>
                  {!isSettled && (
                    <button
                      className="execute-btn"
                      style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', padding: '8px 12px', fontSize: '0.8rem' }}
                      onClick={() => handleBidAuction(a.id, a.reservePrice)}
                      disabled={submitting}
                    >
                      {submitting ? 'Submitting...' : `Buy Claim (${buyPrice} CTC)`}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Result feedback */}
      {result && (
        <div className={`feedback-box ${isError ? 'error' : ''}`}>
          {result}
        </div>
      )}
    </div>
  );
}
