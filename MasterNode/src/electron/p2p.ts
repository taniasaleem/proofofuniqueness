import { createLibp2p } from './libp2p.js'
import fs from 'fs/promises'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { peerIdFromString } from '@libp2p/peer-id'
import { ipcMain } from 'electron'
import type { Stream } from '@libp2p/interface'

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
  TOKEN_HASH_CREATED: 'token-hash-created'
} as const;

export type P2PMessageType = keyof typeof P2P_MESSAGE_TYPES;

// Store connected peers
const connectedPeers = new Map()
const MASTER_KEY_FILE = 'master-key.json'
const PEERLIST_PROTOCOL = '/peerlist/1.0.0'
const P2P_PROTOCOL = '/p2p/1.0.0'

export class P2PService {
  private node: any
  private peerId: any
  private isReady: boolean = false
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map()

  constructor() {
    this.initialize()
  }

  private async initialize() {
    try {
      // Load or create peer ID
      this.peerId = await this.loadOrCreatePeerId()

      // Create a new libp2p node
      this.node = await createLibp2p({
        peerId: this.peerId,
        addresses: {
          listen: ['/ip4/0.0.0.0/tcp/10333']
        }
      })

      // Handle peer list protocol
      this.node.handle(PEERLIST_PROTOCOL, async ({ stream }: { stream: Stream }) => {
        try {
          const peerList = this.getPeerListString()
          console.log('Sending peer list:', peerList)
          await stream.sink([new TextEncoder().encode(peerList)])
          await stream.close()
        } catch (err) {
          console.error('Error sending peer list:', err)
        }
      })

      // Handle P2P protocol
      this.node.handle(P2P_PROTOCOL, async ({ stream }: { stream: Stream }) => {
        try {
          const data = await stream.source.next()
          if (data.value) {
            const message = JSON.parse(new TextDecoder().decode(data.value))
            this.handleMessage(message)
          }
          await stream.close()
        } catch (err) {
          console.error('Error handling P2P message:', err)
        }
      })

      // Set up event listeners
      this.setupEventListeners()

      this.isReady = true
      console.log('P2P service initialized successfully')
    } catch (error) {
      console.error('Error initializing P2P service:', error)
    }
  }

  private async loadOrCreatePeerId() {
    try {
      const keyData = await fs.readFile(MASTER_KEY_FILE, 'utf-8')
      const { id } = JSON.parse(keyData)
      console.log('Loaded existing master node peer ID')
      return await peerIdFromString(id)
    } catch (err) {
      console.log('Creating new master node peer ID')
      const peerId = await createEd25519PeerId()
      
      const keyData = {
        id: peerId,
        pubKey: peerId.publicKey
      }
      
      await fs.writeFile(MASTER_KEY_FILE, JSON.stringify(keyData, null, 2))
      console.log('Saved new master node peer ID')
      return peerId
    }
  }

  private setupEventListeners() {
    // Handle peer connections
    this.node.addEventListener('peer:connect', async (evt: any) => {
      const remotePeer = evt.detail
      console.log('New peer connected: ', remotePeer.toString())
      
      connectedPeers.set(remotePeer.toString(), {
        id: remotePeer,
        connectedAt: new Date(),
        lastSeen: new Date()
      })
      
      this.logPeerList()
      await this.broadcastPeerList()

      // Notify event handlers
      const handlers = this.eventHandlers.get('peer:connect')
      if (handlers) {
        handlers.forEach(handler => handler(remotePeer.toString()))
      }
    })

    // Handle peer disconnections
    this.node.addEventListener('peer:disconnect', async (evt: any) => {
      const remotePeer = evt.detail
      console.log('Peer disconnected: ', remotePeer.toString())
      
      connectedPeers.delete(remotePeer.toString())
      
      this.logPeerList()
      await this.broadcastPeerList()

      // Notify event handlers
      const handlers = this.eventHandlers.get('peer:disconnect')
      if (handlers) {
        handlers.forEach(handler => handler(remotePeer.toString()))
      }
    })
  }

  private getPeerListString() {
    const peerList = Array.from(connectedPeers.entries()).map(([id, peer]) => ({
      id,
      connectedAt: peer.connectedAt.toISOString(),
      lastSeen: peer.lastSeen.toISOString()
    }))
    return JSON.stringify(peerList)
  }

  private async broadcastPeerList() {
    const peerList = this.getPeerListString()
    console.log('\nBroadcasting peer list to all peers...')
    
    for (const [peerId, peer] of connectedPeers) {
      try {
        const stream = await this.node.dialProtocol(peer.id, PEERLIST_PROTOCOL)
        await stream.sink([new TextEncoder().encode(peerList)])
        await stream.close()
        console.log(`Sent peer list to: ${peerId}`)
      } catch (err) {
        console.error(`Error broadcasting to peer ${peerId}:`, err)
      }
    }
  }

  private logPeerList() {
    console.log('\nCurrent connected peers:')
    if (connectedPeers.size === 0) {
      console.log('No peers connected')
    } else {
      connectedPeers.forEach((peer, id) => {
        console.log(`- ${id}`)
        console.log(`  Connected at: ${peer.connectedAt.toISOString()}`)
        console.log(`  Last seen: ${peer.lastSeen.toISOString()}`)
      })
    }
    console.log()
  }

  private handleMessage(message: any) {
    try {
      console.log('[P2P Electron] Received raw message:', message);
      
      // Extract message from args if it's wrapped in an IPC message
      const actualMessage = message.args?.[0] || message;
      console.log('[P2P Electron] Extracted message:', actualMessage);

      // Handle port messages differently
      if (message.sender && message.ports) {
        console.log('[P2P Electron] Received port message, skipping type validation');
        return;
      }

      // Validate message structure
      if (!actualMessage || typeof actualMessage !== 'object') {
        console.error('[P2P Electron] Invalid message data:', actualMessage);
        return;
      }

      if (!actualMessage.type) {
        console.error('[P2P Electron] Message missing type field:', actualMessage);
        return;
      }

      // Validate message type
      const validTypes = Object.values(P2P_MESSAGE_TYPES);
      console.log('[P2P Electron] Valid message types:', validTypes);
      console.log('[P2P Electron] Message type to validate:', actualMessage.type);
      
      if (!validTypes.includes(actualMessage.type)) {
        console.warn(`[P2P Electron] Unknown message type: ${actualMessage.type}`);
        return;
      }

      // Ensure message has required fields
      const formattedMessage = {
        type: actualMessage.type,
        data: actualMessage.data || {},
        timestamp: actualMessage.timestamp || new Date().toISOString(),
        success: actualMessage.success !== undefined ? actualMessage.success : !actualMessage.error
      };
      console.log('[P2P Electron] Formatted message:', formattedMessage);

      // Notify handlers
      const handlers = this.eventHandlers.get(formattedMessage.type);
      console.log('[P2P Electron] Found handlers:', handlers ? handlers.size : 0);
      
      if (handlers) {
        handlers.forEach(handler => {
          try {
            console.log('[P2P Electron] Calling handler for type:', formattedMessage.type);
            handler(formattedMessage);
          } catch (error) {
            console.error(`[P2P Electron] Error in message handler for type ${formattedMessage.type}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('[P2P Electron] Error handling P2P message:', error);
    }
  }

  public async sendMessage(peerId: string, message: any) {
    if (!this.isReady) {
      throw new Error('P2P service not ready');
    }

    try {
      if (!message || typeof message !== 'object') {
        throw new Error('Invalid message format');
      }

      if (!message.type) {
        throw new Error('Message must include a type field');
      }

      const peer = connectedPeers.get(peerId);
      if (!peer) {
        throw new Error(`Peer ${peerId} not found`);
      }

      // Ensure message has timestamp
      const messageWithTimestamp = {
        ...message,
        timestamp: new Date().toISOString()
      };

      const stream = await this.node.dialProtocol(peer.id, P2P_PROTOCOL);
      await stream.sink([new TextEncoder().encode(JSON.stringify(messageWithTimestamp))]);
      await stream.close();
      
      // Update last seen timestamp
      peer.lastSeen = new Date();
    } catch (error) {
      console.error('Error sending P2P message:', error);
      throw error;
    }
  }

  public async broadcastMessage(message: any) {
    if (!this.isReady) {
      throw new Error('P2P service not ready');
    }

    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message format');
    }

    if (!message.type) {
      throw new Error('Message must include a type field');
    }

    const results = [];
    for (const [peerId, peer] of connectedPeers) {
      try {
        await this.sendMessage(peerId, message);
        results.push({ peerId, success: true });
      } catch (error) {
        console.error(`Error broadcasting to peer ${peerId}:`, error);
        results.push({ peerId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    return results;
  }

  public isConnected(): boolean {
    return this.isReady
  }

  public getPeers(): string[] {
    return Array.from(connectedPeers.keys())
  }

  public onPeerConnect(handler: (peerId: string) => void): void {
    if (!this.eventHandlers.has('peer:connect')) {
      this.eventHandlers.set('peer:connect', new Set())
    }
    this.eventHandlers.get('peer:connect')?.add(handler)
  }

  public onPeerDisconnect(handler: (peerId: string) => void): void {
    if (!this.eventHandlers.has('peer:disconnect')) {
      this.eventHandlers.set('peer:disconnect', new Set())
    }
    this.eventHandlers.get('peer:disconnect')?.add(handler)
  }
}

// Create and export a singleton instance
export const p2pService = new P2PService()

// Set up IPC handlers
ipcMain.on('p2p-send', async (event, message) => {
  console.log('[P2P IPC] Received message:', message);
  try {
    if (!message || typeof message !== 'object') {
      console.error('[P2P IPC] Invalid message format');
      throw new Error('Invalid message format');
    }

    if (!message.type) {
      console.error('[P2P IPC] Message missing type field');
      throw new Error('Message must include a type field');
    }

    console.log('[P2P IPC] Broadcasting message to peers');
    const results = await p2pService.broadcastMessage(message);
    console.log('[P2P IPC] Broadcast results:', results);
    
    event.reply('p2p-message', { 
      type: message.type,
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
    console.log('[P2P IPC] Sent response to renderer');
  } catch (error: unknown) {
    console.error('[P2P IPC] Error handling message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    event.reply('p2p-error', { 
      type: 'error',
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

ipcMain.on('p2p-get-peers', (event) => {
  try {
    const peers = p2pService.getPeers();
    event.reply('p2p-peers-list', {
      type: 'peers-list',
      data: peers,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    event.reply('p2p-error', {
      type: 'error',
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
}); 