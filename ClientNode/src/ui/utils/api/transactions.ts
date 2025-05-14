import { BASEURL, TX_ENDPOINTS } from "./config";

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

export const getAddressBalance = async (
  address: string
): Promise<addressbalance> => {
  const URL = BASEURL + TX_ENDPOINTS.addressbalance + address;

  const res = await fetch(URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  return res.json();
};

export const verifyTransactionWithHash = async (
  hash: string
): Promise<transactionInfo> => {
  const URL = BASEURL + TX_ENDPOINTS.createtransaction + `/${hash}`;

  const res = await fetch(URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
};

export const verifyBlockWithHash = async (
  hash: string
): Promise<blcokhashInfo> => {
  const URL = BASEURL + TX_ENDPOINTS.verifyblockhash + `/${hash}`;

  const res = await fetch(URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
};
