import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { deployment, useCreditcoinWallet } from '../wallet';

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
  const [mode, setMode] = useState<'borrower' | 'lender'>('borrower');
  const [capacity, setCapacity] = useState<{ available: string; used: string; locked: string } | null>(null);
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

  useEffect(() => {
    if (!activeAddress) return;
    api.getCapacity(activeAddress)
      .then(res => setCapacity({ available: res.availableCapacity, used: res.usedCapacity, locked: res.defaultedLockedCapacity || '0' }))
      .catch(() => setCapacity(null));
  }, [activeAddress, submitting]);

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

  return (
    <div className="view-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="view-title" style={{ margin: 0 }}>Loans</h3>
        <div className="mode-toggle" style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px' }}>
          <button style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: mode === 'borrower' ? 'var(--accent-color)' : 'transparent', color: mode === 'borrower' ? '#fff' : 'var(--text-secondary)' }} onClick={() => { setMode('borrower'); setResult(null); }}>Borrower</button>
          <button style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: mode === 'lender' ? 'var(--node-loan)' : 'transparent', color: mode === 'lender' ? '#fff' : 'var(--text-secondary)' }} onClick={() => { setMode('lender'); setResult(null); }}>Lender</button>
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
      {result && <div className="result-msg" style={{ marginTop: '16px' }}>{result}</div>}
    </div>
  );
}
