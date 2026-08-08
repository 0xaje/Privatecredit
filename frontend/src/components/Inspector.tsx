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
          <div className="inspector-empty-icon">◇</div>
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
          <Section label="Eligibility" value={data.eligible ? '✓ Active' : '✗ None'} color={data.eligible ? '#10b981' : '#ef4444'} />
        </>
      )}

      {nodeType === 'evidence' && (
        <>
          <Section label="Type" value={data.type} />
          <Section label="Amount" value={data.amount ? `${(Number(data.amount) / 1e18).toFixed(4)} CTC` : 'N/A'} />
          <Section label="Source Chain" value={data.sourceChain || 'N/A'} />
          <Section label="Tx Hash" value={data.sourceTxHash || data.creditcoinTxHash || 'N/A'} mono />
          <Section label="Verification" value={data.verified ? 'Confirmed' : 'Pending'} color={data.verified ? '#10b981' : '#f59e0b'} />
          <Section label="Attestcoin Ref" value={data.attestcoinRequestId || data.attestcoinRef || 'N/A'} mono />
          <Section label="Timestamp" value={data.timestamp ? new Date(data.timestamp * 1000).toLocaleString() : 'N/A'} />
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
