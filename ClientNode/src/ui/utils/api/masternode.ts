import { blockchainAPI } from './p2p';

export type nodetype = {
  address: string;
  timestamp: number;
  wallet: {
    address: string;
  };
};

export const getAllNodes = async (): Promise<nodetype[]> => {
  return blockchainAPI.getAllNodes();
};

export const addIdentity = async (address: string, privateKey: string) => {
  return blockchainAPI.addNode({ address, privateKey });
};

export const verifyTokenHash = async (serialNumber: string, hash: string) => {
  return blockchainAPI.sendMessage('verify-token', { serialNumber, hash });
};
