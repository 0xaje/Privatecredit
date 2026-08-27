import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { User, ShieldCheck } from 'lucide-react';

export interface WalletNodeData {
  address: string;
  evidenceCount?: number;
  eligible?: boolean;
}

const WalletNode: React.FC<{ data: WalletNodeData; selected?: boolean }> = memo(({ data, selected }) => {
  const addr = data.address || '0x0000...0000';
  const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className={`node-glass-card node-wallet ${selected ? 'node-selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="custom-node-handle" />

      <div className="node-card-header">
        <div className="node-icon-wrapper wallet-accent">
          <User className="w-4 h-4 text-sky-400" />
        </div>
        <div className="node-header-text">
          <span className="node-type-label">Borrower Identity</span>
          <span className="node-title-code">{shortAddr}</span>
        </div>
        <div className="node-status-badge verified">
          <ShieldCheck className="w-3 h-3" />
          <span>Active</span>
        </div>
      </div>

      <div className="node-card-body">
        <div className="node-stat-row">
          <span className="node-stat-label">Verified Evidence</span>
          <span className="node-stat-val">{data.evidenceCount || 0} Linked</span>
        </div>
        <div className="node-stat-row">
          <span className="node-stat-label">Underwriting Status</span>
          <span className="node-stat-val" style={{ color: data.eligible ? '#34d399' : '#94a3b8' }}>
            {data.eligible ? 'Approved' : 'Assessing'}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="custom-node-handle" />
    </div>
  );
});

WalletNode.displayName = 'WalletNode';
export default WalletNode;
