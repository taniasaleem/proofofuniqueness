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

  addNode: (nodeData: { address: string; privateKey: string }) => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.NODE_CONNECTED);
        resolve(data);
      };
      p2pService.onMessage(P2P_MESSAGE_TYPES.NODE_CONNECTED, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.CONNECT, nodeData);
    });
  },

  // Token Operations
  generateTokenHash: (serialNumber: string) => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED);
        resolve(data);
      };
      p2pService.onMessage(P2P_MESSAGE_TYPES.TOKEN_HASH_CREATED, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.VERIFY_TOKEN_HASH, { serialNumber });
    });
  },

  verifyTokenHash: (serialNumber: string, hash: string) => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
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

  // Chain Operations
  getChainInfo: () => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.CHAIN_INFO);
        resolve(data);
      };
      p2pService.onMessage(P2P_MESSAGE_TYPES.CHAIN_INFO, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.GET_CHAIN_INFO, {});
    });
  },

  getSupplyInfo: () => {
    return new Promise<any>((resolve, reject) => {
      if (!p2pService.isServiceConnected()) {
        reject(new Error('P2P service is not connected'));
        return;
      }
      const handler = (data: any) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.SUPPLY_INFO);
        resolve(data);
      };
      p2pService.onMessage(P2P_MESSAGE_TYPES.SUPPLY_INFO, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.GET_SUPPLY_INFO, {});
    });
  }
}; 