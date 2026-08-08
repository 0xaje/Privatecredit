import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

const tierLabels: Record<number, string> = { 0: 'LOW', 1: 'MEDIUM', 2: 'HIGH' };
const tierColors: Record<number, string> = { 0: '#10b981', 1: '#f59e0b', 2: '#ef4444' };

export default function EligibilityNode({ data }: NodeProps) {
  const tier = tierLabels[data.riskTier] || data.riskTier || '?';
  const tierColor = tierColors[data.riskTier] || '#8b5cf6';
  const maxCredit = data.maxActiveCredit ? `${(Number(data.maxActiveCredit) / 1e18).toFixed(0)} CTC` : '';
  const ltvPct = data.maxLtvBps ? `${(data.maxLtvBps / 100).toFixed(0)}%` : '';
  
  return (
    <div className="custom-node eligibility-node">
      <Handle type="target" position={Position.Top} style={{ background: '#8b5cf6' }} />
      <div className="node-icon">⬡</div>
      <div className="node-label">ELIGIBILITY</div>
      <div className="node-badge" style={{ background: tierColor }}>{tier} RISK</div>
      {maxCredit && <div className="node-value">Max: {maxCredit}</div>}
      {ltvPct && <div className="node-detail">LTV: {ltvPct}</div>}
      <Handle type="source" position={Position.Bottom} style={{ background: '#8b5cf6' }} />
    </div>
  );
}
