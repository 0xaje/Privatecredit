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
        if (this.nodes.size === 0) {
          this.seedDemoProfiles();
        }
      } else {
        this.seedDemoProfiles();
      }
    } catch {
      this.seedDemoProfiles();
    }
  }

  private seedDemoProfiles(): void {
    // 1. Whale / Veteran Borrower (0x71C7...)
    const whale = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
    const wNodeId = `wallet_${whale}`;
    this.nodes.set(wNodeId, { id: wNodeId, type: 'WALLET', data: { address: whale, evidenceCount: 3, eligible: true }, verified: true });

    const ev1Id = `ev_whale_1`;
    this.nodes.set(ev1Id, { id: ev1Id, type: 'EVIDENCE', data: { type: 'INFLOW', amount: '5000000000000000000', sourceChain: 'Ethereum Mainnet', sourceTxHash: '0x3aef91204859a1bc294857201948572019485720194857201948572019485720', verified: true, attestcoinRequestId: 'req_whale_inflow_1' }, verified: true });
    this.edges.set(`edge_w1`, { id: `edge_w1`, source: wNodeId, target: ev1Id, type: 'INFLOW_TO', verified: true });

    const ev2Id = `ev_whale_2`;
    this.nodes.set(ev2Id, { id: ev2Id, type: 'EVIDENCE', data: { type: 'REPAYMENT', amount: '3000000000000000000', sourceChain: 'Arbitrum One', sourceTxHash: '0x9928374829104857201948572019485720194857201948572019485720194857', verified: true, attestcoinRequestId: 'req_whale_repay_1' }, verified: true });
    this.edges.set(`edge_w2`, { id: `edge_w2`, source: wNodeId, target: ev2Id, type: 'REPAID_BY', verified: true });

    const elWhale = `elig_whale`;
    this.nodes.set(elWhale, { id: elWhale, type: 'ELIGIBILITY', data: { riskTier: 0, maxActiveCredit: '10000000000000000000000', maxLtvBps: 6500, validUntil: Math.floor(Date.now() / 1000) + 2592000, policyVersion: 1 }, verified: true });
    this.edges.set(`edge_w3`, { id: `edge_w3`, source: wNodeId, target: elWhale, type: 'ELIGIBILITY_FOR', verified: true });

    // 2. New Borrower (0x1111...)
    const newb = '0x1111111111111111111111111111111111111111';
    const nNodeId = `wallet_${newb}`;
    this.nodes.set(nNodeId, { id: nNodeId, type: 'WALLET', data: { address: newb, evidenceCount: 1, eligible: true }, verified: true });
    const evNewId = `ev_new_1`;
    this.nodes.set(evNewId, { id: evNewId, type: 'EVIDENCE', data: { type: 'INFLOW', amount: '1000000000000000000', sourceChain: 'Ethereum Sepolia', sourceTxHash: '0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff', verified: true, attestcoinRequestId: 'req_new_inflow' }, verified: true });
    this.edges.set(`edge_n1`, { id: `edge_n1`, source: nNodeId, target: evNewId, type: 'INFLOW_TO', verified: true });

    // 3. High-Risk Borrower (0x9999...)
    const risk = '0x9999999999999999999999999999999999999999';
    const rNodeId = `wallet_${risk}`;
    this.nodes.set(rNodeId, { id: rNodeId, type: 'WALLET', data: { address: risk, evidenceCount: 1, eligible: false }, verified: true });
    const evRiskId = `ev_risk_1`;
    this.nodes.set(evRiskId, { id: evRiskId, type: 'EVIDENCE', data: { type: 'OBLIGATION', amount: '2000000000000000000', sourceChain: 'Polygon', sourceTxHash: '0x99887766554433221100ffeeddccbbaa99887766554433221100ffeeddccbbaa', verified: false, attestcoinRequestId: 'req_risk_obligation' }, verified: false });
    this.edges.set(`edge_r1`, { id: `edge_r1`, source: rNodeId, target: evRiskId, type: 'INFLOW_TO', verified: false });

    this.scheduleSave();
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
