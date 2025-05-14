import CryptoJS from 'crypto-js';
import EC from 'elliptic';
const ec = new EC.ec('secp256k1');

// Add type definition for KeyPair
type KeyPair = ReturnType<typeof ec.genKeyPair>;

function log(msg: string, level: string = 'INFO') {
  console.log(`[${new Date().toISOString()}] [${level}] ${msg}`);
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

class Transaction {
  fromAddress: string;
  toAddress: string;
  amount: number;
  timestamp: number;
  signature?: string;

  constructor(fromAddress: string, toAddress: string, amount: number, timestamp?: number) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.timestamp = timestamp || Date.now();
  }

  calculateHash(): string {
    return CryptoJS.SHA256(
      this.fromAddress + this.toAddress + this.amount + this.timestamp
    ).toString();
  }

  signTransaction(signingKey: KeyPair): void {
    if (signingKey.getPublic('hex') !== this.fromAddress) {
      throw new Error('You cannot sign transactions for other wallets!');
    }
    const hashTx = this.calculateHash();
    const sig = signingKey.sign(hashTx, 'base64');
    this.signature = sig.toDER('hex');
  }

  isValid(): boolean {
    if (this.fromAddress === null) return true;
    if (!this.signature || this.signature.length === 0) {
      throw new Error('No signature in this transaction');
    }
    const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
    return publicKey.verify(this.calculateHash(), this.signature);
  }
}

class Block {
  timestamp: number;
  transactions: Transaction[];
  previousHash: string;
  nonce: number;
  validators: string[];
  hash: string;

  constructor(timestamp: number, transactions: Transaction[], previousHash: string = '') {
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.validators = [];
    this.hash = this.calculateHash();
  }

  calculateHash(): string {
    return CryptoJS.SHA256(
      this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce
    ).toString();
  }

  hasValidTransactions(): boolean {
    for (const tx of this.transactions) {
      if (!tx.isValid()) return false;
    }
    return true;
  }
}

class NodeToken {
  serialNumber: string;
  bankID: string;
  bankTimestamp: number;
  nodeType: string;
  ledgerTimestamp: number;
  tokenHash: string;
  signature: string | null;

  constructor(serialNumber: string, bankID: string, bankTimestamp: number, nodeType: string = 'S') {
    this.serialNumber = serialNumber;
    this.bankID = bankID;
    this.bankTimestamp = bankTimestamp;
    this.nodeType = nodeType;
    this.ledgerTimestamp = Date.now();
    this.tokenHash = this.calculateTokenHash();
    this.signature = null;
  }

  calculateTokenHash(): string {
    return CryptoJS.SHA256(
      this.bankID + this.bankTimestamp + this.ledgerTimestamp + this.serialNumber + this.nodeType
    ).toString();
  }

  signToken(masterNodeKey: KeyPair): void {
    const hashToken = this.calculateTokenHash();
    const sig = masterNodeKey.sign(hashToken, 'base64');
    this.signature = sig.toDER('hex');
  }

  isValid(masterNodePublicKey: string): boolean {
    if (!this.signature || this.signature.length === 0) {
      throw new Error('No signature in this node token');
    }
    const tokenHash = this.calculateTokenHash();
    const key = ec.keyFromPublic(masterNodePublicKey, 'hex');
    return key.verify(tokenHash, this.signature);
  }
}

class Blockchain {
  chain: Block[];
  pendingTransactions: Transaction[];
  miningReward: number;
  nodes: Map<string, NodeToken>;
  masterNodePublicKey: string | null;
  proposers: string[];
  nodeTokens: Map<string, NodeToken>;
  nodeAddresses: Map<string, string>;
  consensusThreshold: number;

  constructor(consensusThreshold: number = 0.6) {
    this.chain = [this.createGenesisBlock()];
    this.pendingTransactions = [];
    this.miningReward = 1;
    this.nodes = new Map();
    this.masterNodePublicKey = null;
    this.proposers = [];
    this.nodeTokens = new Map();
    this.nodeAddresses = new Map();
    this.consensusThreshold = consensusThreshold; // 60% by default
  }

  createGenesisBlock(): Block {
    return new Block(Date.parse('2023-01-01'), [], '0');
  }

  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  registerNode(serialNumber: string, nodeWalletAddress: string, nodeToken: NodeToken): boolean {
    if (!nodeToken.isValid(this.masterNodePublicKey!)) {
      throw new Error('Invalid node token');
    }
    this.nodeTokens.set(serialNumber, nodeToken);
    this.nodeAddresses.set(serialNumber, nodeWalletAddress);
    this.nodes.set(nodeWalletAddress, nodeToken);
    log(`Node registered: ${serialNumber} with address ${nodeWalletAddress}`);
    return true;
  }

  isAuthorizedNode(nodeAddress: string): boolean {
    return this.nodes.has(nodeAddress);
  }

  selectProposers(N: number = 3): string[] {
    const activeNodes = Array.from(this.nodes.keys()).filter(address =>
      this.isAuthorizedNode(address)
    );
    if (activeNodes.length < N) {
      throw new Error(`Not enough active nodes. Need ${N}, have ${activeNodes.length}`);
    }
    const shuffled = shuffleArray([...activeNodes]);
    this.proposers = shuffled.slice(0, N);
    return this.proposers;
  }

  createBlockProposal(proposerAddress: string): Block {
    if (!this.isAuthorizedNode(proposerAddress)) {
      throw new Error('Node not authorized to create a block proposal');
    }
    if (!this.proposers.includes(proposerAddress)) {
      throw new Error('Node not selected as a proposer for the current block');
    }
    const rewardTx = new Transaction('', proposerAddress, this.miningReward, Date.now());
    const validTransactions = [...this.pendingTransactions, rewardTx];
    const block = new Block(Date.now(), validTransactions, this.getLatestBlock().hash);
    return block;
  }

  voteOnProposal(block: Block, nodeAddress: string): boolean {
    if (!this.isAuthorizedNode(nodeAddress)) return false;
    if (block.previousHash !== this.getLatestBlock().hash) return false;
    if (!block.hasValidTransactions()) return false;
    if (!block.validators.includes(nodeAddress)) {
      block.validators.push(nodeAddress);
    }
    return true;
  }

  addBlockWithConsensus(block: Block): boolean {
    const requiredValidators = Math.ceil(this.nodes.size * this.consensusThreshold);
    if (block.validators.length < requiredValidators) {
      throw new Error('Block does not have enough validators for consensus');
    }
    this.chain.push(block);
    this.pendingTransactions = [];
    return true;
  }

  addTransaction(transaction: Transaction): boolean {
    if (!transaction.fromAddress || !transaction.toAddress) {
      throw new Error('Transaction must include from and to address');
    }
    if (!transaction.isValid()) {
      throw new Error('Cannot add invalid transaction to chain');
    }
    const senderBalance = this.getBalanceOfAddress(transaction.fromAddress);
    if (senderBalance < transaction.amount) {
      throw new Error('Not enough balance');
    }
    this.pendingTransactions.push(transaction);
    return true;
  }

  getBalanceOfAddress(address: string): number {
    let balance = 0;
    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.fromAddress === address) balance -= trans.amount;
        if (trans.toAddress === address) balance += trans.amount;
      }
    }
    return balance;
  }

  isChainValid(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];
      if (!currentBlock.hasValidTransactions()) return false;
      if (currentBlock.hash !== currentBlock.calculateHash()) return false;
      if (currentBlock.previousHash !== previousBlock.hash) return false;
    }
    return true;
  }
}

class Wallet {
  keyPair: any;
  privateKey: string;
  publicKey: string;

  constructor() {
    this.keyPair = ec.genKeyPair();
    this.privateKey = this.keyPair.getPrivate('hex');
    this.publicKey = this.keyPair.getPublic('hex');
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  sign(data: string): any {
    return this.keyPair.sign(data);
  }
}

class Node {
  blockchain: Blockchain;
  wallet: Wallet;
  serialNumber: string;
  nodeType: string;
  isActivated: boolean;

  constructor(blockchain: Blockchain) {
    this.blockchain = blockchain;
    this.wallet = new Wallet();
    this.serialNumber = this.generateSerialNumber();
    this.nodeType = 'S';
    this.isActivated = false;
  }

  generateSerialNumber(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let serialNumber = '';
    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      serialNumber += characters.charAt(randomIndex);
    }
    return serialNumber;
  }

  activate(nodeToken: NodeToken): boolean {
    if (nodeToken.serialNumber !== this.serialNumber) {
      throw new Error('Token serial number does not match node serial number');
    }
    if (!nodeToken.isValid(this.blockchain.masterNodePublicKey!)) {
      throw new Error('Invalid node token');
    }
    this.blockchain.registerNode(
      this.serialNumber,
      this.wallet.getPublicKey(),
      nodeToken
    );
    this.isActivated = true;
    this.nodeType = nodeToken.nodeType;
    log(`Node ${this.serialNumber} activated successfully`);
    return true;
  }

  canParticipateInConsensus(): boolean {
    return this.isActivated &&
           this.blockchain.isAuthorizedNode(this.wallet.getPublicKey());
  }

  proposeBlock(): Block {
    if (!this.canParticipateInConsensus()) {
      throw new Error('Node not authorized to propose blocks');
    }
    return this.blockchain.createBlockProposal(this.wallet.getPublicKey());
  }

  voteOnProposal(block: Block): boolean {
    if (!this.canParticipateInConsensus()) {
      throw new Error('Node not authorized to vote on proposals');
    }
    return this.blockchain.voteOnProposal(block, this.wallet.getPublicKey());
  }
}

class MasterNode extends Node {
  masterKeyPair: KeyPair;
  masterPublicKey: string;

  constructor(blockchain: Blockchain) {
    super(blockchain);
    this.masterKeyPair = ec.genKeyPair();
    this.masterPublicKey = this.masterKeyPair.getPublic('hex');
    this.blockchain.masterNodePublicKey = this.masterPublicKey;
    this.nodeType = 'M';
    this.isActivated = true;
  }

  createNodeToken(serialNumber: string, bankID: string, bankTimestamp: number, nodeType: string = 'S'): NodeToken {
    const nodeToken = new NodeToken(serialNumber, bankID, bankTimestamp, nodeType);
    nodeToken.signToken(this.masterKeyPair);
    return nodeToken;
  }
}

export {
  Blockchain,
  MasterNode,
  Node,
  NodeToken,
  Transaction,
  Block,
  Wallet,
  log
}; 