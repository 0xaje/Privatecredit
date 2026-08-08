import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface LoansViewProps {
  borrowerAddress: string;
  onLoanAction: () => void;
}

export default function LoansView({ borrowerAddress, onLoanAction }: LoansViewProps) {
  const [capacity, setCapacity] = useState<{ available: string; used: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', maxAprBps: '1000', maxDuration: '2592000', collateral: '' });
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

  const handleSubmit = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.createBorrowRequest(
        form.amount,
        Number(form.maxAprBps),
        Number(form.maxDuration),
        form.collateral
      );
      setResult(`Request created! ID: ${res.requestId}, Tx: ${res.txHash?.slice(0, 10)}...`);
      onLoanAction();
      setShowForm(false);
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    }
    setSubmitting(false);
  };

  return (
    <div className="view-panel">
      <h3 className="view-title">Loans & Capacity</h3>

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
      {!showForm ? (
        <button className="primary-action-btn" onClick={() => setShowForm(true)} disabled={availNum <= 0}>
          {availNum > 0 ? 'Create Borrow Request' : 'No Capacity Available'}
        </button>
      ) : (
        <div className="borrow-form">
          <div className="inspector-label">NEW BORROW REQUEST</div>
          <div className="form-field">
            <label>Amount (wei)</label>
            <input type="text" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="1000000000000000000" />
          </div>
          <div className="form-field">
            <label>Max APR (bps)</label>
            <input type="text" value={form.maxAprBps} onChange={e => setForm({...form, maxAprBps: e.target.value})} placeholder="1000" />
          </div>
          <div className="form-field">
            <label>Max Duration (seconds)</label>
            <input type="text" value={form.maxDuration} onChange={e => setForm({...form, maxDuration: e.target.value})} placeholder="2592000" />
          </div>
          <div className="form-field">
            <label>Collateral (wei)</label>
            <input type="text" value={form.collateral} onChange={e => setForm({...form, collateral: e.target.value})} placeholder="500000000000000000" />
          </div>
          <div className="form-actions">
            <button className="primary-action-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
            <button className="secondary-action-btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {result && <div className="result-msg">{result}</div>}
    </div>
  );
}
