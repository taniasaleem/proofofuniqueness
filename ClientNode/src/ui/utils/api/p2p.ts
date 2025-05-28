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

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      // Get initial node info
      this.nodeInfo = await window.p2p.getNodeInfo();
      this.clientId = this.nodeInfo.peerId;
      this.isReady = true;
      console.log('P2P service initialized with peer ID:', this.clientId);
      
      // Set up message handler
      window.p2p.onMessage((message: P2PMessage) => {
        console.log('Received P2P message:', message);
        const handlers = this.messageHandlers.get(message.type);
        if (handlers) {
          handlers.forEach(handler => handler(message.data));
        }
      });
      
      // Process any queued messages
      this.processMessageQueue();

      // Set up periodic peer list updates
      this.startPeerListUpdates();
    } catch (error) {
      console.error('Error initializing P2P service:', error);
      this.isReady = false;
    }
  }

  private startPeerListUpdates() {
    // Update peer list every 30 seconds
    setInterval(async () => {
      try {
        const peers = await window.p2p.getPeers();
        this.handlePeerListUpdate(peers);
      } catch (error) {
        console.error('Error updating peer list:', error);
      }
    }, 30000);
  }

  private handlePeerListUpdate(peers: Peer[]) {
    const handlers = this.messageHandlers.get('peer-list-update');
    if (handlers) {
      handlers.forEach(handler => handler(peers));
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
    if (!this.isReady || !this.clientId) {
      throw new Error('P2P service is not ready');
    }

    const message: P2PMessage = {
      type,
      data,
      timestamp: new Date().toISOString(),
      clientId: this.clientId
    };

    console.log('Sending P2P message:', {
      type: message.type,
      clientId: message.clientId,
      data: message.data
    });

    // Send message through P2P network
    window.p2p.sendMessage(type, data);
  }

  public sendMessage(type: string, data: any) {
    if (!this.isReady || !this.clientId) {
      console.log('P2P service not ready, queueing message:', { type, data });
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
    // Clear all message handlers
    this.messageHandlers.clear();
    this.clientId = null;
    this.isReady = false;
    this.nodeInfo = null;
  }

  public isConnected(): boolean {
    return this.isReady && this.clientId !== null;
  }

  public getClientId(): string | null {
    return this.clientId;
  }

  public getNodeInfo(): NodeInfo | null {
    return this.nodeInfo;
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
  handleTokenHashCreated: (data: any) => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (response: any) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED);
        resolve(response);
      };
      p2pService.onMessage(P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED, handler);
    });
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

import { useState, useEffect, useCallback } from 'react';
import { P2PAPI, TokenHashData } from '../../types';

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

export const useP2P = (): P2PAPI => {
  const [isConnected, setIsConnected] = useState(false);
  const [tokenHashes, setTokenHashes] = useState<Map<string, TokenHashData>>(new Map());

  useEffect(() => {
    const handleConnection = () => setIsConnected(true);
    const handleDisconnection = () => setIsConnected(false);
    const handleError = (error: any) => console.error('P2P error:', error);
    const handleMessage = (message: any) => {
      console.log('Received P2P message:', message);
      if (message.type === P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED) {
        const { serialNumber, hash } = message.data;
        console.log('Processing token hash created message:', { serialNumber, hash });
        setTokenHashes(prev => {
          const newMap = new Map(prev);
          newMap.set(serialNumber, {
            hash,
            serialNumber,
            timestamp: new Date().toISOString(),
            verified: true,
            verificationCount: 0
          });
          return newMap;
        });
      }
    };

    window.electron.ipcRenderer.on('p2p:connected', handleConnection);
    window.electron.ipcRenderer.on('p2p:disconnected', handleDisconnection);
    window.electron.ipcRenderer.on('p2p:error', handleError);
    window.electron.ipcRenderer.on('p2p:message', handleMessage);

    return () => {
      window.electron.ipcRenderer.removeListener('p2p:connected', handleConnection);
      window.electron.ipcRenderer.removeListener('p2p:disconnected', handleDisconnection);
      window.electron.ipcRenderer.removeListener('p2p:error', handleError);
      window.electron.ipcRenderer.removeListener('p2p:message', handleMessage);
    };
  }, []);

  const registerTokenHash = useCallback(async (serialNumber: string, hash: string) => {
    try {
      await window.electron.ipcRenderer.invoke('p2p:send-message', {
        type: P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED,
        data: { serialNumber, hash }
      });
    } catch (error) {
      console.error('Error registering token hash:', error);
      throw error;
    }
  }, []);

  const verifyTokenHash = useCallback(async (serialNumber: string, hash: string) => {
    try {
      await window.electron.ipcRenderer.invoke('p2p:send-message', {
        type: P2P_MESSAGE_TYPES.VERIFY_TOKEN_HASH,
        data: { serialNumber, hash }
      });
    } catch (error) {
      console.error('Error verifying token hash:', error);
      throw error;
    }
  }, []);

  const getTokenHash = useCallback((serialNumber: string) => {
    return tokenHashes.get(serialNumber)?.hash;
  }, [tokenHashes]);

  const getTokenHashData = useCallback((serialNumber: string) => {
    return tokenHashes.get(serialNumber);
  }, [tokenHashes]);

  return {
    isConnected,
    registerTokenHash,
    verifyTokenHash,
    getTokenHash,
    getTokenHashData
  };
};