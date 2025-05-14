export const BASEURL = "ws://localhost:8080"; // Local WebSocket server
export const MASTERNODE_BASEURL = "ws://localhost:8080/master"; // Local WebSocket server for master node

// Remove all HTTPS endpoints and keep only WebSocket message types
export const WS_MESSAGE_TYPES = {
  // Node Management
  GET_NODES: 'get-nodes',
  NODES_RESPONSE: 'nodes-response',
  ADD_NODE: 'add-node',
  NODE_ADDED: 'node-added',
  
  // Token Management
  REGISTER_TOKEN_HASH: 'register-token-hash',
  TOKEN_HASH_REGISTERED: 'token-hash-registered',
  VERIFY_TOKEN_HASH: 'verify-token-hash',
  TOKEN_HASH_VERIFICATION: 'token-hash-verification',
  
  // Chain Operations
  GET_CHAIN_INFO: 'get-chain-info',
  CHAIN_INFO: 'chain-info',
  GET_SUPPLY_INFO: 'get-supply-info',
  SUPPLY_INFO: 'supply-info',
  
  // Transaction Operations
  CREATE_TRANSACTION: 'create-transaction',
  TRANSACTION_CREATED: 'transaction-created',
  GET_BALANCE: 'get-balance',
  BALANCE_RESPONSE: 'balance-response',
  
  // Block Operations
  VERIFY_BLOCK: 'verify-block',
  BLOCK_VERIFICATION: 'block-verification',
  
  // Node Synchronization
  SYNC_NODES: 'sync-nodes',
  SYNC_COMPLETE: 'sync-complete'
}; 