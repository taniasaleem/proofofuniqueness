import { BASEURL, TOKENS_ENDPOINT } from "./config";

type tokentype = {
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
  const URL = BASEURL + TOKENS_ENDPOINT.alltokens;

  const res = await fetch(URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
};
