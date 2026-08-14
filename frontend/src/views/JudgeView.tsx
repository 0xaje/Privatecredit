import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { api } from '../api/client';
import { useCreditcoinWallet } from '../wallet';

interface JudgeViewProps { borrowerAddress: string; }

export default function JudgeView({ borrowerAddress }: JudgeViewProps) {
  const [judgeData, setJudgeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);
  const { getSigner } = useCreditcoinWallet();

  useEffect(() => {
    if (!borrowerAddress) return;
    setLoading(true);
    api.getJudgeView(borrowerAddress).then(setJudgeData).catch(() => setJudgeData(null)).finally(() => setLoading(false));
  }, [borrowerAddress]);

  const handleCommitArtefact = async () => {
    setCommitting(true);
    setCommitResult(null);
    try {
      const evidence = (judgeData?.graph?.nodes || [])
        .filter((node: any) => node.type === 'EVIDENCE' && node.verified && node.uscEvidenceId)
        .sort((a: any, b: any) => a.uscEvidenceId.localeCompare(b.uscEvidenceId))
        .map((node: any) => ({
          id: node.uscEvidenceId,
          featureId: node.data?.featureId,
          sourceChain: node.data?.sourceChain,
          sourceTxHash: node.data?.sourceTxHash,
          type: node.data?.type,
          amount: node.data?.amount,
          verificationContext: node.data?.verificationContext,
        }));
      if (evidence.length === 0) throw new Error('No USC-verified evidence is available for an artefact.');
      const commitment = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ borrower: borrowerAddress.toLowerCase(), policyVersion: 1, evidence })));
      const policyReference = ethers.id('privatecredit-policy-v1');
      const prepared = await api.prepareArtefactCommit(borrowerAddress, commitment, 1, policyReference, `privatecredit:${commitment}`);
      const signer = await getSigner();
      const tx = await signer.sendTransaction(prepared.transaction);
      const receipt = await tx.wait();
      setCommitResult(`Artefact confirmed: ${receipt?.hash || tx.hash}`);
    } catch (error: any) {
      setCommitResult(`Error: ${error.message}`);
    } finally {
      setCommitting(false);
    }
  };

  if (loading) return <div className="view-panel"><p className="view-status">Loading audit data...</p></div>;

  return (
    <div className="view-panel">
      <h3 className="view-title"><span className="judge-icon">⚖</span> Judge / Auditor Mode</h3>
      {judgeData ? <>
        <div className="judge-summary"><div className="stat-card"><div className="stat-value">{judgeData.totalEvidence || 0}</div><div className="stat-label">Evidence Nodes</div></div><div className="stat-card"><div className="stat-value">{judgeData.verifications?.filter((v: any) => v).length || 0}</div><div className="stat-label">USC Verified</div></div></div>
        <div className="inspector-label" style={{ marginTop: '20px' }}>VERIFICATION AUDIT TRAIL</div>
        <div className="audit-table"><div className="audit-header"><span>Node</span><span>USC Evidence</span><span>Status</span></div>{judgeData.graph?.nodes?.filter((n: any) => n.type === 'EVIDENCE').map((n: any, i: number) => <div key={i} className="audit-row"><span className="audit-cell mono">{n.id.slice(0, 20)}...</span><span className="audit-cell mono">{n.uscEvidenceId?.slice(0, 16) || 'N/A'}...</span><span className="audit-cell"><span className={`status-dot ${n.proofStatus === 'VERIFIED' ? 'verified' : 'pending'}`} />{n.proofStatus || 'PENDING'}</span></div>)}</div>
        <div className="inspector-label" style={{ marginTop: '20px' }}>GRAPH EDGES</div>
        <div className="audit-table"><div className="audit-header"><span>Source</span><span>Target</span><span>Type</span></div>{judgeData.graph?.edges?.map((edge: any, i: number) => <div key={i} className="audit-row"><span className="audit-cell mono">{edge.source.slice(0, 18)}...</span><span className="audit-cell mono">{edge.target.slice(0, 18)}...</span><span className="audit-cell">{edge.type}</span></div>)}</div>
        <button className="primary-action-btn" onClick={() => void handleCommitArtefact()} disabled={committing} style={{ marginTop: '20px' }}>{committing ? 'Awaiting signature...' : 'Commit Graph Artefact On-Chain'}</button>
        {commitResult && <div className="result-msg">{commitResult}</div>}
      </> : <p className="view-status">No audit data available. Connect a wallet with verified evidence to begin.</p>}
    </div>
  );
}
