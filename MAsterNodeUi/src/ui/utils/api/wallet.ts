import { blockchainAPI } from "./websocket";

export type walletstatus = {
  address: string;
  status: "banned" | "active";
  message: string;
};

export type createwallettres = {
  address: string;
  privateKey: string;
  balance: number;
  message: string;
};

export type wallettype = {
  address: string;
  balance: number;
  nonce: number;
};

export const getWallets = async (): Promise<{
  count: number;
  wallets: wallettype[];
}> => {
  return blockchainAPI.sendMessage("get-wallets", {});
};

export const getWalletStatus = async (
  address: string
): Promise<walletstatus> => {
  return blockchainAPI.sendMessage("get-wallet-status", { address });
};

export const createWallet = async (): Promise<createwallettres> => {
  return blockchainAPI.sendMessage("create-wallet", {});
};
