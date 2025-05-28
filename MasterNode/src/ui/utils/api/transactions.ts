import { p2pService } from './p2p';
import { P2P_MESSAGE_TYPES } from './config';

export interface transactionres {
  success: boolean;
  message: string;
  transactionId?: string;
}

export type addressbalance = {
  balance: number;
  address: string;
};

export type gettxtype = {
  fromAddress: string;
  toAddress: string;
  amount: number;
  timestamp: number;
  signature: string;
  fee: 0.3;
  message: string;
};

export type transactionInfo = {
  hash: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
};

export type blcokhashInfo = {
  hash: string;
  blockNumber: number;
  timestamp: number;
};

export const createTransaction = (
  fromAddress: string,
  toAddress: string,
  amount: number,
  fee: number,
  privateKey: string,
  message: string
): Promise<transactionres> => {
  return new Promise((resolve, reject) => {
    try {
      const transactionData = {
      fromAddress,
      toAddress,
      amount,
      fee,
      privateKey,
      message,
        timestamp: Date.now()
      };

      p2pService.sendMessage(P2P_MESSAGE_TYPES.CREATE_TRANSACTION, transactionData);

      // For now, we'll simulate a successful response
      // In a real implementation, you would wait for a P2P response
      resolve({
        success: true,
        message: 'Transaction sent via P2P',
        transactionId: `tx-${Date.now()}`
      });
    } catch (error) {
      reject(error);
    }
  });
};

export const verifyTransactionWithHash = async (hash: string): Promise<transactionInfo> => {
  return new Promise((resolve, reject) => {
    try {
      // Set up response handler
      const handler = (data: any) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.TRANSACTION_VERIFIED);
        resolve(data);
      };

      // Register handler and send verification request
      p2pService.onMessage(P2P_MESSAGE_TYPES.TRANSACTION_VERIFIED, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.VERIFY_TRANSACTION, { hash })
        .catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};

export const verifyBlockWithHash = async (hash: string): Promise<blcokhashInfo> => {
  return new Promise((resolve, reject) => {
    try {
      // Set up response handler
      const handler = (data: any) => {
        p2pService.removeMessageHandler(P2P_MESSAGE_TYPES.BLOCK_VERIFIED);
        resolve(data);
      };

      // Register handler and send verification request
      p2pService.onMessage(P2P_MESSAGE_TYPES.BLOCK_VERIFIED, handler);
      p2pService.sendMessage(P2P_MESSAGE_TYPES.VERIFY_BLOCK, { hash })
        .catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};
