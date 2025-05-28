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

  // Wallet Operations
  GET_WALLETS: 'get-wallets',
  GET_WALLET_STATUS: 'get-wallet-status',
  CREATE_WALLET: 'create-wallet',

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

  // Test Messages
  TEST_MESSAGE: 'test-message'
} as const;

export type P2PMessageType = keyof typeof P2P_MESSAGE_TYPES;

// P2P Configuration
export const P2P_CONFIG = {
  // Connection settings
  RECONNECT_INTERVAL: 5000, // 5 seconds
  MAX_RECONNECT_ATTEMPTS: 5,
  
  // Message settings
  MESSAGE_TIMEOUT: 30000, // 30 seconds
  MAX_MESSAGE_SIZE: 1024 * 1024, // 1MB
  
  // Peer settings
  MAX_PEERS: 50,
  MIN_PEERS: 3,
  
  // Discovery settings
  DISCOVERY_INTERVAL: 60000, // 1 minute
  BOOTSTRAP_NODES: [
    // Add bootstrap nodes here if needed
  ],
  MESSAGE_TYPES: P2P_MESSAGE_TYPES
} as const;

// API Configuration
export const API_CONFIG = {
  // Rate limiting
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 100,
  
  // Timeouts
  REQUEST_TIMEOUT: 30000, // 30 seconds
  
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000 // 1 second
} as const; 