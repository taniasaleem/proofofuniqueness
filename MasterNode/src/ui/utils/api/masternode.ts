import { P2P_MESSAGE_TYPES } from './config';
import { p2pService } from './p2p';

export type nodetype = {
  address: string;
  timestamp: number;
  wallet: {
    address: string;
  };
};

export const getAllNodes = async (): Promise<nodetype[]> => {
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
};

export const addIdentity = async (address: string, privateKey: string) => {
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
    p2pService.sendMessage(P2P_MESSAGE_TYPES.CONNECT, { address, privateKey });
  });
};

export const registerTokenHash = async (serialNumber: string, hash: string) => {
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
};

export const verifyTokenHash = async (serialNumber: string, hash: string) => {
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
    p2pService.sendMessage(P2P_MESSAGE_TYPES.VERIFY_TOKEN_HASH, { serialNumber, hash });
  });
};
