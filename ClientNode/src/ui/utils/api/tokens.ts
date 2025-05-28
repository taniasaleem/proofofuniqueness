import { blockchainAPI } from './p2p';

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
  return blockchainAPI.sendMessage('get-tokens', {});
};
