import { BASEURL, WALLET_ENDPOINTS } from "./config";

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
  const URL = BASEURL + WALLET_ENDPOINTS.allwallets;

  const res = await fetch(URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
};

export const getWalletStatus = async (
  address: string
): Promise<walletstatus> => {
  const URL = BASEURL + WALLET_ENDPOINTS.walletstatus + address;

  const res = await fetch(URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  return res.json();
};

export const createWallet = async (): Promise<createwallettres> => {
  const URL = BASEURL + WALLET_ENDPOINTS.createwallet;

  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  return res.json();
};
