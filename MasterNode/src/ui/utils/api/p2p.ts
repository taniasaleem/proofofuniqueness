import { P2P_MESSAGE_TYPES } from './config';
import './types'; // Import types

// Types
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
}

export interface TokenVerificationResponse {
  isValid: boolean;
  serialNumber: string;
  hash: string;
  timestamp: number;
}

export interface ErrorResponse {
  error: string;
}

// P2P Service class
class P2PService {
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private isConnected: boolean = false;

  constructor() {
    // Initialize connection status
    this.checkConnection();
    
    // Set up message listeners
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('p2p-message', (event, message) => {
        this.handleMessage(message);
      });

      window.electron.ipcRenderer.on('p2p-error', (event, error) => {
        console.error('P2P Error:', error);
      });
    }
  }

  private checkConnection() {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('p2p-get-peers', { type: 'get-peers' });
      this.isConnected = true;
    } else {
      this.isConnected = false;
    }
  }

  private handleMessage(message: any) {
    if (!message || !message.type) {
      console.error('Invalid message received:', message);
      return;
    }

    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message.data);
        } catch (error) {
          console.error(`Error in message handler for ${message.type}:`, error);
        }
      });
    }
  }

  // Public methods
  public sendMessage(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('P2P service is not connected'));
        return;
      }

      if (!window.electron?.ipcRenderer) {
        reject(new Error('Electron IPC not available'));
        return;
      }

      try {
        window.electron.ipcRenderer.send('p2p-send', {
          type,
          data
        });
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }

  public onMessage(type: string, handler: (data: any) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)?.add(handler);
  }

  public removeMessageHandler(type: string, handler?: (data: any) => void): void {
    if (handler) {
      this.messageHandlers.get(type)?.delete(handler);
    } else {
      this.messageHandlers.delete(type);
    }
  }

  public isServiceConnected(): boolean {
    return this.isConnected;
  }
}

// Create and export a singleton instance
export const p2pService = new P2PService();

// Export the blockchain API that uses the P2P service
export const blockchainAPI = {
  // Connection status
  isConnected: () => p2pService.isServiceConnected(),

  // Node Management
  getAllNodes: () => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.NODES_RESPONSE);
        resolve(data);
      };
      p2pService.onMessage(P2P_MESSAGE_TYPES.NODES_RESPONSE, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.GET_NODES, {});
    });
  },

  // Chain Operations
  getChainInfo: () => {
    return new Promise<ChainInfo>((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: ChainInfo) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.CHAIN_INFO);
        resolve(data);
      };
      p2pService.onMessage(P2P_MESSAGE_TYPES.CHAIN_INFO, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.GET_CHAIN_INFO, {});
    });
  },

  getSupplyInfo: () => {
    return new Promise<ChainSupply>((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: ChainSupply) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.SUPPLY_INFO);
        resolve(data);
      };
      p2pService.onMessage(P2P_MESSAGE_TYPES.SUPPLY_INFO, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.GET_SUPPLY_INFO, {});
    });
  },

  // Transaction Operations
  createTransaction: (transactionData: any) => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.TRANSACTION_CREATED);
        resolve(data);
      };
      p2pService.onMessage(P2P_MESSAGE_TYPES.TRANSACTION_CREATED, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.CREATE_TRANSACTION, transactionData);
    });
  },

  getAddressBalance: (address: string) => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.BALANCE_RESPONSE);
        resolve(data);
      };
      p2pService.onMessage(P2P_MESSAGE_TYPES.BALANCE_RESPONSE, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.GET_BALANCE, { address });
    });
  },

  // Token Operations
  verifyToken: (serialNumber: string, hash: string) => {
    return new Promise<TokenVerificationResponse>((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: TokenVerificationResponse | ErrorResponse) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.TOKEN_HASH_VERIFICATION);
        if ('error' in data) {
          reject(new Error(data.error));
        } else {
          resolve(data as TokenVerificationResponse);
        }
      };
      p2pService.onMessage(P2P_MESSAGE_TYPES.TOKEN_HASH_VERIFICATION, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.VERIFY_TOKEN_HASH, { serialNumber, hash });
    });
  },

  // Direct message sending
  sendMessage: (type: string, data: any) => {
    return p2pService.sendMessage(type, data);
  },

  removeMessageHandler: (type: string, handler?: (data: any) => void) => {
    p2pService.removeMessageHandler(type, handler);
  },

  onMessage: (type: string, handler: (data: any) => void) => {
    p2pService.onMessage(type, handler);
  }
}; 