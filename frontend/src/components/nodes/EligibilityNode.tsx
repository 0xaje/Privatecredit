import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Award, CheckCircle } from 'lucide-react';
import { formatUnits } from 'ethers';

export interface EligibilityNodeData {
  riskTier: number;
  maxActiveCredit: string;
  maxLtvBps: number;
  validUntil?: number;
  policyVersion?: number;
}

const TIER_NAMES: Record<number, string> = { 0: 'Tier 1 (AAA)', 1: 'Tier 2 (AA)', 2: 'Tier 3 (B)' };
const TIER_COLORS: Record<number, string> = { 0: '#10b981', 1: '#0ea5e9', 2: '#f59e0b' };

function formatAmount(val: any): string {
  if (!val) return '0';
  if (typeof val === 'string' && val.includes('.')) {
    const num = parseFloat(val);
    return isNaN(num) ? '0' : num.toFixed(0);
  }
  try {
    return Number(formatUnits(val, 18)).toFixed(0);
  } catch {
    const num = parseFloat(String(val));
    return isNaN(num) ? '0' : num.toFixed(0);
  }
}

const EligibilityNode: React.FC<{ data: EligibilityNodeData; selected?: boolean }> = memo(({ data, selected }) => {
  const tierName = TIER_NAMES[data.riskTier] || `Tier ${data.riskTier}`;
  const tierColor = TIER_COLORS[data.riskTier] || '#8b5cf6';
  const creditFmt = `${formatAmount(data.maxActiveCredit)} CTC`;
  const ltvPct = data.maxLtvBps ? `${(data.maxLtvBps / 100).toFixed(0)}%` : '0%';

  return (
    <div className={`node-glass-card node-eligibility ${selected ? 'node-selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="custom-node-handle" />

      <div className="node-card-header">
        <div className="node-icon-wrapper eligibility-accent">
          <Award className="w-4 h-4 text-purple-400" />
        </div>
        <div className="node-header-text">
          <span className="node-type-label">Credit Rating Badge</span>
          <span className="node-title-code" style={{ color: tierColor, fontWeight: 800 }}>{tierName}</span>
        </div>
        <div className="node-status-badge verified" style={{ background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.3)', color: '#c084fc' }}>
          <CheckCircle className="w-3 h-3" />
          <span>ASC Badge</span>
        </div>
      </div>

      <div className="node-card-body">
        <div className="node-stat-row">
          <span className="node-stat-label">Credit Limit</span>
          <span className="node-stat-val text-purple-300 font-mono font-bold">{creditFmt}</span>
        </div>
        <div className="node-stat-row">
          <span className="node-stat-label">Maximum LTV</span>
          <span className="node-stat-val text-slate-100 font-mono font-bold">{ltvPct}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="custom-node-handle" />
    </div>
  );
});

EligibilityNode.displayName = 'EligibilityNode';
export default EligibilityNode;
