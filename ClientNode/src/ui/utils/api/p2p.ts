import { P2P_MESSAGE_TYPES } from './config';

// Handle crypto in both Node.js and browser environments


// Define the window.p2p interface
declare global {
  interface Window {
    p2p: {
      getPeers: () => Promise<Peer[]>;
      getNodeInfo: () => Promise<NodeInfo>;
      sendMessage: (type: string, data: any) => Promise<void>;
      onMessage: (handler: (message: P2PMessage) => void) => void;
      offMessage: (handler: (message: P2PMessage) => void) => void;
      getStatus: () => Promise<{ isConnected: boolean; isInitialized: boolean }>;
      connect: () => Promise<void>;
      disconnect: () => Promise<void>;
      onConnectionProgress: (handler: (progress: any) => void) => void;
      onConnected: (handler: () => void) => void;
      onDisconnected: (handler: () => void) => void;
      onError: (handler: (error: any) => void) => void;
    }
  }
}

export interface P2PMessage {
  type: string;
  data?: any;
  timestamp: string;
  clientId: string;
}

interface Peer {
  id: string;
  connectedAt: string;
  lastSeen: string;
}

interface NodeInfo {
  peerId: string;
  addresses: string[];
}

export class P2PService {
  private messageHandlers: Map<string, Set<((data: any) => void)>> = new Map();
  private clientId: string | null = null;
  private messageQueue: Array<{ type: string; data: any }> = [];
  private isReady = false;
  private nodeInfo: NodeInfo | null = null;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      // Get initial node info - this should work even without connection
      await this.updateNodeInfo();
      this.isInitialized = true;

      // Set up message handler
      window.p2p.onMessage((message: P2PMessage) => {
        console.log('Received P2P message:', message);
        const handlers = this.messageHandlers.get(message.type);
        if (handlers) {
          handlers.forEach(handler => handler(message.data));
        }
      });

      // Set up connection status handlers
      window.p2p.onConnected(() => {
        console.log('[P2PService] Connected to P2P network');
        this.connectionStatus = 'connected';
        this.isReady = true;
        this.processMessageQueue();
        this.startPeerListUpdates();
      });

      window.p2p.onDisconnected(() => {
        console.log('[P2PService] Disconnected from P2P network');
        this.connectionStatus = 'disconnected';
        this.isReady = false;
        // initiate connection attempts
      });

      window.p2p.onError((error) => {
        console.error('[P2PService] P2P error:', error);
        if (this.connectionStatus === 'connecting') {
          this.connectionStatus = 'disconnected';
        }
      });

      // Get initial connection status
      const status = await window.p2p.getStatus();
      if (status.isConnected) {
        this.connectionStatus = 'connected';
        this.isReady = true;
        this.processMessageQueue();
        this.startPeerListUpdates();
      } else if (status.isInitialized) {
        // If node is initialized but not connected, start connection attempts
        await this.connect();
      }
    } catch (error) {
      console.error('Error initializing P2P service:', error);
      this.isReady = false;
      this.connectionStatus = 'disconnected';
    }
  }

  private async updateNodeInfo() {
    try {
      this.nodeInfo = await window.p2p.getNodeInfo();
      this.clientId = this.nodeInfo.peerId;
      console.log('[P2PService] Updated node info:', this.nodeInfo);
      return this.nodeInfo;
    } catch (error) {
      console.error('[P2PService] Error updating node info:', error);
      throw error;
    }
  }

  public async getNodeInfo(): Promise<NodeInfo | null> {
    if (!this.nodeInfo) {
      try {
        return await this.updateNodeInfo();
      } catch (error) {
        console.error('[P2PService] Error getting node info:', error);
        return null;
      }
    }
    return this.nodeInfo;
  }

  public async connect() {
    if (this.connectionStatus !== 'disconnected') {
      console.log(`[P2PService] Cannot connect: current status is ${this.connectionStatus}`);
      return;
    }

    this.connectionStatus = 'connecting';
    try {
      console.log('[P2PService] Initiating connection to P2P network');
      await window.p2p.connect();
    } catch (error) {
      console.error('[P2PService] Connection error:', error);
      this.connectionStatus = 'disconnected';
      throw error;
    }
  }

  public async disconnect() {
    if (this.connectionStatus === 'disconnected') {
      console.log('[P2PService] Already disconnected');
      return;
    }

    try {
      await window.p2p.disconnect();
      this.connectionStatus = 'disconnected';
      this.isReady = false;
    } catch (error) {
      console.error('[P2PService] Error disconnecting:', error);
      throw error;
    }
  }

  public async sendMessage(type: string, data: any) {
    if (!this.isConnected()) {
      console.log('[P2PService] Not connected, queueing message:', { type, data });
      this.messageQueue.push({ type, data });
      return;
    }

    try {
      await window.p2p.sendMessage(type, data);
    } catch (error) {
      console.error('[P2PService] Error sending message:', error);
      throw error;
    }
  }

  private processMessageQueue() {
    if (!this.isConnected()) {
      console.log('[P2PService] Not connected, cannot process message queue');
      return;
    }

    console.log(`[P2PService] Processing ${this.messageQueue.length} queued messages`);
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message.type, message.data).catch(error => {
          console.error('[P2PService] Error processing queued message:', error);
        });
      }
    }
  }

  public isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.isReady;
  }

  public getConnectionStatus() {
    return this.connectionStatus;
  }

  public isNodeInitialized(): boolean {
    return this.isInitialized;
  }

  private startPeerListUpdates() {
    if (!this.isConnected()) {
      console.log('[P2PService] Not starting peer updates: not connected');
      return;
    }

    console.log('[P2PService] Starting periodic peer list updates');
    // Update peer list every 30 seconds
    const updateInterval = setInterval(async () => {
      if (!this.isConnected()) {
        console.log('[P2PService] Stopping peer updates: no longer connected');
        clearInterval(updateInterval);
        return;
      }

      try {
        console.log('[P2PService] Requesting peer list update');
        const peers = await window.p2p.getPeers();
        this.handlePeerListUpdate(peers);
      } catch (error) {
        console.error('[P2PService] Error updating peer list:', error);
      }
    }, 30000);

    // Do an initial update
    this.updatePeerList();
  }

  private async updatePeerList() {
    try {
      console.log('[P2PService] Performing initial peer list update');
      const peers = await window.p2p.getPeers();
      this.handlePeerListUpdate(peers);
    } catch (error) {
      console.error('[P2PService] Error performing initial peer list update:', error);
    }
  }

  private handlePeerListUpdate(peers: Peer[]) {
    console.log('[P2PService] Handling peer list update:', peers);
    const handlers = this.messageHandlers.get('peer-list-update');
    if (handlers) {
      handlers.forEach(handler => handler(peers));
    }
  }

  public async getPeers(): Promise<Peer[]> {
    if (!this.isConnected()) {
      console.log('[P2PService] Cannot get peers: not connected');
      return [];
    }

    try {
      console.log('[P2PService] Getting peer list');
      const peers = await window.p2p.getPeers();
      console.log('[P2PService] Retrieved peers:', peers);
      return peers;
    } catch (error) {
      console.error('[P2PService] Error getting peers:', error);
      return [];
    }
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

  public getClientId(): string | null {
    return this.clientId;
  }
}

// Create a singleton instance
export const p2pService = new P2PService();

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

export interface TokenVerificationResponse {
  isValid: boolean;
  verifiedBy: string[];
  message?: string;
}

export interface ErrorResponse {
  error: string;
}

// Blockchain API functions using P2P
export const blockchainAPI = {
  // Connection status
  isConnected: () => {
    return p2pService.isConnected();
  },

  // Node Management
  getAllNodes: () => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler('nodes-response');
        resolve(data);
      };
      p2pService.onMessage('nodes-response', handler);
      p2pService.sendMessage('get-nodes', {});
    });
  },

  addNode: (nodeData: any) => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler('node-added');
        resolve(data);
      };
      p2pService.onMessage('node-added', handler);
      p2pService.sendMessage('add-node', nodeData);
    });
  },

  // Chain Operations
  getChainInfo: () => {
    return new Promise<ChainInfo>((resolve, reject) => {
      if (!p2pService.isConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: ChainInfo) => {
        p2pService.removeMessageHandler('chain-info');
        resolve(data);
      };
      p2pService.onMessage('chain-info', handler);
      p2pService.sendMessage('get-chain-info', {});
    });
  },

  getSupplyInfo: () => {
    return new Promise<ChainSupply>((resolve, reject) => {
      if (!p2pService.isConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: ChainSupply) => {
        p2pService.removeMessageHandler('supply-info');
        resolve(data);
      };
      p2pService.onMessage('supply-info', handler);
      p2pService.sendMessage('get-supply-info', {});
    });
  },

  // Transaction Operations
  createTransaction: (transactionData: any) => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler('transaction-created');
        resolve(data);
      };
      p2pService.onMessage('transaction-created', handler);
      p2pService.sendMessage('create-transaction', transactionData);
    });
  },

  getAddressBalance: (address: string) => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler('balance-response');
        resolve(data);
      };
      p2pService.onMessage('balance-response', handler);
      p2pService.sendMessage('get-balance', { address });
    });
  },

  // Block Operations
  verifyBlockHash: (hash: string) => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler('block-verification');
        resolve(data);
      };
      p2pService.onMessage('block-verification', handler);
      p2pService.sendMessage('verify-block', { hash });
    });
  },

  // Node Synchronization
  syncWithNodes: (peerUrl: string) => {
    return new Promise<SyncResponse>((resolve, reject) => {
      if (!p2pService.isConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: SyncResponse) => {
        p2pService.removeMessageHandler('sync-complete');
        resolve(data);
      };
      p2pService.onMessage('sync-complete', handler);
      p2pService.sendMessage('sync-nodes', { peerUrl });
    });
  },

  // Token Operations
  handleTokenHashCreated: () => {
    // Handle token hash creation
  },

  verifyTokenHash: (serialNumber: string, hash: string) => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.TOKEN_HASH_VERIFICATION);
        resolve(data);
      };
      p2pService.onMessage(P2P_MESSAGE_TYPES.TOKEN_HASH_VERIFICATION, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.VERIFY_TOKEN_HASH, { serialNumber, hash });
    });
  },

  // Direct message sending
  sendMessage: (type: string, data: any) => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (responseData: any) => {
        p2pService.removeMessageHandler(`${type}-response`);
        resolve(responseData);
      };
      p2pService.onMessage(`${type}-response`, handler);
      p2pService.sendMessage(type, data);
    });
  },

  removeMessageHandler: (type: string, handler?: (data: any) => void) => {
    p2pService.removeMessageHandler(type, handler);
  },

  onMessage: (type: string, handler: (data: any) => void) => {
    p2pService.onMessage(type, handler);
  }
};

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (channel: string, func: (...args: any[]) => void) => void;
        invoke: (channel: string, ...args: any[]) => Promise<any>;
      };
    };
  }
}
