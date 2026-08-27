import { Response } from 'express';
import { EventEmitter } from 'events';

export interface AppEvent {
  type: 'NODE_UPDATED' | 'NODE_ADDED' | 'EDGE_ADDED' | 'AUCTION_UPDATED' | 'PROOF_STATUS' | 'AUDIT_RECORDED';
  data: any;
  timestamp: number;
}

class EventStreamService extends EventEmitter {
  private clients: Set<Response> = new Set();

  constructor() {
    super();
  }

  public registerClient(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial ping/connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

    this.clients.add(res);

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  public broadcast(type: AppEvent['type'], data: any): void {
    const event: AppEvent = {
      type,
      data,
      timestamp: Date.now(),
    };

    const payload = `data: ${JSON.stringify(event)}\n\n`;

    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const eventStream = new EventStreamService();
