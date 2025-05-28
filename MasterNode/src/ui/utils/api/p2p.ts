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

export type P2PMessageTypeValue = typeof P2P_MESSAGE_TYPES[keyof typeof P2P_MESSAGE_TYPES];

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
      window.electron.ipcRenderer.send('p2p-send', {
        type: P2P_MESSAGE_TYPES.GET_NODES,
        data: {},
        timestamp: new Date().toISOString()
      });
      this.isConnected = true;
    } else {
      this.isConnected = false;
    }
  }

  private handleMessage(message: any) {
    try {
      console.log('[P2P UI] Received raw message:', message);
      
      // Handle port messages
      if (message.sender && message.ports) {
        console.log('[P2P UI] Received port message, skipping type validation');
        return;
      }

      // Extract message from args if it's wrapped in an IPC message
      const actualMessage = message.args?.[0] || message;
      console.log('[P2P UI] Extracted message:', actualMessage);

      if (!actualMessage || typeof actualMessage !== 'object') {
        console.error('[P2P UI] Invalid message data:', actualMessage);
        return;
      }

      if (!actualMessage.type) {
        console.error('[P2P UI] Message missing type field:', actualMessage);
        return;
      }

      // Validate message type
      const validTypes = Object.values(P2P_MESSAGE_TYPES);
      console.log('[P2P UI] Valid message types:', validTypes);
      console.log('[P2P UI] Message type to validate:', actualMessage.type);
      
      // Check if message type is valid
      const isValidType = validTypes.includes(actualMessage.type);
      if (!isValidType) {
        console.warn(`[P2P UI] Unknown message type: ${actualMessage.type}`);
        return;
      }

      // Ensure message has required fields
      const formattedMessage = {
        type: actualMessage.type,
        data: actualMessage.data || {},
        timestamp: actualMessage.timestamp || new Date().toISOString(),
        success: actualMessage.success !== undefined ? actualMessage.success : !actualMessage.error
      };
      console.log('[P2P UI] Formatted message:', formattedMessage);

      // Notify handlers
      const handlers = this.messageHandlers.get(formattedMessage.type);
      console.log('[P2P UI] Found handlers:', handlers ? handlers.size : 0);
      
      if (handlers) {
        handlers.forEach(handler => {
          try {
            console.log('[P2P UI] Calling handler for type:', formattedMessage.type);
            handler(formattedMessage);
          } catch (error) {
            console.error(`[P2P UI] Error in message handler for type ${formattedMessage.type}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('[P2P UI] Error handling P2P message:', error);
    }
  }

  // Public methods
  public sendMessage(type: P2PMessageTypeValue, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log(`[P2P UI] Attempting to send message:`, { type, data });
      
      if (!this.isConnected) {
        console.error('[P2P UI] Service not connected');
        reject(new Error('P2P service is not connected'));
        return;
      }

      if (!window.electron?.ipcRenderer) {
        console.error('[P2P UI] Electron IPC not available');
        reject(new Error('Electron IPC not available'));
        return;
      }

      try {
        // Validate message type
        const validTypes = Object.values(P2P_MESSAGE_TYPES);
        console.log('[P2P UI] Valid message types:', validTypes);
        console.log('[P2P UI] Message type to validate:', type);
        
        // Check if message type is valid
        const isValidType = validTypes.includes(type);
        if (!isValidType) {
          console.error('[P2P UI] Invalid message type:', type);
          reject(new Error(`Invalid message type: ${type}`));
          return;
        }

        // Ensure message has the correct structure
        const message = {
          type,
          data: data || {},
          timestamp: new Date().toISOString()
        };
        console.log('[P2P UI] Sending formatted message:', message);

        // Add message handler for response
        const responseHandler = (response: any) => {
          try {
            console.log('[P2P UI] Received response:', response);
            const actualResponse = response.args?.[0] || response;
            const responseType = `${type}-response`;
            if (actualResponse.type === responseType || actualResponse.type === P2P_MESSAGE_TYPES.ERROR) {
              this.removeMessageHandler(type);
              if (actualResponse.error) {
                console.error('[P2P UI] Response contains error:', actualResponse.error);
                reject(new Error(actualResponse.error));
              } else {
                console.log('[P2P UI] Message sent successfully');
                resolve(actualResponse.data);
              }
            }
          } catch (error) {
            console.error('[P2P UI] Error handling response:', error);
            reject(error);
          }
        };

        this.onMessage(type, responseHandler);

        // Send the message
        console.log('[P2P UI] Sending message via IPC');
        window.electron.ipcRenderer.send('p2p-send', message);
      } catch (error) {
        console.error('[P2P UI] Error sending P2P message:', error);
        reject(error);
      }
    });
  }

  public onMessage(type: P2PMessageTypeValue, handler: (data: any) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)?.add(handler);
  }

  public removeMessageHandler(type: P2PMessageTypeValue, handler?: (data: any) => void): void {
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
  sendMessage: (type: P2PMessageTypeValue, data: any) => {
    return p2pService.sendMessage(type, data);
  },

  removeMessageHandler: (type: P2PMessageTypeValue, handler?: (data: any) => void) => {
    p2pService.removeMessageHandler(type, handler);
  },

  onMessage: (type: P2PMessageTypeValue, handler: (data: any) => void) => {
    p2pService.onMessage(type, handler);
  }
}; 