import { blockchainAPI } from './websocket';

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

export const createTransaction = async (
  fromAddress: string,
  toAddress: string,
  amount: number,
  fee: number,
  privateKey: string,
  message: string
): Promise<transactionres> => {
  const URL = BASEURL + TX_ENDPOINTS.createtransaction;

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fromAddress,
      toAddress,
      amount,
      fee,
      privateKey,
      message,
    }),
  });

  return res.json();
};

export const getAddressBalance = async (address: string): Promise<addressbalance> => {
  return blockchainAPI.getAddressBalance(address);
};

export const verifyTransactionWithHash = async (hash: string): Promise<transactionInfo> => {
  return blockchainAPI.sendMessage('verify-transaction', { hash });
};

export const verifyBlockWithHash = async (hash: string): Promise<blcokhashInfo> => {
  return blockchainAPI.verifyBlockHash(hash);
};
