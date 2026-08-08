import { useState, useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import type { Node, Edge, Connection } from 'reactflow';
import 'reactflow/dist/style.css';

import WalletNode from './nodes/WalletNode';
import EvidenceNode from './nodes/EvidenceNode';
import EligibilityNode from './nodes/EligibilityNode';
import LoanNode from './nodes/LoanNode';
import { api } from '../api/client';

// Backend node type → ReactFlow custom node type
const TYPE_MAP: Record<string, string> = {
  WALLET: 'wallet',
  EVIDENCE: 'evidence',
  ELIGIBILITY: 'eligibility',
  BORROW_REQUEST: 'loan',
  LOAN: 'loan',
  REPAYMENT: 'evidence',
};

// Radial layout: wallet at center, others in rings
function autoLayout(backendNodes: any[]): Node[] {
  const wallet = backendNodes.find(n => n.type === 'WALLET');
  const others = backendNodes.filter(n => n.type !== 'WALLET');

  const result: Node[] = [];
  const cx = 400, cy = 300;

  if (wallet) {
    result.push({
      id: wallet.id,
      type: 'wallet',
      position: { x: cx, y: cy },
      data: { ...wallet.data, nodeType: 'wallet', evidenceCount: others.length },
    });
  }

  // Place others in a circle
  const radius = 250;
  others.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(others.length, 1) - Math.PI / 2;
    const rfType = TYPE_MAP[n.type] || 'default';
    result.push({
      id: n.id,
      type: rfType,
      position: {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      },
      data: {
        ...n.data,
        nodeType: rfType,
        verified: n.verified,
        attestcoinRef: n.attestcoinRef,
        creditcoinTxHash: n.creditcoinTxHash,
      },
    });
  });

  return result;
}

const EDGE_COLORS: Record<string, string> = {
  INFLOW_TO: '#10b981',
  REPAID_BY: '#3b82f6',
  ELIGIBILITY_FOR: '#8b5cf6',
  FUNDED_BY: '#ec4899',
  COLLATERAL_FOR: '#f59e0b',
  CONSUMES_CAPACITY: '#ef4444',
};

function mapEdges(backendEdges: any[]): Edge[] {
  return backendEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: true,
    style: {
      stroke: EDGE_COLORS[e.type] || '#6b7280',
      strokeWidth: 2,
    },
    label: e.type?.replace(/_/g, ' '),
    labelStyle: { fill: '#9ca3af', fontSize: 10, fontFamily: 'Outfit' },
    labelBgStyle: { fill: 'rgba(3, 7, 18, 0.8)' },
  }));
}

interface GraphCanvasProps {
  borrowerAddress: string | null;
  onNodeSelect: (node: Node | null) => void;
  refreshTrigger?: number;
}

export default function GraphCanvas({ borrowerAddress, onNodeSelect, refreshTrigger }: GraphCanvasProps) {
  const nodeTypes = useMemo(() => ({
    wallet: WalletNode,
    evidence: EvidenceNode,
    eligibility: EligibilityNode,
    loan: LoanNode,
  }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Fetch graph data from backend
  useEffect(() => {
    if (!borrowerAddress) {
      setNodes([]);
      setEdges([]);
      return;
    }

    setLoading(true);
    api.getGraph(borrowerAddress)
      .then((graphData: any) => {
        const rfNodes = autoLayout(graphData.nodes || []);
        const rfEdges = mapEdges(graphData.edges || []);
        setNodes(rfNodes);
        setEdges(rfEdges);
      })
      .catch((err: any) => {
        console.warn('Graph fetch failed (backend may be offline):', err.message);
        // Show a placeholder wallet node
        setNodes([{
          id: 'wallet-placeholder',
          type: 'wallet',
          position: { x: 400, y: 300 },
          data: { address: borrowerAddress, nodeType: 'wallet', evidenceCount: 0 },
        }]);
        setEdges([]);
      })
      .finally(() => setLoading(false));
  }, [borrowerAddress, refreshTrigger, setNodes, setEdges]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    onNodeSelect(node);
  };

  const handlePaneClick = () => {
    onNodeSelect(null);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {loading && (
        <div className="graph-loading">
          <div className="loading-spinner" />
          <span>Loading graph...</span>
        </div>
      )}
      {!borrowerAddress && (
        <div className="graph-empty">
          <div className="graph-empty-icon">◇</div>
          <h3>Connect a Wallet</h3>
          <p>Connect your wallet to view and build your credit graph.</p>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Controls style={{ fill: '#818cf8', backgroundColor: 'rgba(17, 24, 39, 0.8)', border: '1px solid rgba(129, 140, 248, 0.2)' }} />
        <MiniMap
          nodeColor={(n) => {
            const colors: Record<string, string> = { wallet: '#818cf8', evidence: '#10b981', eligibility: '#8b5cf6', loan: '#ec4899' };
            return colors[n.type || ''] || '#6b7280';
          }}
          maskColor="rgba(3, 7, 18, 0.7)"
          style={{ backgroundColor: 'rgba(17, 24, 39, 0.8)', border: '1px solid rgba(129, 140, 248, 0.2)', borderRadius: '8px' }}
        />
        <Background color="#374151" gap={24} size={1.5} />
      </ReactFlow>
    </div>
  );
}
