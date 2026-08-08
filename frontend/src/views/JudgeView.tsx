import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface JudgeViewProps {
  borrowerAddress: string;
}

export default function JudgeView({ borrowerAddress }: JudgeViewProps) {
  const [judgeData, setJudgeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);

  useEffect(() => {
    if (!borrowerAddress) return;
    setLoading(true);
    api.getJudgeView(borrowerAddress)
      .then(data => setJudgeData(data))
      .catch(() => setJudgeData(null))
      .finally(() => setLoading(false));
  }, [borrowerAddress]);

  const handleCommitArtefact = async () => {
    setCommitting(true);
    setCommitResult(null);
    try {
      // Use the graph data as the snapshot commitment
      const snapshot = JSON.stringify(judgeData?.graph || {});
      const commitment = '0x' + Array.from(new TextEncoder().encode(snapshot).slice(0, 32))
        .map(b => b.toString(16).padStart(2, '0')).join('').padEnd(64, '0');

      const res = await api.commitArtefact(commitment, 1, `graph-snapshot-${Date.now()}`);
      setCommitResult(`Artefact committed! Tx: ${res.txHash?.slice(0, 14)}...`);
    } catch (err: any) {
      setCommitResult(`Error: ${err.message}`);
    }
    setCommitting(false);
  };

  if (loading) return <div className="view-panel"><p className="view-status">Loading audit data...</p></div>;

  return (
    <div className="view-panel">
      <h3 className="view-title">
        <span className="judge-icon">⚖</span> Judge / Auditor Mode
      </h3>

      {judgeData ? (
        <>
          {/* Summary */}
          <div className="judge-summary">
            <div className="stat-card">
              <div className="stat-value">{judgeData.totalEvidence || 0}</div>
              <div className="stat-label">Evidence Nodes</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{judgeData.verifications?.filter((v: any) => v).length || 0}</div>
              <div className="stat-label">Verified</div>
            </div>
          </div>

          {/* Verification Table */}
          <div className="inspector-label" style={{ marginTop: '20px' }}>VERIFICATION AUDIT TRAIL</div>
          <div className="audit-table">
            <div className="audit-header">
              <span>Node</span>
              <span>Attestcoin Ref</span>
              <span>Status</span>
            </div>
            {judgeData.graph?.nodes?.filter((n: any) => n.type === 'EVIDENCE').map((n: any, i: number) => (
              <div key={i} className="audit-row">
                <span className="audit-cell mono">{n.id.slice(0, 20)}...</span>
                <span className="audit-cell mono">{n.attestcoinRef?.slice(0, 16) || 'N/A'}...</span>
                <span className="audit-cell">
                  <span className={`status-dot ${n.verified ? 'verified' : 'pending'}`} />
                  {n.verified ? 'Confirmed' : 'Pending'}
                </span>
              </div>
            ))}
            {(!judgeData.graph?.nodes || judgeData.graph.nodes.filter((n: any) => n.type === 'EVIDENCE').length === 0) && (
              <div className="audit-row"><span className="audit-cell">No evidence nodes found</span></div>
            )}
          </div>

          {/* Edge Audit */}
          <div className="inspector-label" style={{ marginTop: '20px' }}>GRAPH EDGES</div>
          <div className="audit-table">
            <div className="audit-header">
              <span>Source</span>
              <span>Target</span>
              <span>Type</span>
            </div>
            {judgeData.graph?.edges?.map((e: any, i: number) => (
              <div key={i} className="audit-row">
                <span className="audit-cell mono">{e.source.slice(0, 18)}...</span>
                <span className="audit-cell mono">{e.target.slice(0, 18)}...</span>
                <span className="audit-cell">{e.type}</span>
              </div>
            ))}
          </div>

          {/* Commit Artefact */}
          <button className="primary-action-btn" onClick={handleCommitArtefact} disabled={committing} style={{ marginTop: '20px' }}>
            {committing ? 'Committing...' : 'Commit Graph Artefact On-Chain'}
          </button>
          {commitResult && <div className="result-msg">{commitResult}</div>}
        </>
      ) : (
        <p className="view-status">No audit data available. Connect a wallet with evidence to begin.</p>
      )}
    </div>
  );
}
