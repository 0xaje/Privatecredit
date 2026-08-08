import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface ReputationViewProps {
  borrowerAddress: string;
  evidenceNodeIds: string[];
  onEligibilityRegistered: () => void;
}

export default function ReputationView({ borrowerAddress, evidenceNodeIds, onEligibilityRegistered }: ReputationViewProps) {
  const [preview, setPreview] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Preview score whenever evidence changes
  useEffect(() => {
    if (!borrowerAddress || evidenceNodeIds.length === 0) {
      setPreview(null);
      return;
    }
    setLoading(true);
    api.previewScore(borrowerAddress, evidenceNodeIds)
      .then(res => setPreview(res.policy))
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [borrowerAddress, evidenceNodeIds]);

  // Fetch on-chain eligibility
  useEffect(() => {
    if (!borrowerAddress) return;
    api.getEligibility(borrowerAddress)
      .then(res => setEligibility(res.eligibility))
      .catch(() => setEligibility(null));
  }, [borrowerAddress]);

  const handleRegister = async () => {
    if (!borrowerAddress || evidenceNodeIds.length === 0) return;
    setRegistering(true);
    try {
      await api.requestEligibility(borrowerAddress, evidenceNodeIds);
      const res = await api.getEligibility(borrowerAddress);
      setEligibility(res.eligibility);
      onEligibilityRegistered();
    } catch (err: any) {
      console.error('Registration failed:', err.message);
    }
    setRegistering(false);
  };

  const score = preview?.breakdown?.finalScore ?? null;
  const tierMap: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444', REJECTED: '#6b7280' };

  return (
    <div className="view-panel">
      <h3 className="view-title">Credit Reputation</h3>

      {/* Score Gauge */}
      <div className="score-gauge-container">
        <svg viewBox="0 0 120 120" className="score-gauge">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke={score !== null ? (score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444') : '#374151'}
            strokeWidth="8"
            strokeDasharray={`${(score ?? 0) * 3.27} 327`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
          <text x="60" y="55" textAnchor="middle" fill="#f3f4f6" fontSize="28" fontWeight="700" fontFamily="Outfit">
            {score ?? '--'}
          </text>
          <text x="60" y="75" textAnchor="middle" fill="#9ca3af" fontSize="11" fontFamily="Outfit">
            INSIGHT SCORE
          </text>
        </svg>
      </div>

      {/* Risk Tier */}
      {preview && (
        <div className="tier-display">
          <span className="tier-badge" style={{ background: tierMap[preview.riskTier] || '#6b7280' }}>
            {preview.riskTier} RISK
          </span>
        </div>
      )}

      {/* Breakdown */}
      {preview?.breakdown?.factors?.length > 0 && (
        <div className="breakdown-section">
          <div className="inspector-label">SCORE BREAKDOWN</div>
          <div className="breakdown-list">
            <div className="breakdown-item">
              <span>Base Score</span>
              <span className="breakdown-value">50</span>
            </div>
            {preview.breakdown.factors.map((f: any, i: number) => (
              <div key={i} className="breakdown-item">
                <span>{f.reason}</span>
                <span className="breakdown-value" style={{ color: f.impact > 0 ? '#10b981' : '#ef4444' }}>
                  {f.impact > 0 ? '+' : ''}{f.impact}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="view-status">Calculating score...</p>}
      {!loading && evidenceNodeIds.length === 0 && (
        <p className="view-status">Add verified evidence to calculate your credit score.</p>
      )}

      {/* Register Button */}
      {preview && preview.riskTier !== 'REJECTED' && (
        <button className="primary-action-btn" onClick={handleRegister} disabled={registering}>
          {registering ? 'Registering on-chain...' : 'Register Eligibility On-Chain'}
        </button>
      )}

      {/* On-chain Eligibility */}
      {eligibility && eligibility.active && (
        <div className="onchain-eligibility">
          <div className="inspector-label" style={{ marginTop: '24px' }}>ON-CHAIN ELIGIBILITY</div>
          <div className="eligibility-grid">
            <div><span className="eg-label">Risk Tier</span><span className="eg-value">{['LOW','MEDIUM','HIGH'][eligibility.riskTier]}</span></div>
            <div><span className="eg-label">Max Credit</span><span className="eg-value">{(Number(eligibility.maxActiveCredit) / 1e18).toFixed(0)} CTC</span></div>
            <div><span className="eg-label">Max LTV</span><span className="eg-value">{(Number(eligibility.maxLtvBps) / 100).toFixed(0)}%</span></div>
            <div><span className="eg-label">Valid Until</span><span className="eg-value">{new Date(Number(eligibility.validUntil) * 1000).toLocaleDateString()}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
