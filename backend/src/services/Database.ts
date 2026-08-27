import fs from 'fs';
import path from 'path';

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
  }

  private readFromDisk(): DatabaseSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          nodes: parsed.nodes || {},
          edges: parsed.edges || {},
          auctions: parsed.auctions || {},
          audit_events: parsed.audit_events || [],
        };
      }
    } catch (err) {
      console.warn('[Database] Warning: could not parse existing database, initializing fresh state.', err);
    }
    return {
      nodes: {},
      edges: {},
      auctions: {},
      audit_events: [],
    };
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
