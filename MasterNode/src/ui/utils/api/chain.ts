import { blockchainAPI, ChainInfo, ChainSupply, SyncResponse } from './websocket';

export type chainsupply = ChainSupply;
export type chaininfo = ChainInfo;
export type syncres = SyncResponse;

export const chooseBlockProposer = async (address: string): Promise<{ message: string }> => {
  return blockchainAPI.sendMessage('choose-proposer', { address });
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
