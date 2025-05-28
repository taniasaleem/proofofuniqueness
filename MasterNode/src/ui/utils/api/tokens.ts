import { P2P_MESSAGE_TYPES } from './config';
import { p2pService } from './p2p';

export type tokentype = {
  id: string;
  value: number;
  hash: string;
  owner: string;
  createdAt: string;
};

export const getAllTokens = async (): Promise<{
  count: number;
  tokens: tokentype[];
}> => {
  return new Promise((resolve, reject) => {
    if (!p2pService.isServiceConnected()) {
      reject(new Error('P2P connection is not available'));
      return;
    }

    const handler = (message: any) => {
      if (message.type === P2P_MESSAGE_TYPES.CHAIN_INFO) {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.CHAIN_INFO);
        resolve({
          count: message.data.accounts,
          tokens: message.data.tokens || []
        });
      }
    };

    p2pService.onMessage(P2P_MESSAGE_TYPES.CHAIN_INFO, handler);
    p2pService.sendMessage(P2P_MESSAGE_TYPES.GET_CHAIN_INFO, {});
  });
};

export const createToken = async (value: number, owner: string): Promise<tokentype> => {
  return new Promise((resolve, reject) => {
    if (!p2pService.isServiceConnected()) {
      reject(new Error('P2P connection is not available'));
      return;
    }

    const handler = (message: any) => {
      if (message.type === P2P_MESSAGE_TYPES.TRANSACTION_CREATED) {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.TRANSACTION_CREATED);
        resolve(message.data);
      }
    };

    p2pService.onMessage(P2P_MESSAGE_TYPES.TRANSACTION_CREATED, handler);
    p2pService.sendMessage(P2P_MESSAGE_TYPES.CREATE_TRANSACTION, { value, owner });
  });
};

export const verifyToken = async (tokenId: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!p2pService.isServiceConnected()) {
      reject(new Error('P2P connection is not available'));
      return;
    }

    const handler = (message: any) => {
      if (message.type === P2P_MESSAGE_TYPES.TRANSACTION_VERIFIED) {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.TRANSACTION_VERIFIED);
        resolve(message.data.isValid);
      }
    };

    p2pService.onMessage(P2P_MESSAGE_TYPES.TRANSACTION_VERIFIED, handler);
    p2pService.sendMessage(P2P_MESSAGE_TYPES.VERIFY_TRANSACTION, { tokenId });
  });
};
