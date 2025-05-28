import { blockchainAPI } from './p2p';
import { P2P_MESSAGE_TYPES } from './config';

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
  return blockchainAPI.sendMessage(P2P_MESSAGE_TYPES.GET_TOKENS, {});
};
