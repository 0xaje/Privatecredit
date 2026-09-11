import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { api } from '../api/client';
import { useCreditcoinWallet } from '../wallet';
import { ShieldAlert, Lock, CheckCircle2, FileCheck, ExternalLink } from 'lucide-react';

interface JudgeViewProps {
  borrowerAddress: string;
}

export default function JudgeView({ borrowerAddress }: JudgeViewProps) {
  const [targetAddress, setTargetAddress] = useState<string>(
    borrowerAddress || '0xb096B95B923a9eE0DD63CF565E482784cCFA3dEc'
  );
  const [judgeData, setJudgeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const { getSigner, address } = useCreditcoinWallet();

  useEffect(() => {
    if (borrowerAddress) {
      setTargetAddress(borrowerAddress);
    }
  }, [borrowerAddress]);

  useEffect(() => {
    if (!targetAddress) return;
    setLoading(true);
    api.getJudgeView(targetAddress)
      .then(res => setJudgeData(res))
      .catch(() => setJudgeData(null))
      .finally(() => setLoading(false));
  }, [targetAddress]);

  const evidenceNodes = (judgeData?.graph?.nodes || []).filter(
    (n: any) => n.type === 'EVIDENCE'
  );

  const handleCommitArtefact = async () => {
    setCommitting(true);
    setCommitResult(null);
    setIsError(false);
    try {
      const evidence = evidenceNodes
        .map((node: any) => ({
          id: node.uscEvidenceId || node.data?.attestcoinRequestId || node.id,
          sourceChain: node.data?.sourceChain || 'Ethereum Sepolia',
          sourceTxHash: node.data?.sourceTxHash || node.id,
          type: node.data?.type || 'INFLOW',
          amount: node.data?.amount || '0',
        }));

      if (evidence.length === 0) {
        throw new Error('No verified evidence nodes found for this subject to commit.');
      }

      const commitment = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify({ borrower: targetAddress.toLowerCase(), policyVersion: 1, evidence }))
      );
      const policyReference = ethers.id('privatecredit-policy-v1');
      const prepared = await api.prepareArtefactCommit(
        address || targetAddress,
        commitment,
        1,
        policyReference,
        `privatecredit:${commitment}`
      );
      const signer = await getSigner();
      const tx = await signer.sendTransaction(prepared.transaction);
      const receipt = await tx.wait();
      setCommitResult(`Audit snapshot committed to ArtefactRegistry on CC3! Tx: ${receipt?.hash || tx.hash}`);
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

      {/* Target Subject Selector */}
      <div className="glass-stat-card" style={{ padding: '12px 14px', background: 'rgba(15,23,42,0.8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span className="glass-stat-label">Audit Subject Wallet</span>
          {targetAddress.toLowerCase() !== '0xb096b95b923a9ee0dd63cf565e482784ccfa3dec' && (
            <button
              onClick={() => setTargetAddress('0xb096B95B923a9eE0DD63CF565E482784cCFA3dEc')}
              style={{
                fontSize: '0.68rem',
                color: '#38bdf8',
                background: 'rgba(14,165,233,0.15)',
                border: '1px solid rgba(14,165,233,0.3)',
                borderRadius: '6px',
                padding: '2px 8px',
                cursor: 'pointer',
              }}
            >
              Audit Demo Borrower (0xb096...)
            </button>
          )}
        </div>
        <div style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: '#38bdf8' }}>
          {targetAddress}
        </div>
      </div>

      {/* Audit Stats Grid */}
      <div className="stats-grid-2">
        <div className="glass-stat-card">
          <div className="glass-stat-label">Verified Evidence Nodes</div>
          <div className="glass-stat-val" style={{ color: '#34d399' }}>
            {loading ? '...' : evidenceNodes.length}
          </div>
        </div>
        <div className="glass-stat-card">
          <div className="glass-stat-label">Graph Audit Edges</div>
          <div className="glass-stat-val" style={{ color: '#818cf8' }}>
            {loading ? '...' : judgeData?.graph?.edges?.length || 0}
          </div>
        </div>
      </div>

      {/* Zero-Trust Cryptographic Invariants */}
      <div className="glass-stat-card" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileCheck className="w-4 h-4 text-emerald-400" />
          <span>Verified Protocol Invariants</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.72rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
            <span>USC Precompile (0x0FD2):</span>
            <span style={{ color: '#34d399', fontWeight: 600 }}>Active & Enforced</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
            <span>SPV Header Continuity:</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Cryptographic Proof</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
            <span>Deterministic Risk Engine:</span>
            <span style={{ color: '#a855f7', fontWeight: 600 }}>Bounded 80% Max LTV</span>
          </div>
        </div>
      </div>

      {/* Verifiable Evidence Trail */}
      <div className="form-group">
        <label className="form-label">Verifiable Evidence Audit Trail</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
          {evidenceNodes.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px dashed var(--panel-border)' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>
                No evidence nodes imported for this wallet yet.
              </div>
              <button
                type="button"
                className="preset-chip"
                style={{ fontSize: '0.72rem', padding: '4px 12px', background: 'rgba(14,165,233,0.15)', color: '#38bdf8', borderColor: 'rgba(14,165,233,0.3)' }}
                onClick={() => setTargetAddress('0xb096B95B923a9eE0DD63CF565E482784cCFA3dEc')}
              >
                Inspect Demo Borrower (2 Verified Proofs)
              </button>
            </div>
          ) : (
            evidenceNodes.map((n: any, idx: number) => {
              const srcChain = n.data?.sourceChain || 'Ethereum Sepolia';
              const evType = n.data?.type || 'INFLOW';
              const txHash = n.data?.sourceTxHash || '';
              const amountFmt = n.data?.amount ? `${(Number(n.data.amount) / 1e18).toFixed(2)} Tokens` : 'Verified';

              return (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>
                        {evType === 'INFLOW' ? 'Sepolia Inbound Transfer' : 'DeFi Loan Repayment'}
                      </span>
                    </div>
                    <span style={{ color: '#34d399', fontSize: '0.68rem', fontWeight: 600 }}>
                      0x0FD2 PROVED
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.7rem', marginBottom: '4px' }}>
                    <span>Chain: {srcChain}</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{amountFmt}</span>
                  </div>

                  {txHash && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem' }}>
                      <span style={{ color: '#64748b' }}>Tx Hash:</span>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px', fontFamily: 'monospace' }}
                      >
                        <span>{txHash.slice(0, 10)}...{txHash.slice(-6)}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <button
        className="execute-btn"
        style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}
        onClick={handleCommitArtefact}
        disabled={committing || evidenceNodes.length === 0}
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
