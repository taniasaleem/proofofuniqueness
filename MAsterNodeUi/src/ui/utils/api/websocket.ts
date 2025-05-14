// Use browser WebSocket in browser environment, ws in Node.js
const WebSocketImpl = typeof window !== 'undefined' ? window.WebSocket : require('ws').WebSocket;

// Handle crypto in both Node.js and browser environments
let createHash: (algorithm: string) => any;
if (typeof window === 'undefined') {
  // Node.js environment
  const crypto = require('crypto');
  createHash = crypto.createHash;
} else {
  // Browser environment - use Web Crypto API
  createHash = (algorithm: string) => {
    return {
      update: (data: string) => {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        return {
          digest: async (format: string) => {
            const hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          }
        };
      }
    };
  };
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  clientId?: string;
}

export class WebSocketService {
  private ws: typeof WebSocketImpl | null = null;
  private messageHandlers: Map<string, Set<((data: any) => void)>> = new Map();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000; // 1 second
  private reconnectTimeout: NodeJS.Timeout | undefined;
  private clientId: string | null = null;
  private messageQueue: Array<{ type: string; data: any }> = [];
  private isReady = false;

  constructor(private url: string) {
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocketImpl(this.url);
      console.log('WebSocket connecting...');
      this.isReady = false;

      this.ws.onopen = () => {
        console.log('WebSocket connection established, waiting for client ID...');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received WebSocket message:', {
            type: message.type,
            clientId: message.clientId,
            data: message.data
          });

          // Handle connection message to get client ID
          if (message.type === 'connection' && message.data?.clientId) {
            this.clientId = message.data.clientId;
            this.isReady = true;
            console.log('Client ID assigned:', this.clientId);
            // Process any queued messages
            this.processMessageQueue();
          }

          // Handle other messages
          const handlers = this.messageHandlers.get(message.type);
          if (handlers) {
            handlers.forEach(handler => handler(message.data));
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed, client ID:', this.clientId);
        this.clientId = null;
        this.isReady = false;
        this.handleReconnect();
      };

      this.ws.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
        this.clientId = null;
        this.isReady = false;
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.handleReconnect();
    }
  }

  private processMessageQueue() {
    if (!this.isReady || !this.clientId) {
      console.log('Not ready to process message queue');
      return;
    }

    console.log(`Processing ${this.messageQueue.length} queued messages`);
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessageInternal(message.type, message.data);
      }
    }
  }

  private sendMessageInternal(type: string, data: any) {
    if (!this.ws || this.ws.readyState !== WebSocketImpl.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    if (!this.clientId) {
      throw new Error('Client ID not assigned yet');
    }

    const message = {
      type,
      data,
      timestamp: Date.now(),
      clientId: this.clientId
    };

    console.log('Sending WebSocket message:', {
      type: message.type,
      clientId: message.clientId,
      data: message.data
    });

    this.ws.send(JSON.stringify(message));
  }

  public sendMessage(type: string, data: any) {
    if (!this.isReady || !this.clientId) {
      console.log('WebSocket not ready, queueing message:', { type, data });
      this.messageQueue.push({ type, data });
      return;
    }

    this.sendMessageInternal(type, data);
  }

  public onMessage(type: string, handler: (data: any) => void) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)?.add(handler);
  }

  public removeMessageHandler(type: string, handler?: (data: any) => void) {
    if (handler) {
      this.messageHandlers.get(type)?.delete(handler);
    } else {
      this.messageHandlers.delete(type);
    }
  }

  public close() {
    if (this.ws) {
      console.log('Closing WebSocket connection, client ID:', this.clientId);
      this.ws.close();
      this.ws = null;
    }
    // Clear all message handlers
    this.messageHandlers.clear();
    this.reconnectAttempts = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    this.clientId = null;
  }

  // Public method for testing purposes
  public simulateMessage(type: string, data: any) {
    const event = {
      data: JSON.stringify({
        type,
        data,
        timestamp: Date.now()
      })
    };
    if (this.ws && this.ws.onmessage) {
      this.ws.onmessage(event);
    }
  }

  // Public method for testing purposes
  public setReadyState(state: number) {
    if (this.ws) {
      this.ws.readyState = state;
    }
  }

  public isConnected(): boolean {
    const connected = this.ws?.readyState === WebSocketImpl.OPEN && this.isReady && this.clientId !== null;
    console.log('Connection status:', {
      wsState: this.ws?.readyState,
      clientId: this.clientId,
      isReady: this.isReady,
      connected,
      queuedMessages: this.messageQueue.length
    });
    return connected;
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.reconnectTimeout = setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    }
  }

  // Add getter for clientId
  public getClientId(): string | null {
    return this.clientId;
  }
}

// Create a singleton instance
export const wsService = new WebSocketService('ws://localhost:8080/ws');

// Define response types
export interface ChainInfo {
  fee: number;
  height: number;
  latestBlockHash: string;
  accounts: number;
  currentSupply: number;
  peers: number;
}

export interface ChainSupply {
  maxSupply: number;
  currentSupply: number;
  blockReward: number;
  nextHalvingBlock: number;
}

export interface SyncResponse {
  message: string;
  success: boolean;
}

export interface TokenHash {
  hash: string;
  serialNumber: string;
  timestamp: number;
  verifiedBy?: string[];
}

export interface TokenVerificationResponse {
  isValid: boolean;
  verifiedBy: string[];
  message?: string;
}

export interface ErrorResponse {
  error: string;
}

// Blockchain API functions using WebSocket
export const blockchainAPI = {
  // Connection status
  isConnected: () => {
    return wsService.isConnected();
  },

  // Node Management
  getAllNodes: () => {
    return new Promise<any>((resolve, reject) => {
      if (!wsService.isConnected()) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const handler = (data: any) => {
        wsService.removeMessageHandler('nodes-response');
        resolve(data);
      };
      wsService.onMessage('nodes-response', handler);
      wsService.sendMessage('get-nodes', {});
    });
  },

  addNode: (nodeData: any) => {
    return new Promise<any>((resolve, reject) => {
      if (!wsService.isConnected()) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const handler = (data: any) => {
        wsService.removeMessageHandler('node-added');
        resolve(data);
      };
      wsService.onMessage('node-added', handler);
      wsService.sendMessage('add-node', nodeData);
    });
  },

  // Chain Operations
  getChainInfo: () => {
    return new Promise<ChainInfo>((resolve, reject) => {
      if (!wsService.isConnected()) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const handler = (data: ChainInfo) => {
        wsService.removeMessageHandler('chain-info');
        resolve(data);
      };
      wsService.onMessage('chain-info', handler);
      wsService.sendMessage('get-chain-info', {});
    });
  },

  getSupplyInfo: () => {
    return new Promise<ChainSupply>((resolve, reject) => {
      if (!wsService.isConnected()) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const handler = (data: ChainSupply) => {
        wsService.removeMessageHandler('supply-info');
        resolve(data);
      };
      wsService.onMessage('supply-info', handler);
      wsService.sendMessage('get-supply-info', {});
    });
  },

  // Transaction Operations
  createTransaction: (transactionData: any) => {
    return new Promise<any>((resolve, reject) => {
      if (!wsService.isConnected()) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const handler = (data: any) => {
        wsService.removeMessageHandler('transaction-created');
        resolve(data);
      };
      wsService.onMessage('transaction-created', handler);
      wsService.sendMessage('create-transaction', transactionData);
    });
  },

  getAddressBalance: (address: string) => {
    return new Promise<any>((resolve, reject) => {
      if (!wsService.isConnected()) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const handler = (data: any) => {
        wsService.removeMessageHandler('balance-response');
        resolve(data);
      };
      wsService.onMessage('balance-response', handler);
      wsService.sendMessage('get-balance', { address });
    });
  },

  // Block Operations
  verifyBlockHash: (hash: string) => {
    return new Promise<any>((resolve, reject) => {
      if (!wsService.isConnected()) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const handler = (data: any) => {
        wsService.removeMessageHandler('block-verification');
        resolve(data);
      };
      wsService.onMessage('block-verification', handler);
      wsService.sendMessage('verify-block', { hash });
    });
  },

  // Node Synchronization
  syncWithNodes: (peerUrl: string) => {
    return new Promise<SyncResponse>((resolve, reject) => {
      if (!wsService.isConnected()) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const handler = (data: SyncResponse) => {
        wsService.removeMessageHandler('sync-complete');
        resolve(data);
      };
      wsService.onMessage('sync-complete', handler);
      wsService.sendMessage('sync-nodes', { peerUrl });
    });
  },

  // Token Operations
  generateTokenHash: async (serialNumber: string) => {
    return new Promise<TokenHash>(async (resolve, reject) => {
      if (!wsService.isConnected()) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      try {
        // Generate a hash for the token
        const timestamp = Date.now();
        const hashObj = createHash('SHA-256');
        const hash = await hashObj.update(`${serialNumber}:${timestamp}`).digest('hex');

        const handler = (data: TokenHash | ErrorResponse) => {
          wsService.removeMessageHandler('token-hash-registered');
          if ('error' in data) {
            reject(new Error(data.error));
          } else {
            resolve(data as TokenHash);
          }
        };

        wsService.onMessage('token-hash-registered', handler);
        
        // Send the registration message with both serialNumber and hash
        wsService.sendMessage('register-token-hash', { 
          serialNumber,
          hash,
          requestId: timestamp
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  getTokenHash: (serialNumber: string): Promise<TokenHash | undefined> => {
    return new Promise((resolve, reject) => {
      if (!wsService.isConnected()) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const handler = (data: any) => {
        wsService.removeMessageHandler('token-hash-response');
        wsService.removeMessageHandler('error');
        resolve(data as TokenHash);
      };
      const errorHandler = (data: any) => {
        wsService.removeMessageHandler('token-hash-response');
        wsService.removeMessageHandler('error');
        if (data.error === 'Token hash not found') {
          resolve(undefined);
        } else {
          reject(new Error(data.error || 'Unknown error'));
        }
      };
      wsService.onMessage('token-hash-response', handler);
      wsService.onMessage('error', errorHandler);
      wsService.sendMessage('get-token-hash', { serialNumber });
    });
  },

  verifyToken: (serialNumber: string, hash: string) => {
    return new Promise<TokenVerificationResponse>((resolve, reject) => {
      if (!wsService.isConnected()) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const handler = (data: TokenVerificationResponse | ErrorResponse) => {
        wsService.removeMessageHandler('token-verification-response');
        if ('error' in data) {
          reject(new Error(data.error));
        } else {
          resolve(data as TokenVerificationResponse);
        }
      };
      wsService.onMessage('token-verification-response', handler);
      wsService.sendMessage('verify-token-hash', { serialNumber, hash });
    });
  },

  // Direct message sending
  sendMessage: (type: string, data: any) => {
    return new Promise<any>((resolve, reject) => {
      if (!wsService.isConnected()) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const handler = (responseData: any) => {
        wsService.removeMessageHandler(`${type}-response`);
        resolve(responseData);
      };
      wsService.onMessage(`${type}-response`, handler);
      wsService.sendMessage(type, data);
    });
  },

  removeMessageHandler: (type: string, handler?: (data: any) => void) => {
    wsService.removeMessageHandler(type, handler);
  },

  onMessage: (type: string, handler: (data: any) => void) => {
    wsService.onMessage(type, handler);
  }
}; 