import { database } from './Database';
import { eventStream } from './EventStream';

export interface GraphNode {
  id: string;
  type: 'WALLET' | 'EVIDENCE' | 'ELIGIBILITY' | 'BORROW_REQUEST' | 'LOAN' | 'REPAYMENT' | 'AUCTION';
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
  type: 'INFLOW_TO' | 'REPAID_BY' | 'ELIGIBILITY_FOR' | 'BORROW_REQUESTED_BY' | 'FUNDED_BY' | 'COLLATERAL_FOR' | 'CONSUMES_CAPACITY' | 'AUCTIONED_FROM';
  verified: boolean;
}

export class GraphStore {
  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    const existing = database.getAllNodes();
    if (existing.length === 0) {
      this.seedDefaultProfiles();
    }
  }

  private seedDefaultProfiles(): void {
    // 1. Whale Profile
    const whale = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
    const wNodeId = `wallet_${whale}`;
    this.addNode({ id: wNodeId, type: 'WALLET', data: { address: whale, evidenceCount: 2, eligible: true }, verified: true });

    const ev1Id = `ev_whale_1`;
    this.addNode({
      id: ev1Id,
      type: 'EVIDENCE',
      data: {
        type: 'INFLOW',
        amount: '5000000000000000000',
        sourceChain: 'Ethereum Sepolia',
        sourceTxHash: '0x3aef91204859a1bc294857201948572019485720194857201948572019485720',
        verified: true,
        attestcoinRequestId: 'req_whale_inflow_1',
      },
      verified: true,
      proofStatus: 'VERIFIED',
    });
    this.addEdge({ id: `edge_w1`, source: wNodeId, target: ev1Id, type: 'INFLOW_TO', verified: true });

    const elWhale = `elig_whale`;
    this.addNode({
      id: elWhale,
      type: 'ELIGIBILITY',
      data: { riskTier: 0, maxActiveCredit: '10000000000000000000000', maxLtvBps: 6500, validUntil: Math.floor(Date.now() / 1000) + 2592000, policyVersion: 1 },
      verified: true,
    });
    this.addEdge({ id: `edge_w3`, source: wNodeId, target: elWhale, type: 'ELIGIBILITY_FOR', verified: true });
  }

  addNode(node: GraphNode): void {
    database.setNode(node.id, node);
    eventStream.broadcast('NODE_ADDED', node);
  }

  updateNode(id: string, patch: Partial<GraphNode>): GraphNode {
    const current = database.getNode(id);
    if (!current) throw new Error(`Node not found: ${id}`);
    const updated = { ...current, ...patch };
    database.setNode(id, updated);
    eventStream.broadcast('NODE_UPDATED', updated);
    return updated;
  }

  addEdge(edge: GraphEdge): void {
    database.setEdge(edge.id, edge);
    eventStream.broadcast('EDGE_ADDED', edge);
  }

  getNode(id: string): GraphNode | undefined {
    return database.getNode(id);
  }

  getAllNodes(): GraphNode[] {
    return database.getAllNodes();
  }

  getAllEdges(): GraphEdge[] {
    return database.getAllEdges();
  }

  getGraphForBorrower(borrower: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const borrowerNodeId = `wallet_${borrower.toLowerCase()}`;
    const connectedNodeIds = new Set<string>([borrowerNodeId]);
    const relevantEdges: GraphEdge[] = [];

    const allEdges = database.getAllEdges();
    for (const edge of allEdges) {
      if (edge.source === borrowerNodeId || edge.target === borrowerNodeId) {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
        relevantEdges.push(edge);
      }
    }

    return {
      nodes: [...connectedNodeIds].map(id => database.getNode(id)).filter(Boolean) as GraphNode[],
      edges: relevantEdges,
    };
  }
}

export const graphStore = new GraphStore();
