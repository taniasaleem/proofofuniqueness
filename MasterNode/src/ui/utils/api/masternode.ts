import { blockchainAPI } from './websocket';
import { WS_MESSAGE_TYPES } from './config';

export type nodetype = {
  address: string;
  timestamp: number;
  wallet: {
    address: string;
  };
};

export const getAllNodes = async (): Promise<nodetype[]> => {
  return blockchainAPI.getAllNodes();
};

export const addIdentity = async (address: string, privateKey: string) => {
  return blockchainAPI.addNode({ address, privateKey });
};

export const registerTokenHash = async (serialNumber: string, hash: string) => {
  return blockchainAPI.generateTokenHash(serialNumber);
};

export const verifyTokenHash = async (serialNumber: string, hash: string) => {
  return new Promise((resolve, reject) => {
    if (!blockchainAPI.isConnected()) {
      reject(new Error('WebSocket is not connected'));
      return;
    }
    
    const handler = (data: any) => {
      blockchainAPI.removeMessageHandler(WS_MESSAGE_TYPES.TOKEN_HASH_VERIFICATION);
      resolve(data);
    };
    
    blockchainAPI.onMessage(WS_MESSAGE_TYPES.TOKEN_HASH_VERIFICATION, handler);
    blockchainAPI.sendMessage(WS_MESSAGE_TYPES.VERIFY_TOKEN_HASH, { serialNumber, hash });
  });
};
