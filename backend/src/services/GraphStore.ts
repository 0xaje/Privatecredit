import fs from 'fs';
import path from 'path';

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
  private filePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(storagePath?: string) {
    const dataDir = storagePath || path.resolve(process.cwd(), 'data');
    this.filePath = path.join(dataDir, 'graph-store.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.nodes)) {
          for (const node of parsed.nodes) {
            this.nodes.set(node.id, node);
          }
        }
        if (Array.isArray(parsed.edges)) {
          for (const edge of parsed.edges) {
            this.edges.set(edge.id, edge);
          }
        }
      }
    } catch {
      // Fall back to empty store if unreadable
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      try {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const data = {
          nodes: Array.from(this.nodes.values()),
          edges: Array.from(this.edges.values()),
        };
        fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
      } catch {
        // Silently skip write errors in read-only environments
      }
    }, 500);
  }

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    this.scheduleSave();
  }

  updateNode(id: string, patch: Partial<GraphNode>): GraphNode {
    const current = this.nodes.get(id);
    if (!current) throw new Error(`Node not found: ${id}`);
    const updated = { ...current, ...patch };
    this.nodes.set(id, updated);
    this.scheduleSave();
    return updated;
  }

  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
    this.scheduleSave();
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
