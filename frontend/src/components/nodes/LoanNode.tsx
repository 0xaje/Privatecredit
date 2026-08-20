import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

const statusLabels: Record<number, string> = { 0: 'ACTIVE', 1: 'REPAID', 2: 'DEFAULTED' };
const statusColors: Record<number, string> = { 0: '#10b981', 1: '#3b82f6', 2: '#ef4444' };

export default function LoanNode({ data }: NodeProps) {
  const principal = data.principal ? `${(Number(data.principal) / 1e18).toFixed(2)} CTC` : '';
  const status = statusLabels[data.status] || 'UNKNOWN';
  const statusColor = statusColors[data.status] || '#9ca3af';
  const aprPct = data.aprBps ? `${(data.aprBps / 100).toFixed(1)}%` : '';
  
  return (
    <div className="custom-node loan-node">
      <Handle type="target" position={Position.Top} style={{ background: '#ec4899' }} />
      <div className="node-label">ACTIVE LOAN</div>
      <div className="node-badge" style={{ background: statusColor }}>{status}</div>
      {principal && <div className="node-value">{principal}</div>}
      {aprPct && <div className="node-detail">APR: {aprPct}</div>}
      <Handle type="source" position={Position.Bottom} style={{ background: '#ec4899' }} />
    </div>
  );
}
