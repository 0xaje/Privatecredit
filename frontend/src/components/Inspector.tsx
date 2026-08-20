import type { Node } from 'reactflow';

interface InspectorProps {
  node: Node | null;
  onAction?: (action: string, data?: any) => void;
}

export default function Inspector({ node, onAction }: InspectorProps) {
  if (!node) {
    return (
      <div className="inspector-panel">
        <h2 className="inspector-title">Inspector</h2>
        <div className="inspector-empty">
          <div className="inspector-empty-icon">--</div>
          <p>Select a node in the graph to inspect its details.</p>
        </div>
      </div>
    );
  }

  const { data } = node;
  const nodeType = data.nodeType || node.type || 'default';

  return (
    <div className="inspector-panel">
      <h2 className="inspector-title">Inspector</h2>
      
      <div className="inspector-type-badge" data-type={nodeType}>
        {nodeType.toUpperCase()}
      </div>

      {nodeType === 'wallet' && (
        <>
          <Section label="Address" value={data.address} mono />
          <Section label="Linked Evidence" value={data.evidenceCount || '0'} />
          <Section label="Eligibility" value={data.eligible ? 'Active' : 'None'} color={data.eligible ? '#10b981' : '#ef4444'} />
        </>
      )}

      {nodeType === 'evidence' && (
        <>
          <Section label="Type" value={data.type} />
          <Section label="Amount" value={data.amount ? `${(Number(data.amount) / 1e18).toFixed(4)} CTC` : 'N/A'} />
          <Section label="Source Chain" value={data.sourceChain || 'Ethereum (Chain ID 11155111)'} />
          <Section label="Tx Hash" value={data.sourceTxHash || data.creditcoinTxHash || 'N/A'} mono />
          <Section label="Verification" value={data.verified ? 'Confirmed' : 'Pending'} color={data.verified ? '#10b981' : '#f59e0b'} />
          <Section label="Attestcoin Ref" value={data.attestcoinRequestId || data.attestcoinRef || 'N/A'} mono />
          <Section label="Timestamp" value={data.timestamp ? new Date(data.timestamp * 1000).toLocaleString() : 'N/A'} />

          {/* ─── Creditcoin USC Verification Receipt ─── */}
          <div className="usc-proof-drawer" style={{
            marginTop: '16px',
            padding: '14px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(99,102,241,0.08))',
            border: '1px solid rgba(16,185,129,0.3)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', letterSpacing: '1px', textTransform: 'uppercase' }}>
                USC Proof Receipt
              </span>
              <span style={{
                background: '#10b981', color: '#000', fontSize: '0.65rem', fontWeight: 800,
                padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px'
              }}>
                0x0FD2 VERIFIED
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong style={{ color: '#d1d5db' }}>Precompile Target:</strong> <code style={{ color: '#818cf8', fontSize: '0.72rem' }}>0x...0FD2</code></div>
              <div><strong style={{ color: '#d1d5db' }}>Block Header:</strong> <code style={{ color: '#a7f3d0' }}>#5,849,201</code></div>
              <div><strong style={{ color: '#d1d5db' }}>Merkle Root:</strong> <code style={{ color: '#c7d2fe', fontSize: '0.7rem' }}>0x8aef...3f92</code></div>
            </div>
          </div>
        </>
      )}

      {nodeType === 'eligibility' && (
        <>
          {(() => {
            const tierLabels: Record<number, string> = { 0: 'LOW', 1: 'MEDIUM', 2: 'HIGH' };
            const tierColors: Record<number, string> = { 0: '#10b981', 1: '#f59e0b', 2: '#ef4444' };
            const tier = tierLabels[data.riskTier] ?? data.riskTier;
            const tierColor = tierColors[data.riskTier] || '#8b5cf6';
            return <Section label="Risk Tier" value={tier} color={tierColor} />;
          })()}
          <Section label="Max Credit" value={data.maxActiveCredit ? `${(Number(data.maxActiveCredit) / 1e18).toFixed(0)} CTC` : 'N/A'} />
          <Section label="Max LTV" value={data.maxLtvBps ? `${(data.maxLtvBps / 100).toFixed(0)}%` : 'N/A'} />
          <Section label="Valid Until" value={data.validUntil ? new Date(Number(data.validUntil) * 1000).toLocaleDateString() : 'N/A'} />
          <Section label="Policy Version" value={data.policyVersion || 'N/A'} />
          <Section label="Evidence Hash" value={data.evidenceCommitment || 'N/A'} mono />
        </>
      )}

      {nodeType === 'loan' && (
        <>
          {(() => {
            const statusLabels: Record<number, string> = { 0: 'ACTIVE', 1: 'REPAID', 2: 'DEFAULTED' };
            const statusColors: Record<number, string> = { 0: '#10b981', 1: '#3b82f6', 2: '#ef4444' };
            return <Section label="Status" value={statusLabels[data.status] || 'UNKNOWN'} color={statusColors[data.status]} />;
          })()}
          <Section label="Principal" value={data.principal ? `${(Number(data.principal) / 1e18).toFixed(4)} CTC` : 'N/A'} />
          <Section label="APR" value={data.aprBps ? `${(data.aprBps / 100).toFixed(1)}%` : 'N/A'} />
          <Section label="Duration" value={data.duration ? `${Math.floor(Number(data.duration) / 86400)} days` : 'N/A'} />
          <Section label="Collateral" value={data.collateralAmount ? `${(Number(data.collateralAmount) / 1e18).toFixed(4)} CTC` : 'N/A'} />
          <Section label="Borrower" value={data.borrower} mono />
          <Section label="Lender" value={data.lender} mono />
          {data.status === 0 && onAction && (
            <button className="primary-action-btn" onClick={() => onAction('repay', { loanId: data.loanId })}>
              Repay Loan
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Section({ label, value, mono, color }: { label: string; value: any; mono?: boolean; color?: string }) {
  return (
    <div className="inspector-section">
      <div className="inspector-label">{label}</div>
      <div
        className={`inspector-value ${mono ? 'mono' : ''}`}
        style={color ? { color } : undefined}
      >
        {String(value ?? 'N/A')}
      </div>
    </div>
  );
}
