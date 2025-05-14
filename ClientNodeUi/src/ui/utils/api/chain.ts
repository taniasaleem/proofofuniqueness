import { BASEURL, CHAIN_ENDPOINTS } from "./config";

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
  const URL = BASEURL + CHAIN_ENDPOINTS.chooseproposer;

  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });

  return res.json();
};

export const getChainSupplyInfo = async (): Promise<chainsupply> => {
  const URL = BASEURL + CHAIN_ENDPOINTS.getsupply;

  const res = await fetch(URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  return res.json();
};

export const getChainInfo = async (): Promise<chaininfo> => {
  const URL = BASEURL + CHAIN_ENDPOINTS.chaininfo;

  const res = await fetch(URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  return res.json();
};

export const syncWithNodes = async (peerUrl: string): Promise<syncres> => {
  const URL = BASEURL + CHAIN_ENDPOINTS.syncnodes;

  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ peerUrl }),
  });
  return res.json();
};
