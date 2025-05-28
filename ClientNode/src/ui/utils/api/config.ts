// P2P message types
export const P2P_MESSAGE_TYPES = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Node Management
  GET_NODES: 'get-nodes',
  NODES_RESPONSE: 'nodes-response',
  NODE_CONNECTED: 'node-connected',
  NODE_DISCONNECTED: 'node-disconnected',

  // Chain Operations
  GET_CHAIN_INFO: 'get-chain-info',
  CHAIN_INFO: 'chain-info',
  GET_SUPPLY_INFO: 'get-supply-info',
  SUPPLY_INFO: 'supply-info',
  SYNC_REQUEST: 'sync-request',
  SYNC_RESPONSE: 'sync-response',
  CHOOSE_PROPOSER: 'choose-proposer',

  // Transaction Operations
  CREATE_TRANSACTION: 'create-transaction',
  TRANSACTION_CREATED: 'transaction-created',
  GET_BALANCE: 'get-balance',
  BALANCE_RESPONSE: 'balance-response',
  VERIFY_TRANSACTION: 'verify-transaction',
  TRANSACTION_VERIFIED: 'transaction-verified',

  // Block Operations
  VERIFY_BLOCK: 'verify-block',
  BLOCK_VERIFIED: 'block-verified',

  // Token Operations
  VERIFY_TOKEN_HASH: 'verify-token-hash',
  TOKEN_HASH_VERIFICATION: 'token-hash-verification',
  TOKEN_HASH_CREATED: 'token-hash-created',

  // Wallet Operations
  GET_WALLETS: 'get-wallets',
  WALLETS_RESPONSE: 'wallets-response',
  GET_WALLET_STATUS: 'get-wallet-status',
  WALLET_STATUS_RESPONSE: 'wallet-status-response',
  CREATE_WALLET: 'create-wallet',
  WALLET_CREATED: 'wallet-created'
} as const;

export type P2PMessageType = keyof typeof P2P_MESSAGE_TYPES;

export const TX_ENDPOINTS = {
  createtransaction: "/transaction",
  addressbalance: "/balance/", // requires address -> balance/0x123...
  verifyblockhash: "/hash",
};

export const WALLET_ENDPOINTS = {
  allwallets: "/wallets",
  createwallet: "/wallet/create",
  walletstatus: "/address/status/", // requires address -> /address/status/0x123...
};

export const CHAIN_ENDPOINTS = {
  chaininfo: "/chain/info",
  getsupply: "/supply",
  chooseproposer: "/choose-proposer",
  syncnodes: "/force-sync",
};

export const TOKENS_ENDPOINT = {
  alltokens: "/tokens",
};

export const MASTERNODE_ENDPOINTS = {
  allnodes: "/nodes",
  addid: "/add-identity",
};
