import { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection
} from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes: Node[] = [
  {
    id: 'wallet',
    type: 'default',
    data: { label: 'Borrower Wallet' },
    position: { x: 250, y: 150 },
    style: {
      background: 'rgba(30, 41, 59, 0.7)',
      backdropFilter: 'blur(12px)',
      color: '#f8fafc',
      border: '1px solid rgba(129, 140, 248, 0.5)',
      borderRadius: '12px',
      padding: '16px 24px',
      fontSize: '1rem',
      fontWeight: '600',
      boxShadow: '0 8px 32px 0 rgba(129, 140, 248, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
      textTransform: 'uppercase',
      letterSpacing: '1px'
    }
  },
];

const initialEdges: Edge[] = [];

interface GraphCanvasProps {
  onNodeSelect: (node: Node | null) => void;
}

export default function GraphCanvas({ onNodeSelect }: GraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    onNodeSelect(node);
  };

  const handlePaneClick = () => {
    onNodeSelect(null);
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
      >
        <Controls style={{ fill: '#818cf8', backgroundColor: 'rgba(17, 24, 39, 0.8)', border: '1px solid rgba(129, 140, 248, 0.2)' }} />
        <MiniMap 
          nodeColor={(n) => {
            if (n.style?.background?.includes('129')) return '#818cf8';
            return '#10b981';
          }}
          maskColor="rgba(3, 7, 18, 0.7)"
          style={{ backgroundColor: 'rgba(17, 24, 39, 0.8)', border: '1px solid rgba(129, 140, 248, 0.2)', borderRadius: '8px' }}
        />
        <Background color="#374151" gap={24} size={1.5} />
      </ReactFlow>
    </div>
  );
}
