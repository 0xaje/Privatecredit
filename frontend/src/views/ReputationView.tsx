import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useCreditcoinWallet } from '../wallet';
import { ShieldCheck, ArrowRight, Award, Plus } from 'lucide-react';

interface ReputationViewProps {
  borrowerAddress: string;
  evidenceNodeIds: string[];
  onEligibilityRegistered: () => void;
}

export default function ReputationView({ borrowerAddress, evidenceNodeIds, onEligibilityRegistered }: ReputationViewProps) {
  const [preview, setPreview] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // New Evidence Modal/Drawer State
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [sourceChain, setSourceChain] = useState<'11155111' | '1' | '42161'>('11155111');
  const [eventType, setEventType] = useState<'INFLOW' | 'REPAYMENT'>('INFLOW');
  const [txHash, setTxHash] = useState<string>('0x3aef91204859a1bc294857201948572019485720194857201948572019485720');
  const [verifying, setVerifying] = useState(false);

  const { getSigner, address } = useCreditcoinWallet();
  const activeAddress = address || borrowerAddress;

  const loadEligibility = useCallback(() => {
    if (!activeAddress) return;
    api.getEligibility(activeAddress)
      .then(res => setEligibility(res.eligibility))
      .catch(() => setEligibility(null));
  }, [activeAddress]);

  useEffect(() => {
    loadEligibility();
    if (!activeAddress || evidenceNodeIds.length === 0) {
      setPreview(null);
      return;
    }
    api.previewScore(activeAddress, evidenceNodeIds)
      .then(res => setPreview(res.policy))
      .catch(err => setResult(err.message));
  }, [activeAddress, evidenceNodeIds, loadEligibility]);

  const handleVerifyEvidence = async () => {
    if (!activeAddress || !txHash) return;
    setVerifying(true);
    setResult(null);
    setIsError(false);
    try {
      await api.verify(sourceChain, eventType, txHash, activeAddress);
      setResult(`Evidence submitted for Attestcoin USC verification! Block prover 0x0FD2 verifying...`);
      setShowAddEvidence(false);
      onEligibilityRegistered();
    } catch (err: any) {
      setIsError(true);
      setResult(err.message || 'Evidence verification submission failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleRegister = async () => {
    if (!activeAddress || evidenceNodeIds.length === 0) return;
    setRegistering(true);
    setResult(null);
    setIsError(false);
    try {
      const prepared = await api.prepareEligibility(activeAddress, evidenceNodeIds);
      if (!prepared.transaction) throw new Error('Policy rejected or USCVerifier transaction unavailable.');
      const signer = await getSigner();
      const tx = await signer.sendTransaction(prepared.transaction);
      const receipt = await tx.wait();
      loadEligibility();
      setResult(`Eligibility badge minted on-chain! Tx: ${receipt?.hash || tx.hash}`);
      onEligibilityRegistered();
    } catch (error: any) {
      setIsError(true);
      setResult(`Registration failed: ${error.message}`);
    } finally {
      setRegistering(false);
    }
  };

  const score = preview?.breakdown?.finalScore ?? (eligibility?.active ? 850 : 650);
  const tierColor = score >= 800 ? '#10b981' : score >= 600 ? '#0ea5e9' : '#f59e0b';
  const tierLabel = score >= 800 ? 'TIER 1 (AAA)' : score >= 600 ? 'TIER 2 (AA)' : 'TIER 3 (B)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="workspace-header">
        <div className="workspace-title">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>Cross-Chain Reputation & Score</span>
        </div>
      </div>

      {/* Score Gauge & Rating Card */}
      <div
        className="glass-stat-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          padding: '16px',
          background: 'linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(15,23,42,0.8) 100%)',
          border: '1px solid rgba(14,165,233,0.25)',
        }}
      >
        <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={tierColor}
              strokeWidth="8"
              strokeDasharray={`${(score / 1000) * 264} 264`}
              strokeLinecap="round"
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>
              {score}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Deterministic Risk Tier
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: tierColor }}>
            {tierLabel}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            Unlocks up to <strong>80% LTV</strong> on Creditcoin CC3.
          </div>
        </div>
      </div>

      {/* On-Chain Eligibility Status */}
      {eligibility && eligibility.active ? (
        <div className="glass-stat-card" style={{ border: '1px solid rgba(16,185,129,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#34d399', fontWeight: 700, fontSize: '0.85rem' }}>
            <Award className="w-4 h-4" />
            <span>Active On-Chain Badge</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Max Capacity</div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{(Number(eligibility.maxActiveCredit) / 1e18).toFixed(2)} CTC</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Max LTV</div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{(Number(eligibility.maxLtvBps) / 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      ) : (
        <button
          className="execute-btn"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
          onClick={handleRegister}
          disabled={registering}
        >
          {registering ? 'Awaiting Wallet Signature...' : 'Register Eligibility Badge On-Chain'}
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {/* Add Evidence Drawer/Form Toggle */}
      {!showAddEvidence ? (
        <button
          className="quick-action-btn"
          style={{ width: '100%', justifyContent: 'center', background: 'rgba(14,165,233,0.1)', borderColor: 'rgba(14,165,233,0.3)', color: '#38bdf8' }}
          onClick={() => setShowAddEvidence(true)}
        >
          <Plus className="w-4 h-4" />
          <span>Add Cross-Chain Evidence</span>
        </button>
      ) : (
        <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.35)', border: '1px solid var(--panel-border)' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
            Ingest Source-Chain Evidence
          </div>

          <div className="form-group">
            <label className="form-label">Source Network</label>
            <select
              value={sourceChain}
              onChange={e => setSourceChain(e.target.value as any)}
              className="styled-input"
              style={{ background: 'rgba(15,23,42,0.9)' }}
            >
              <option value="11155111">Ethereum Sepolia (Chain ID 11155111)</option>
              <option value="1">Ethereum Mainnet (Chain ID 1)</option>
              <option value="42161">Arbitrum One (Chain ID 42161)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Evidence Type</label>
            <div className="preset-chips-row" style={{ marginTop: 0 }}>
              <button
                className={`preset-chip ${eventType === 'INFLOW' ? 'active' : ''}`}
                style={{ flex: 1, textAlign: 'center', background: eventType === 'INFLOW' ? 'rgba(14,165,233,0.2)' : undefined, color: eventType === 'INFLOW' ? '#38bdf8' : undefined }}
                onClick={() => setEventType('INFLOW')}
              >
                Inflow (Revenue)
              </button>
              <button
                className={`preset-chip ${eventType === 'REPAYMENT' ? 'active' : ''}`}
                style={{ flex: 1, textAlign: 'center', background: eventType === 'REPAYMENT' ? 'rgba(14,165,233,0.2)' : undefined, color: eventType === 'REPAYMENT' ? '#38bdf8' : undefined }}
                onClick={() => setEventType('REPAYMENT')}
              >
                Repayment Track
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Source Transaction Hash</label>
            <input
              type="text"
              value={txHash}
              onChange={e => setTxHash(e.target.value)}
              className="styled-input"
              placeholder="0x..."
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              className="execute-btn"
              style={{ flex: 1 }}
              onClick={handleVerifyEvidence}
              disabled={verifying || !txHash}
            >
              {verifying ? 'Verifying with USC...' : 'Submit to USC Block Prover'}
            </button>
            <button
              className="preset-chip"
              style={{ padding: '0 12px' }}
              onClick={() => setShowAddEvidence(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`feedback-box ${isError ? 'error' : ''}`}>
          {result}
        </div>
      )}
    </div>
  );
}
