import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface LoansViewProps {
  borrowerAddress: string;
  onLoanAction: () => void;
}

export default function LoansView({ borrowerAddress, onLoanAction }: LoansViewProps) {
  const [mode, setMode] = useState<'borrower' | 'lender'>('borrower');
  
  // Borrower states
  const [capacity, setCapacity] = useState<{ available: string; used: string } | null>(null);
  const [showBorrowForm, setShowBorrowForm] = useState(false);
  const [borrowForm, setBorrowForm] = useState({ amount: '', maxAprBps: '1000', maxDuration: '2592000', collateral: '' });
  
  // Lender states
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerForm, setOfferForm] = useState({ requestId: '', aprBps: '900', duration: '2592000', requiredCollateral: '', principal: '' });

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!borrowerAddress) return;
    api.getCapacity(borrowerAddress)
      .then(res => setCapacity({ available: res.availableCapacity, used: res.usedCapacity }))
      .catch(() => setCapacity(null));
  }, [borrowerAddress]);

  const usedNum = capacity ? Number(capacity.used) / 1e18 : 0;
  const availNum = capacity ? Number(capacity.available) / 1e18 : 0;
  const totalNum = usedNum + availNum;
  const usedPct = totalNum > 0 ? (usedNum / totalNum) * 100 : 0;

  const handleBorrowSubmit = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.createBorrowRequest(
        borrowForm.amount,
        Number(borrowForm.maxAprBps),
        Number(borrowForm.maxDuration),
        borrowForm.collateral
      );
      setResult(`Request created! ID: ${res.requestId}, Tx: ${res.txHash?.slice(0, 10)}...`);
      onLoanAction();
      setShowBorrowForm(false);
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    }
    setSubmitting(false);
  };

  const handleOfferSubmit = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.createOffer(
        Number(offerForm.requestId),
        Number(offerForm.aprBps),
        Number(offerForm.duration),
        offerForm.requiredCollateral,
        offerForm.principal
      );
      setResult(`Offer created! ID: ${res.offerId}, Tx: ${res.txHash?.slice(0, 10)}...`);
      onLoanAction();
      setShowOfferForm(false);
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    }
    setSubmitting(false);
  };

  return (
    <div className="view-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="view-title" style={{ margin: 0 }}>Loans</h3>
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
        </div>
      </div>

      {mode === 'borrower' && (
        <>
          {/* Capacity Bar */}
          <div className="capacity-section">
            <div className="inspector-label">BORROWING CAPACITY</div>
            <div className="capacity-bar-container">
              <div className="capacity-bar">
                <div className="capacity-bar-fill" style={{ width: `${usedPct}%` }} />
              </div>
              <div className="capacity-labels">
                <span>Used: {usedNum.toFixed(0)} CTC</span>
                <span>Available: {availNum.toFixed(0)} CTC</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="loans-stats">
            <div className="stat-card">
              <div className="stat-value">{availNum.toFixed(0)}</div>
              <div className="stat-label">Available CTC</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{usedNum.toFixed(0)}</div>
              <div className="stat-label">Used CTC</div>
            </div>
          </div>

          {/* Create Borrow Request */}
          {!showBorrowForm ? (
            <button className="primary-action-btn" onClick={() => setShowBorrowForm(true)} disabled={availNum <= 0}>
              {availNum > 0 ? 'Create Borrow Request' : 'No Capacity Available'}
            </button>
          ) : (
            <div className="borrow-form">
              <div className="inspector-label">NEW BORROW REQUEST</div>
              <div className="form-field">
                <label>Amount (wei)</label>
                <input type="text" value={borrowForm.amount} onChange={e => setBorrowForm({...borrowForm, amount: e.target.value})} placeholder="1000000000000000000" />
              </div>
              <div className="form-field">
                <label>Max APR (bps)</label>
                <input type="text" value={borrowForm.maxAprBps} onChange={e => setBorrowForm({...borrowForm, maxAprBps: e.target.value})} placeholder="1000" />
              </div>
              <div className="form-field">
                <label>Max Duration (seconds)</label>
                <input type="text" value={borrowForm.maxDuration} onChange={e => setBorrowForm({...borrowForm, maxDuration: e.target.value})} placeholder="2592000" />
              </div>
              <div className="form-field">
                <label>Collateral (wei)</label>
                <input type="text" value={borrowForm.collateral} onChange={e => setBorrowForm({...borrowForm, collateral: e.target.value})} placeholder="500000000000000000" />
              </div>
              <div className="form-actions">
                <button className="primary-action-btn" onClick={handleBorrowSubmit} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
                <button className="secondary-action-btn" onClick={() => setShowBorrowForm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'lender' && (
        <>
          <div className="inspector-label" style={{ marginBottom: '12px' }}>LENDER ACTIONS</div>
          
          {!showOfferForm ? (
            <button className="primary-action-btn" style={{ background: 'linear-gradient(135deg, var(--node-loan), #be185d)' }} onClick={() => setShowOfferForm(true)}>
              Make Loan Offer
            </button>
          ) : (
            <div className="borrow-form">
              <div className="inspector-label">NEW LENDER OFFER</div>
              <div className="form-field">
                <label>Request ID</label>
                <input type="text" value={offerForm.requestId} onChange={e => setOfferForm({...offerForm, requestId: e.target.value})} placeholder="0" />
              </div>
              <div className="form-field">
                <label>Principal (wei)</label>
                <input type="text" value={offerForm.principal} onChange={e => setOfferForm({...offerForm, principal: e.target.value})} placeholder="1000000000000000000" />
              </div>
              <div className="form-field">
                <label>APR (bps)</label>
                <input type="text" value={offerForm.aprBps} onChange={e => setOfferForm({...offerForm, aprBps: e.target.value})} placeholder="900" />
              </div>
              <div className="form-field">
                <label>Duration (seconds)</label>
                <input type="text" value={offerForm.duration} onChange={e => setOfferForm({...offerForm, duration: e.target.value})} placeholder="2592000" />
              </div>
              <div className="form-field">
                <label>Required Collateral (wei)</label>
                <input type="text" value={offerForm.requiredCollateral} onChange={e => setOfferForm({...offerForm, requiredCollateral: e.target.value})} placeholder="500000000000000000" />
              </div>
              <div className="form-actions">
                <button className="primary-action-btn" style={{ background: 'linear-gradient(135deg, var(--node-loan), #be185d)' }} onClick={handleOfferSubmit} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Offer'}
                </button>
                <button className="secondary-action-btn" onClick={() => setShowOfferForm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {result && <div className="result-msg" style={{ marginTop: '16px' }}>{result}</div>}
    </div>
  );
}
