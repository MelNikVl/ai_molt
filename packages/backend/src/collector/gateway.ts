import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import type { DbQueries } from '../db/queries.js';
import { parseGatewayPayload } from './parser.js';

export class GatewayCollector extends EventEmitter {
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectDelay = 1000;

  constructor(private readonly gatewayUrl: string, private readonly db: DbQueries) {
    super();
  }

  isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket(this.gatewayUrl);

    this.ws.on('open', () => {
      this.connected = true;
      this.reconnectDelay = 1000;
      this.emit('status', { connected: true });
    });

    this.ws.on('message', (data) => {
      const payload = data.toString();
      const parsed = parseGatewayPayload(payload);
      this.db.insertEvent(parsed);
      this.emit('event', parsed);
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.emit('status', { connected: false });
      this.scheduleReconnect();
    });

    this.ws.on('error', () => {
      this.connected = false;
      this.emit('status', { connected: false });
      this.ws?.close();
    });
  }

  private scheduleReconnect(): void {
    const delay = this.reconnectDelay;
    setTimeout(() => this.connect(), delay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }
}
