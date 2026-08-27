import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { api } from '../api/client';
import { useCreditcoinWallet } from '../wallet';
import { ShieldAlert, Lock, CheckCircle2 } from 'lucide-react';

interface JudgeViewProps {
  borrowerAddress: string;
}

export default function JudgeView({ borrowerAddress }: JudgeViewProps) {
  const [judgeData, setJudgeData] = useState<any>(null);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const { getSigner, address } = useCreditcoinWallet();
  const activeAddress = address || borrowerAddress;

  useEffect(() => {
    if (!activeAddress) return;
    api.getJudgeView(activeAddress)
      .then(setJudgeData)
      .catch(() => setJudgeData(null));
  }, [activeAddress]);

  const handleCommitArtefact = async () => {
    setCommitting(true);
    setCommitResult(null);
    setIsError(false);
    try {
      const evidence = (judgeData?.graph?.nodes || [])
        .filter((node: any) => node.type === 'EVIDENCE' && node.verified && node.uscEvidenceId)
        .sort((a: any, b: any) => a.uscEvidenceId.localeCompare(b.uscEvidenceId))
        .map((node: any) => ({
          id: node.uscEvidenceId,
          sourceChain: node.data?.sourceChain,
          sourceTxHash: node.data?.sourceTxHash,
          type: node.data?.type,
          amount: node.data?.amount,
        }));

      if (evidence.length === 0) {
        throw new Error('No USC-verified evidence nodes found to commit.');
      }

      const commitment = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify({ borrower: activeAddress.toLowerCase(), policyVersion: 1, evidence }))
      );
      const policyReference = ethers.id('privatecredit-policy-v1');
      const prepared = await api.prepareArtefactCommit(activeAddress, commitment, 1, policyReference, `privatecredit:${commitment}`);
      const signer = await getSigner();
      const tx = await signer.sendTransaction(prepared.transaction);
      const receipt = await tx.wait();
      setCommitResult(`Artefact snapshot committed to ArtefactRegistry on CC3! Tx: ${receipt?.hash || tx.hash}`);
    } catch (error: any) {
      setIsError(true);
      setCommitResult(`Snapshot commit failed: ${error.message}`);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="workspace-header">
        <div className="workspace-title">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <span>Auditor Workspace & Invariants</span>
        </div>
      </div>

      <div className="stats-grid-2">
        <div className="glass-stat-card">
          <div className="glass-stat-label">Verified Nodes</div>
          <div className="glass-stat-val" style={{ color: '#34d399' }}>
            {judgeData?.graph?.nodes?.filter((n: any) => n.verified).length || 0}
          </div>
        </div>
        <div className="glass-stat-card">
          <div className="glass-stat-label">Audit Edges</div>
          <div className="glass-stat-val" style={{ color: '#818cf8' }}>
            {judgeData?.graph?.edges?.length || 0}
          </div>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Verifiable Evidence Audit Trail</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
          {(judgeData?.graph?.nodes || [])
            .filter((n: any) => n.type === 'EVIDENCE')
            .map((n: any, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--panel-border)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>
                    {n.id.slice(0, 14)}...
                  </span>
                </div>
                <span style={{ color: '#38bdf8', fontSize: '0.7rem' }}>
                  {n.proofStatus || 'VERIFIED'}
                </span>
              </div>
            ))}
        </div>
      </div>

      <button
        className="execute-btn"
        style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}
        onClick={handleCommitArtefact}
        disabled={committing}
      >
        <Lock className="w-4 h-4" />
        {committing ? 'Awaiting Signature...' : 'Commit Immutable Artefact On-Chain'}
      </button>

      {commitResult && (
        <div className={`feedback-box ${isError ? 'error' : ''}`}>
          {commitResult}
        </div>
      )}
    </div>
  );
}
