import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export default function WalletNode({ data }: NodeProps) {
  const addr = data.address || '0x???';
  const short = `${addr.slice(0,6)}...${addr.slice(-4)}`;
  
  return (
    <div className="custom-node wallet-node">
      <Handle type="target" position={Position.Top} style={{ background: '#818cf8' }} />
      <div className="node-icon">◆</div>
      <div className="node-label">WALLET</div>
      <div className="node-value">{short}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#818cf8' }} />
    </div>
  );
}
