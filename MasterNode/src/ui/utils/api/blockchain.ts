import { P2P_MESSAGE_TYPES } from './config';
import { p2pService } from './p2p';
import { ElectronAPI } from './types';

// Declare the Electron types for the window object
declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

// Blockchain API that uses P2P service
export const blockchainAPI = {
  // Connection status
  isConnected: () => p2pService.isServiceConnected(),

  // Node Management
  getNodes: async () => {
    return new Promise((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P connection is not available'));
        return;
      }

      const handler = (message: any) => {
        if (message.type === P2P_MESSAGE_TYPES.NODES_RESPONSE) {
          p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.NODES_RESPONSE);
          resolve(message.data.nodes);
        }
      };

      p2pService.onMessage(P2P_MESSAGE_TYPES.NODES_RESPONSE, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.GET_NODES, {});
    });
  },

  connectNode: async (nodeData: { address: string; privateKey: string }) => {
    return new Promise((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P connection is not available'));
        return;
      }

      const handler = (message: any) => {
        if (message.type === P2P_MESSAGE_TYPES.NODE_CONNECTED) {
          p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.NODE_CONNECTED);
          resolve(message.data);
        }
      };

      p2pService.onMessage(P2P_MESSAGE_TYPES.NODE_CONNECTED, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.CONNECT, nodeData);
    });
  },

  // Token Operations
  registerTokenHash: async (serialNumber: string, hash: string) => {
    return new Promise((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P connection is not available'));
        return;
      }

      const handler = (message: any) => {
        if (message.type === P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED) {
          p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED);
          resolve(message.data);
        }
      };

      p2pService.onMessage(P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.VERIFY_TOKEN_HASH, { serialNumber, hash });
    });
  },

  verifyTokenHash: async (serialNumber: string) => {
    return new Promise((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P connection is not available'));
        return;
      }

      const handler = (message: any) => {
        if (message.type === P2P_MESSAGE_TYPES.TOKEN_HASH_VERIFICATION) {
          p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.TOKEN_HASH_VERIFICATION);
          resolve(message.data);
        }
      };

      p2pService.onMessage(P2P_MESSAGE_TYPES.TOKEN_HASH_VERIFICATION, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.VERIFY_TOKEN_HASH, { serialNumber });
    });
  },

  // Chain Operations
  getChainInfo: async () => {
    return new Promise((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P connection is not available'));
        return;
      }

      const handler = (message: any) => {
        if (message.type === P2P_MESSAGE_TYPES.CHAIN_INFO) {
          p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.CHAIN_INFO);
          resolve(message.data);
        }
      };

      p2pService.onMessage(P2P_MESSAGE_TYPES.CHAIN_INFO, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.GET_CHAIN_INFO, {});
    });
  },

  getSupplyInfo: async () => {
    return new Promise((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P connection is not available'));
        return;
      }

      const handler = (message: any) => {
        if (message.type === P2P_MESSAGE_TYPES.SUPPLY_INFO) {
          p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.SUPPLY_INFO);
          resolve(message.data);
        }
      };

      p2pService.onMessage(P2P_MESSAGE_TYPES.SUPPLY_INFO, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.GET_SUPPLY_INFO, {});
    });
  }
}; 