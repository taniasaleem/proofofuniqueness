import { blockchainAPI } from './p2p';
import { P2P_MESSAGE_TYPES } from './config';

export type chainsupply = {
  maxSupply: number;
  currentSupply: number;
  blockReward: number;
  nextHalvingBlock: number;
};

export type chaininfo = {
  height: number;
  latestBlockHash: string;
  accounts: number;
  currentSupply: number;
  peers: number;
  fee: number;
};

export type syncres = {
  success: boolean;
  message: string;
};

export const chooseBlockProposer = async (
  address: string
): Promise<{ message: string }> => {
  return blockchainAPI.sendMessage(P2P_MESSAGE_TYPES.CHOOSE_PROPOSER, { address });
};

export const getChainSupplyInfo = async (): Promise<chainsupply> => {
  return blockchainAPI.getSupplyInfo();
};

export const getChainInfo = async (): Promise<chaininfo> => {
  return blockchainAPI.getChainInfo();
};

export const syncWithNodes = async (peerUrl: string): Promise<syncres> => {
  return blockchainAPI.syncWithNodes(peerUrl);
};
