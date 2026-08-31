import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { ArrowDownLeft, ShieldCheck, Clock } from 'lucide-react';
import { formatUnits } from 'ethers';

export interface EvidenceNodeData {
  type: 'INFLOW' | 'REPAYMENT' | 'OBLIGATION';
  amount?: string;
  sourceChain?: string;
  sourceTxHash?: string;
  verified?: boolean;
}

function formatAmount(val: any): string {
  if (!val) return '0.00';
  if (typeof val === 'string' && val.includes('.')) {
    const num = parseFloat(val);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  }
  try {
    return Number(formatUnits(val, 18)).toFixed(2);
  } catch {
    const num = parseFloat(String(val));
    return isNaN(num) ? '0.00' : num.toFixed(2);
  }
}

const EvidenceNode: React.FC<{ data: EvidenceNodeData; selected?: boolean }> = memo(({ data, selected }) => {
  const isVerified = data.verified !== false;
  const amountFmt = formatAmount(data.amount);
  const typeLabel = data.type === 'INFLOW' ? 'Cash Inflow' : data.type === 'REPAYMENT' ? 'Repayment Track' : 'Obligation';

  return (
    <div className={`node-glass-card node-evidence ${isVerified ? 'verified-border' : 'pending-border'} ${selected ? 'node-selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="custom-node-handle" />

      <div className="node-card-header">
        <div className={`node-icon-wrapper ${isVerified ? 'evidence-accent' : 'pending-accent'}`}>
          <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="node-header-text">
          <span className="node-type-label">{typeLabel}</span>
          <span className="node-title-code">{data.sourceChain || 'Sepolia (11155111)'}</span>
        </div>
        <div className={`node-status-badge ${isVerified ? 'verified' : 'pending'}`}>
          {isVerified ? <ShieldCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          <span>{isVerified ? 'Proved' : 'Pending'}</span>
        </div>
      </div>

      <div className="node-card-body">
        <div className="node-stat-row">
          <span className="node-stat-label">Transfer Volume</span>
          <span className="node-stat-val text-emerald-400 font-mono">+{amountFmt} CTC</span>
        </div>
        <div className="node-stat-row">
          <span className="node-stat-label">Block Prover</span>
          <span className="node-stat-val text-slate-300 font-mono text-[10px]">0x0FD2 Native</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="custom-node-handle" />
    </div>
  );
});

EvidenceNode.displayName = 'EvidenceNode';
export default EvidenceNode;
