import { blockchainAPI, ChainInfo, ChainSupply, SyncResponse } from './p2p';
import { P2P_MESSAGE_TYPES } from './config';

export type chainsupply = ChainSupply;
export type chaininfo = ChainInfo;
export type syncres = SyncResponse;

export const chooseBlockProposer = async (address: string): Promise<{ message: string }> => {
  return blockchainAPI.sendMessage(P2P_MESSAGE_TYPES.CHOOSE_PROPOSER, { address });
};

export const getChainSupplyInfo = async (): Promise<chainsupply> => {
  return blockchainAPI.getSupplyInfo();
};

export const getChainInfo = async (): Promise<chaininfo> => {
  return blockchainAPI.getChainInfo();
};

export const syncWithNodes = async (peerUrl: string): Promise<syncres> => {
  return blockchainAPI.sendMessage('sync-request', { peerUrl });
};
