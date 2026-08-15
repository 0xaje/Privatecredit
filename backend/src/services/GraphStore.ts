export interface GraphNode {
  id: string;
  type: 'WALLET' | 'EVIDENCE' | 'ELIGIBILITY' | 'BORROW_REQUEST' | 'LOAN' | 'REPAYMENT';
  data: Record<string, any>;
  verified: boolean;
  proofStatus?: 'PENDING_ATTESTATION' | 'PROOF_GENERATING' | 'PROOF_READY' | 'SUBMITTING' | 'VERIFIED' | 'FAILED' | 'UNSUPPORTED';
  uscEvidenceId?: string;
  sourceChainKey?: number;
  sourceBlock?: number;
  attestcoinRef?: string;
  creditcoinTxHash?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'INFLOW_TO' | 'REPAID_BY' | 'ELIGIBILITY_FOR' | 'BORROW_REQUESTED_BY' | 'FUNDED_BY' | 'COLLATERAL_FOR' | 'CONSUMES_CAPACITY';
  verified: boolean;
}

export class GraphStore {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  updateNode(id: string, patch: Partial<GraphNode>): GraphNode {
    const current = this.nodes.get(id);
    if (!current) throw new Error(`Node not found: ${id}`);
    const updated = { ...current, ...patch };
    this.nodes.set(id, updated);
    return updated;
  }

  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getGraphForBorrower(borrower: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const borrowerNodeId = `wallet_${borrower.toLowerCase()}`;
    const connectedNodeIds = new Set<string>([borrowerNodeId]);
    const relevantEdges: GraphEdge[] = [];

    for (const edge of this.edges.values()) {
      if (edge.source === borrowerNodeId || edge.target === borrowerNodeId) {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
        relevantEdges.push(edge);
      }
    }

    return {
      nodes: [...connectedNodeIds].map(id => this.nodes.get(id)).filter(Boolean) as GraphNode[],
      edges: relevantEdges,
    };
  }
}

export const graphStore = new GraphStore();
