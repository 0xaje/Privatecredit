import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { formatUnits } from 'ethers';

export interface LoanNodeData {
  loanId?: string | number;
  principal?: string;
  aprBps?: number;
  status?: number | string;
  duration?: number;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  '0': { label: 'ACTIVE', color: '#38bdf8', bg: 'rgba(14,165,233,0.15)' },
  '1': { label: 'REPAID', color: '#34d399', bg: 'rgba(16,185,129,0.15)' },
  '2': { label: 'DEFAULTED', color: '#f43f5e', bg: 'rgba(244,63,94,0.15)' },
  ACTIVE: { label: 'ACTIVE', color: '#38bdf8', bg: 'rgba(14,165,233,0.15)' },
  REPAID: { label: 'REPAID', color: '#34d399', bg: 'rgba(16,185,129,0.15)' },
  DEFAULTED: { label: 'DEFAULTED', color: '#f43f5e', bg: 'rgba(244,63,94,0.15)' },
};

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

const LoanNode: React.FC<{ data: LoanNodeData; selected?: boolean }> = memo(({ data, selected }) => {
  const principalFmt = `${formatAmount(data.principal)} CTC`;
  const statusInfo = STATUS_MAP[String(data.status)] || STATUS_MAP['0'];
  const aprPct = data.aprBps ? `${(data.aprBps / 100).toFixed(1)}%` : '8.5%';

  return (
    <div className={`node-glass-card node-loan ${selected ? 'node-selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="custom-node-handle" />

      <div className="node-card-header">
        <div className="node-icon-wrapper loan-accent">
          <DollarSign className="w-4 h-4 text-pink-400" />
        </div>
        <div className="node-header-text">
          <span className="node-type-label">Loan Contract</span>
          <span className="node-title-code">ID #{data.loanId || '1'}</span>
        </div>
        <div
          className="node-status-badge"
          style={{ background: statusInfo.bg, color: statusInfo.color, borderColor: statusInfo.color }}
        >
          {statusInfo.label === 'REPAID' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          <span>{statusInfo.label}</span>
        </div>
      </div>

      <div className="node-card-body">
        <div className="node-stat-row">
          <span className="node-stat-label">Principal</span>
          <span className="node-stat-val text-pink-300 font-mono font-bold">{principalFmt}</span>
        </div>
        <div className="node-stat-row">
          <span className="node-stat-label">Fixed APR</span>
          <span className="node-stat-val text-slate-100 font-mono font-bold">{aprPct}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="custom-node-handle" />
    </div>
  );
});

LoanNode.displayName = 'LoanNode';
export default LoanNode;
