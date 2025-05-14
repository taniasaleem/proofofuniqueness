import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  pingTimeout?: number;
  connectionTimeout?: number;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
}

export class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private reconnectAttempts: number = 0;
  private pingTimeout: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private isDisconnecting: boolean = false;

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      pingInterval: config.pingInterval || 30000,
      pingTimeout: config.pingTimeout || 5000,
      connectionTimeout: config.connectionTimeout || 10000,
    };
  }

  public connect(): void {
    if (this.isConnecting) {
      console.log('WebSocket already connecting, skipping connection attempt');
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.isConnecting = true;
    console.log('Attempting to connect to WebSocket...');

    try {
      this.ws = new WebSocket(this.config.url);

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          console.log('WebSocket connection timeout');
          this.handleError(new Error('Connection timeout'));
        }
      }, this.config.connectionTimeout);

      this.ws.on('open', this.handleOpen.bind(this));
      this.ws.on('message', this.handleMessage.bind(this));
      this.ws.on('close', this.handleClose.bind(this));
      this.ws.on('error', this.handleError.bind(this));
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.handleError(error as Error);
    }
  }

  public disconnect(): void {
    if (this.isDisconnecting) {
      console.log('WebSocket already disconnecting');
      return;
    }

    this.isDisconnecting = true;
    console.log('Disconnecting WebSocket...');

    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        console.error('Error during WebSocket disconnect:', error);
      }
    }
    this.cleanup();
  }

  public send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        this.handleError(error as Error);
      }
    } else {
      const error = new Error('WebSocket is not connected');
      console.warn(error.message);
      this.handleError(error);
    }
  }

  private handleOpen(): void {
    console.log('WebSocket connected successfully');
    this.isConnecting = false;
    this.isDisconnecting = false;
    this.reconnectAttempts = 0;
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.emit('connected');
    this.startPingInterval();
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      this.emit('message', message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.emit('error', new Error('Failed to parse message'));
    }
  }

  private handleClose(): void {
    console.log('WebSocket connection closed');
    this.cleanup();
    if (!this.isDisconnecting) {
      this.attemptReconnect();
    }
  }

  private handleError(error: Error): void {
    console.error('WebSocket error:', error.message);
    this.emit('error', error);
    this.cleanup();
    if (!this.isDisconnecting) {
      this.attemptReconnect();
    }
  }

  private cleanup(): void {
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = null;
    }

    this.isConnecting = false;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    // Calculate exponential backoff delay
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000 // Max delay of 30 seconds
    );

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}) in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPingInterval(): void {
    this.pingTimeout = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.send({ type: 'ping', payload: null });
        } catch (error) {
          console.error('Error sending ping:', error);
        }
      }
    }, this.config.pingInterval);
  }
} 