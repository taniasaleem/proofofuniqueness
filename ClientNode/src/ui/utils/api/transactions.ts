import { blockchainAPI } from './p2p';
import { P2P_MESSAGE_TYPES } from './config';

export type transactionres = {
  success: boolean;
  transaction: {
    fromAddress: string;
    toAddress: string;
    amount: number;
    fee: number;
    signature: string;
    timestamp: number;
  };
  message: string;
};

export type addressbalance = {
  address: string;
  balance: number;
  nonce: number;
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
  transaction: {
    fromAddress: string;
    toAddress: string;
    amount: number;
    fee: number;
    timestamp: number;
    signature: string;
    message: string;
    hash: string;
  };
  status: string;
  confirmations: number;
  blockHeight: number;
  inMempool: boolean;
};

export type blcokhashInfo = {
  type: "transaction" | "block";
  data: {
    hash: string;
    previousHash: string;
    timestamp: number;
    proposer: string;
    transactionCount: number;
    transactions: gettxtype[];
  };
};

export const createTransaction = async (
  fromAddress: string,
  toAddress: string,
  amount: number,
  fee: number,
  privateKey: string,
  message: string
): Promise<transactionres> => {
  return blockchainAPI.createTransaction({
    fromAddress,
    toAddress,
    amount,
    fee,
    privateKey,
    message
  });
};

export const getAddressBalance = async (address: string): Promise<addressbalance> => {
  return blockchainAPI.getAddressBalance(address);
};

export const verifyTransactionWithHash = async (hash: string): Promise<transactionInfo> => {
  return blockchainAPI.sendMessage(P2P_MESSAGE_TYPES.VERIFY_TRANSACTION, { hash });
};

export const verifyBlockWithHash = async (hash: string): Promise<blcokhashInfo> => {
  return blockchainAPI.verifyBlockHash(hash);
};
