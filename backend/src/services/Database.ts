import fs from 'fs';
import path from 'path';

export interface IDatabaseAdapter {
  getNode(id: string): any | undefined;
  getAllNodes(): any[];
  setNode(id: string, node: any): void;
  deleteNode(id: string): boolean;
  getEdge(id: string): any | undefined;
  getAllEdges(): any[];
  setEdge(id: string, edge: any): void;
  getAuction(id: string): any | undefined;
  getAllAuctions(): any[];
  setAuction(id: string, auction: any): void;
  recordAuditEvent(eventType: string, actor: string, details: Record<string, any>): void;
  getAuditEvents(): any[];
  flushSync(): void;
}

export interface DatabaseSchema {
  nodes: Record<string, any>;
  edges: Record<string, any>;
  auctions: Record<string, any>;
  audit_events: Array<{
    id: string;
    timestamp: number;
    eventType: string;
    actor: string;
    details: Record<string, any>;
  }>;
}

const DEFAULT_SEED: DatabaseSchema = {
  nodes: {
    "wallet_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec": {
      "id": "wallet_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec",
      "type": "WALLET",
      "data": {
        "address": "0xb096B95B923a9eE0DD63CF565E482784cCFA3dEc",
        "balance": "37.9995917615",
        "network": "Creditcoin CC3 Testnet",
        "evidenceCount": 2,
        "eligible": true
      },
      "verified": true
    },
    "ev_0xb096_1": {
      "id": "ev_0xb096_1",
      "type": "EVIDENCE",
      "data": {
        "borrower": "0xb096B95B923a9eE0DD63CF565E482784cCFA3dEc",
        "type": "INFLOW",
        "amount": "12500000000000000000",
        "sourceChain": "Ethereum Sepolia",
        "sourceTxHash": "0x7a250d5630b4cf539739df2c5dacb4c659f2488d10c0e788734914c6dfac0c79",
        "creditcoinTxHash": "0x892a014bc089851cf298510c4915891ac4829104b29014bc491024bc01948291",
        "verified": true,
        "attestcoinRequestId": "req_usc_sepolia_inflow_01",
        "timestamp": 1725710400
      },
      "verified": true,
      "proofStatus": "VERIFIED"
    },
    "ev_0xb096_2": {
      "id": "ev_0xb096_2",
      "type": "EVIDENCE",
      "data": {
        "borrower": "0xb096B95B923a9eE0DD63CF565E482784cCFA3dEc",
        "type": "REPAYMENT",
        "amount": "5000000000000000000",
        "sourceChain": "Ethereum Sepolia",
        "sourceTxHash": "0x4b81920acb091823901490218940129410924091249012490129401249012490",
        "creditcoinTxHash": "0x3018249012941092401924019240192401924019240192401924019240192401",
        "verified": true,
        "attestcoinRequestId": "req_usc_sepolia_repay_02",
        "timestamp": 1725712200
      },
      "verified": true,
      "proofStatus": "VERIFIED"
    },
    "elig_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec": {
      "id": "elig_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec",
      "type": "ELIGIBILITY",
      "data": {
        "borrower": "0xb096B95B923a9eE0DD63CF565E482784cCFA3dEc",
        "riskTier": 0,
        "maxActiveCredit": "5000.0",
        "maxLtvBps": 6500,
        "ltvPct": 65,
        "validUntil": 1795907917,
        "policyVersion": 1
      },
      "verified": true
    },
    "loan_1": {
      "id": "loan_1",
      "type": "LOAN",
      "data": {
        "loanId": "1",
        "borrower": "0xb096B95B923a9eE0DD63CF565E482784cCFA3dEc",
        "lender": "0xbf6301D7bca9F23A63A2d1Ed513d5120Dbb2288E",
        "principal": "20.0",
        "collateral": "7.0",
        "aprPct": 7.5,
        "status": "ACTIVE"
      },
      "verified": true
    }
  },
  edges: {
    "edge_elig_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec": {
      "id": "edge_elig_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec",
      "source": "wallet_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec",
      "target": "elig_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec",
      "type": "ELIGIBILITY_FOR",
      "verified": true
    },
    "edge_ev1_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec": {
      "id": "edge_ev1_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec",
      "source": "ev_0xb096_1",
      "target": "wallet_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec",
      "type": "INFLOW_TO",
      "verified": true
    },
    "edge_ev2_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec": {
      "id": "edge_ev2_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec",
      "source": "ev_0xb096_2",
      "target": "wallet_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec",
      "type": "REPAID_BY",
      "verified": true
    },
    "edge_loan_1_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec": {
      "id": "edge_loan_1_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec",
      "source": "wallet_0xb096b95b923a9ee0dd63cf565e482784ccfa3dec",
      "target": "loan_1",
      "type": "CONSUMES_CAPACITY",
      "verified": true
    }
  },
  auctions: {},
  audit_events: []
};

export class Database {
  private filePath: string;
  private tempFilePath: string;
  private data: DatabaseSchema;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(customPath?: string) {
    const dataDir = customPath || path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'privatecredit-db.json');
    this.tempFilePath = path.join(dataDir, 'privatecredit-db.tmp');
    this.data = this.readFromDisk();
    // If no nodes, seed with DEFAULT_SEED
    if (Object.keys(this.data.nodes).length === 0) {
      this.data = JSON.parse(JSON.stringify(DEFAULT_SEED));
      this.flushSync();
    }
  }

  private readFromDisk(): DatabaseSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.nodes && Object.keys(parsed.nodes).length > 0) {
          return {
            nodes: parsed.nodes || {},
            edges: parsed.edges || {},
            auctions: parsed.auctions || {},
            audit_events: parsed.audit_events || [],
          };
        }
      }
    } catch (err) {
      console.warn('[Database] Warning: could not parse existing database, initializing fresh state.', err);
    }
    return JSON.parse(JSON.stringify(DEFAULT_SEED));
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushSync();
    }, 200);
  }

  public flushSync(): void {
    try {
      const payload = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(this.tempFilePath, payload, 'utf-8');
      fs.renameSync(this.tempFilePath, this.filePath);
    } catch (err) {
      console.error('[Database] Failed to write database file:', err);
    }
  }

  // Nodes
  public getNode(id: string): any | undefined {
    return this.data.nodes[id];
  }

  public getAllNodes(): any[] {
    return Object.values(this.data.nodes);
  }

  public setNode(id: string, node: any): void {
    this.data.nodes[id] = node;
    this.scheduleFlush();
  }

  public deleteNode(id: string): boolean {
    if (this.data.nodes[id]) {
      delete this.data.nodes[id];
      this.scheduleFlush();
      return true;
    }
    return false;
  }

  // Edges
  public getEdge(id: string): any | undefined {
    return this.data.edges[id];
  }

  public getAllEdges(): any[] {
    return Object.values(this.data.edges);
  }

  public setEdge(id: string, edge: any): void {
    this.data.edges[id] = edge;
    this.scheduleFlush();
  }

  // Auctions
  public getAuction(id: string): any | undefined {
    return this.data.auctions[id];
  }

  public getAllAuctions(): any[] {
    return Object.values(this.data.auctions);
  }

  public setAuction(id: string, auction: any): void {
    this.data.auctions[id] = auction;
    this.scheduleFlush();
  }

  // Audit Events
  public recordAuditEvent(eventType: string, actor: string, details: Record<string, any>): void {
    this.data.audit_events.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Math.floor(Date.now() / 1000),
      eventType,
      actor,
      details,
    });
    if (this.data.audit_events.length > 500) {
      this.data.audit_events = this.data.audit_events.slice(-500);
    }
    this.scheduleFlush();
  }

  public getAuditEvents(): any[] {
    return this.data.audit_events;
  }
}

export const database = new Database();
