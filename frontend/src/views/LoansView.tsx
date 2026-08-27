import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { deployment, useCreditcoinWallet } from '../wallet';
import { Gavel } from 'lucide-react';
import { formatUnits } from 'ethers';

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
  const [mode, setMode] = useState<'borrower' | 'lender' | 'auctions'>('borrower');
  const [capacity, setCapacity] = useState<{ available: string; used: string; locked: string } | null>(null);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [showBorrowForm, setShowBorrowForm] = useState(false);
  const [borrowForm, setBorrowForm] = useState({ amount: '', maxAprBps: '1000', maxDuration: '2592000', collateral: '' });
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [acceptForm, setAcceptForm] = useState({ offerId: '', collateralAmount: '' });
  const [showRepayForm, setShowRepayForm] = useState(false);
  const [repayForm, setRepayForm] = useState({ loanId: '', amount: '' });
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerForm, setOfferForm] = useState({ requestId: '', aprBps: '900', duration: '2592000', requiredCollateral: '', principal: '' });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { address, isConnected, send } = useCreditcoinWallet();
  const activeAddress = address || borrowerAddress;

  const loadAuctions = () => {
    api.getAuctions()
      .then(res => setAuctions(res.auctions || []))
      .catch(() => setAuctions([]));
  };

  useEffect(() => {
    if (!activeAddress) return;
    api.getCapacity(activeAddress)
      .then(res => setCapacity({ available: res.availableCapacity, used: res.usedCapacity, locked: res.defaultedLockedCapacity || '0' }))
      .catch(() => setCapacity(null));

    loadAuctions();

    // Subscribe to SSE live updates
    const unsubscribe = api.subscribeToEvents((event) => {
      if (event.type === 'AUCTION_UPDATED' || event.type === 'NODE_UPDATED' || event.type === 'NODE_ADDED') {
        loadAuctions();
        onLoanAction();
      }
    });

    return () => unsubscribe();
  }, [activeAddress, submitting, onLoanAction]);

  const usedNum = capacity ? Number(capacity.used) / 1e18 : 0;
  const lockedNum = capacity ? Number(capacity.locked) / 1e18 : 0;
  const availNum = capacity ? Number(capacity.available) / 1e18 : 0;
  const totalNum = usedNum + lockedNum + availNum;
  const usedPct = totalNum > 0 ? ((usedNum + lockedNum) / totalNum) * 100 : 0;

  const runTransaction = async (action: () => Promise<any>, label: string) => {
    if (!isConnected || !activeAddress) throw new Error('Connect a Creditcoin wallet before signing.');
    setSubmitting(true);
    setResult(null);
    try {
      const tx = await action();
      const receipt = await tx.wait();
      setResult(`${label} confirmed: ${receipt.hash}`);
      onLoanAction();
      loadAuctions();
    } catch (error: any) {
      setResult(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBorrowSubmit = () => runTransaction(
    () => send(deployment.contracts.loanMarketplace, MARKETPLACE_ABI, 'createBorrowRequest', [
      borrowForm.amount,
      Number(borrowForm.maxAprBps),
      Number(borrowForm.maxDuration),
      borrowForm.collateral,
    ]),
    'Borrow request',
  ).then(() => setShowBorrowForm(false));

  const handleAcceptSubmit = () => runTransaction(
    () => send(deployment.contracts.loanMarketplace, MARKETPLACE_ABI, 'acceptOffer', [Number(acceptForm.offerId)], acceptForm.collateralAmount),
    'Offer acceptance',
  ).then(() => setShowAcceptForm(false));

  const handleOfferSubmit = () => runTransaction(
    () => send(deployment.contracts.loanMarketplace, MARKETPLACE_ABI, 'createLenderOffer', [
      Number(offerForm.requestId),
      Number(offerForm.aprBps),
      Number(offerForm.duration),
      offerForm.requiredCollateral,
    ], offerForm.principal),
    'Lender offer',
  ).then(() => setShowOfferForm(false));

  const handleRepaySubmit = () => runTransaction(
    () => send(deployment.contracts.loanVault, VAULT_ABI, 'repayLoan', [Number(repayForm.loanId)], repayForm.amount),
    'Repayment',
  ).then(() => setShowRepayForm(false));

  const handleBidAuction = async (auctionId: string, reservePrice: string) => {
    if (!activeAddress) return;
    setSubmitting(true);
    setResult(null);
    try {
      await api.bidAuction(auctionId, activeAddress, reservePrice);
      setResult(`Auction bid submitted successfully!`);
      loadAuctions();
      onLoanAction();
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="view-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="view-title" style={{ margin: 0 }}>Loans & Recovery</h3>
        <div className="mode-toggle" style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px' }}>
          <button
            style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: mode === 'borrower' ? 'var(--accent-color)' : 'transparent', color: mode === 'borrower' ? '#fff' : 'var(--text-secondary)' }}
            onClick={() => { setMode('borrower'); setResult(null); }}
          >
            Borrower
          </button>
          <button
            style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: mode === 'lender' ? 'var(--node-loan)' : 'transparent', color: mode === 'lender' ? '#fff' : 'var(--text-secondary)' }}
            onClick={() => { setMode('lender'); setResult(null); }}
          >
            Lender
          </button>
          <button
            style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: mode === 'auctions' ? '#d97706' : 'transparent', color: mode === 'auctions' ? '#fff' : 'var(--text-secondary)' }}
            onClick={() => { setMode('auctions'); setResult(null); }}
          >
            Debt Auctions ({auctions.filter(a => a.status === 'ACTIVE').length})
          </button>
        </div>
      </div>

      {mode === 'borrower' && (
        <>
          <div className="capacity-section">
            <div className="inspector-label">BORROWING CAPACITY</div>
            <div className="capacity-bar-container">
              <div className="capacity-bar"><div className="capacity-bar-fill" style={{ width: `${usedPct}%` }} /></div>
              <div className="capacity-labels"><span>Active: {usedNum.toFixed(0)} CTC</span><span>Locked: {lockedNum.toFixed(0)} CTC</span><span>Available: {availNum.toFixed(0)} CTC</span></div>
            </div>
          </div>
          <div className="loans-stats">
            <div className="stat-card"><div className="stat-value">{availNum.toFixed(0)}</div><div className="stat-label">Available CTC</div></div>
            <div className="stat-card"><div className="stat-value">{usedNum.toFixed(0)}</div><div className="stat-label">Active Used</div></div>
            <div className="stat-card"><div className="stat-value">{lockedNum.toFixed(0)}</div><div className="stat-label">Default Locked</div></div>
          </div>
          {!showBorrowForm ? (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button className="primary-action-btn" onClick={() => setShowBorrowForm(true)} disabled={availNum <= 0}>{availNum > 0 ? 'Create Borrow Request' : 'No Capacity Available'}</button>
              <button className="secondary-action-btn" onClick={() => setShowAcceptForm(true)}>Accept Offer</button>
              <button className="secondary-action-btn" onClick={() => setShowRepayForm(true)}>Repay Loan</button>
            </div>
          ) : (
            <div className="borrow-form">
              <div className="inspector-label">NEW BORROW REQUEST</div>
              <div className="form-field"><label>Amount (wei)</label><input type="text" value={borrowForm.amount} onChange={e => setBorrowForm({ ...borrowForm, amount: e.target.value })} placeholder="1000000000000000000" /></div>
              <div className="form-field"><label>Max APR (bps)</label><input type="text" value={borrowForm.maxAprBps} onChange={e => setBorrowForm({ ...borrowForm, maxAprBps: e.target.value })} /></div>
              <div className="form-field"><label>Max Duration (seconds)</label><input type="text" value={borrowForm.maxDuration} onChange={e => setBorrowForm({ ...borrowForm, maxDuration: e.target.value })} /></div>
              <div className="form-field"><label>Collateral (wei)</label><input type="text" value={borrowForm.collateral} onChange={e => setBorrowForm({ ...borrowForm, collateral: e.target.value })} /></div>
              <div className="form-actions"><button className="primary-action-btn" onClick={() => void handleBorrowSubmit()} disabled={submitting}>{submitting ? 'Awaiting signature...' : 'Sign Request'}</button><button className="secondary-action-btn" onClick={() => setShowBorrowForm(false)}>Cancel</button></div>
            </div>
          )}
          {showAcceptForm && <div className="borrow-form" style={{ marginTop: '16px' }}><div className="inspector-label">ACCEPT LENDER OFFER</div><div className="form-field"><label>Offer ID</label><input type="text" value={acceptForm.offerId} onChange={e => setAcceptForm({ ...acceptForm, offerId: e.target.value })} /></div><div className="form-field"><label>Collateral Amount (wei)</label><input type="text" value={acceptForm.collateralAmount} onChange={e => setAcceptForm({ ...acceptForm, collateralAmount: e.target.value })} /></div><div className="form-actions"><button className="primary-action-btn" onClick={() => void handleAcceptSubmit()} disabled={submitting}>{submitting ? 'Awaiting signature...' : 'Sign Acceptance'}</button><button className="secondary-action-btn" onClick={() => setShowAcceptForm(false)}>Cancel</button></div></div>}
          {showRepayForm && <div className="borrow-form" style={{ marginTop: '16px' }}><div className="inspector-label">REPAY ACTIVE LOAN</div><div className="form-field"><label>Loan ID</label><input type="text" value={repayForm.loanId} onChange={e => setRepayForm({ ...repayForm, loanId: e.target.value })} /></div><div className="form-field"><label>Exact repayment amount (wei)</label><input type="text" value={repayForm.amount} onChange={e => setRepayForm({ ...repayForm, amount: e.target.value })} /></div><div className="form-actions"><button className="primary-action-btn" onClick={() => void handleRepaySubmit()} disabled={submitting}>{submitting ? 'Awaiting signature...' : 'Sign Repayment'}</button><button className="secondary-action-btn" onClick={() => setShowRepayForm(false)}>Cancel</button></div></div>}
        </>
      )}

      {mode === 'lender' && (
        <>
          <div className="inspector-label" style={{ marginBottom: '12px' }}>LENDER ACTIONS</div>
          {!showOfferForm ? <button className="primary-action-btn" style={{ background: 'linear-gradient(135deg, var(--node-loan), #be185d)' }} onClick={() => setShowOfferForm(true)}>Make Loan Offer</button> : <div className="borrow-form"><div className="inspector-label">NEW LENDER OFFER</div><div className="form-field"><label>Request ID</label><input type="text" value={offerForm.requestId} onChange={e => setOfferForm({ ...offerForm, requestId: e.target.value })} /></div><div className="form-field"><label>Principal (wei)</label><input type="text" value={offerForm.principal} onChange={e => setOfferForm({ ...offerForm, principal: e.target.value })} /></div><div className="form-field"><label>APR (bps)</label><input type="text" value={offerForm.aprBps} onChange={e => setOfferForm({ ...offerForm, aprBps: e.target.value })} /></div><div className="form-field"><label>Duration (seconds)</label><input type="text" value={offerForm.duration} onChange={e => setOfferForm({ ...offerForm, duration: e.target.value })} /></div><div className="form-field"><label>Required Collateral (wei)</label><input type="text" value={offerForm.requiredCollateral} onChange={e => setOfferForm({ ...offerForm, requiredCollateral: e.target.value })} /></div><div className="form-actions"><button className="primary-action-btn" style={{ background: 'linear-gradient(135deg, var(--node-loan), #be185d)' }} onClick={() => void handleOfferSubmit()} disabled={submitting}>{submitting ? 'Awaiting signature...' : 'Sign Funded Offer'}</button><button className="secondary-action-btn" onClick={() => setShowOfferForm(false)}>Cancel</button></div></div>}
        </>
      )}

      {mode === 'auctions' && (
        <div className="space-y-4">
          <div className="inspector-label" style={{ marginBottom: '8px' }}>SECONDARY DEBT RECOVERY & LIQUIDATION</div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Buy defaulted loan debt claims at a discount. Liquidators settle debt notes and claim underlying pledged collateral directly.
          </p>

          {auctions.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <Gavel style={{ width: '32px', height: '32px', color: '#9ca3af', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '13px', color: '#9ca3af' }}>No defaulted debt auctions currently open.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {auctions.map((a) => {
                const isSettled = a.status === 'SETTLED';
                const principalFormatted = a.principal ? Number(formatUnits(a.principal, 18)).toFixed(2) : '0';
                return (
                  <div
                    key={a.id}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: isSettled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#f3f4f6' }}>Loan #{a.loanId} Debt Note</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: isSettled ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: isSettled ? '#34d399' : '#fbbf24' }}>
                        {a.status}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px', fontSize: '12px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
                        <div style={{ color: '#9ca3af', fontSize: '10px' }}>Principal</div>
                        <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{principalFormatted} CTC</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
                        <div style={{ color: '#9ca3af', fontSize: '10px' }}>Discount</div>
                        <div style={{ fontWeight: 600, color: '#fbbf24' }}>-{(a.discountBps / 100).toFixed(0)}%</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
                        <div style={{ color: '#9ca3af', fontSize: '10px' }}>Borrower</div>
                        <div style={{ fontWeight: 600, color: '#9ca3af', fontFamily: 'monospace' }}>{a.borrower.slice(0, 6)}...{a.borrower.slice(-4)}</div>
                      </div>
                    </div>

                    {!isSettled && (
                      <button
                        className="primary-action-btn"
                        style={{ width: '100%', background: 'linear-gradient(135deg, #d97706, #b45309)' }}
                        onClick={() => handleBidAuction(a.id, a.reservePrice)}
                        disabled={submitting}
                      >
                        {submitting ? 'Submitting...' : `Buy Debt Claim (${(Number(principalFormatted) * (1 - a.discountBps / 10000)).toFixed(2)} CTC)`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {result && <div className="result-msg" style={{ marginTop: '16px' }}>{result}</div>}
    </div>
  );
}
