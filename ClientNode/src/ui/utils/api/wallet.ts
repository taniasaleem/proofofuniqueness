import { blockchainAPI } from './p2p';
import { P2P_MESSAGE_TYPES } from './config';

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
  return blockchainAPI.sendMessage(P2P_MESSAGE_TYPES.GET_WALLETS, {});
};

export const getWalletStatus = async (address: string): Promise<walletstatus> => {
  return blockchainAPI.sendMessage(P2P_MESSAGE_TYPES.GET_WALLET_STATUS, { address });
};

export const createWallet = async (): Promise<createwallettres> => {
  return blockchainAPI.sendMessage(P2P_MESSAGE_TYPES.CREATE_WALLET, {});
};
