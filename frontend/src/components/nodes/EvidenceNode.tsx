import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export default function EvidenceNode({ data }: NodeProps) {
  const verified = data.verified !== false;
  const amount = data.amount ? `${(Number(data.amount) / 1e18).toFixed(2)} CTC` : '';
  
  return (
    <div className={`custom-node evidence-node ${verified ? 'verified' : 'pending'}`}>
      <Handle type="target" position={Position.Top} style={{ background: verified ? '#10b981' : '#f59e0b' }} />
      <div className="node-icon">{verified ? '✓' : '⏳'}</div>
      <div className="node-label">{data.type || 'EVIDENCE'}</div>
      {amount && <div className="node-value">{amount}</div>}
      <div className="node-chain">{data.sourceChain ? `Chain ${data.sourceChain}` : ''}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: verified ? '#10b981' : '#f59e0b' }} />
    </div>
  );
}
