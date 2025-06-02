import { createLibp2p } from './libp2p.js'
import fs from 'fs'
import path from 'path'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { peerIdFromString } from '@libp2p/peer-id'
import { app } from 'electron'
import type { WriteStream } from 'fs'
import { Multiaddr } from '@multiformats/multiaddr'
// import { ipcMain } from 'electron'
// import type { Stream } from '@libp2p/interface'

// Protocol constants
const PEERLIST_PROTOCOL = '/peerlist/1.0.0'
const P2P_PROTOCOL = '/p2p/1.0.0'

// Store connected peers
const connectedPeers = new Map<string, {
  id: any;
  connectedAt: Date;
  lastSeen: Date;
  addresses: string[];
}>();

// Get the application data directory
const getAppDataPath = () => {
  // In development, use the project directory
  return path.join(process.cwd(), 'MasterNode')
}

// Ensure directory exists
const ensureDirectoryExists = (dirPath: string) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 })
      console.log('Created directory:', dirPath)
    }
  } catch (error) {
    console.error('Error creating directory:', dirPath, error)
    throw error
  }
}

// Initialize application directories
let appDataPath = getAppDataPath()
console.log('P2P Application data path:', appDataPath)

try {
  ensureDirectoryExists(appDataPath)
} catch (error) {
  console.error('Failed to create application directory:', error)
  // Fallback to user's home directory if app directory fails
  const homeDir = process.env.HOME || process.env.USERPROFILE
  if (homeDir) {
    const fallbackPath = path.join(homeDir, '.masternode')
    console.log('Using fallback directory:', fallbackPath)
    ensureDirectoryExists(fallbackPath)
    appDataPath = fallbackPath
  } else {
    throw new Error('Could not determine application data directory')
  }
}

// Set up file paths
const MASTER_KEY_FILE = path.join(appDataPath, 'master-key.json')
const LOG_FILE = path.join(appDataPath, 'p2p.log')

// Initialize logging
function initializeLogging() {
  try {
    // Create log file if it doesn't exist
    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, '', { mode: 0o644 })
      console.log('Created P2P log file:', LOG_FILE)
    }
    
    // Test write access
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] P2P Logging initialized\n`)
    console.log('P2P Logging initialized at:', LOG_FILE)
  } catch (error) {
    console.error('Failed to initialize P2P logging:', error)
    // Try to create the file again with different permissions
    try {
      fs.writeFileSync(LOG_FILE, '', { mode: 0o666 })
      console.log('Created P2P log file with alternative permissions:', LOG_FILE)
    } catch (retryError) {
      console.error('Failed to create P2P log file even with alternative permissions:', retryError)
    }
  }
}

// Initialize logging
initializeLogging()

// Test logging
console.log('P2P Application data path:', appDataPath)
console.log('P2P Log file path:', LOG_FILE)
console.log('P2P Master key file path:', MASTER_KEY_FILE)

function logToFile(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message} ${data ? JSON.stringify(data, null, 2) : ''}\n`
  
  // Always log to console
  console.log(`[P2P] ${message}`, data ? data : '')
  
  // Log to file
  try {
    fs.appendFileSync(LOG_FILE, logMessage)
  } catch (error) {
    console.error('Failed to write to P2P log file:', error)
  }
}

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

export interface P2PInitializationStatus {
  isReady: boolean;
  stage: string;
  error: string | null;
  progress: number;
}

export class P2PService {
  private node: any
  private peerId: any
  private isReady: boolean = false
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map()
  private initializationPromise: Promise<void> | null = null
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map()
  private initializationError: Error | null = null
  private initializationStage: string = 'not_started'
  private initializationProgress: number = 0

  constructor() {
    logToFile('P2PService constructor')
    this.initializationPromise = this.initialize()
  }

  public getInitializationStatus(): P2PInitializationStatus {
    return {
      isReady: this.isReady,
      stage: this.initializationStage,
      error: this.initializationError ? this.initializationError.message : null,
      progress: this.initializationProgress
    }
  }

  private async initialize() {
    logToFile('Initializing P2P service...')
    console.log('Initializing P2P service...')
    try {
      // Load or create peer ID
      this.initializationStage = 'loading_peer_id'
      this.initializationProgress = 10
      this.peerId = await this.loadOrCreatePeerId()
      logToFile('Peer ID loaded/created successfully')
      this.initializationProgress = 30

      // Create a new libp2p node
      this.initializationStage = 'creating_node'
      this.initializationProgress = 40
      this.node = await createLibp2p({
        peerId: this.peerId,
        addresses: {
          listen: ['/ip4/0.0.0.0/tcp/10333']
        }
      })
      logToFile('Libp2p node created')
      this.initializationProgress = 60

      // Wait for node to start
      this.initializationStage = 'starting_node'
      this.initializationProgress = 70
      await this.node.start()
      logToFile('Libp2p node started')
      this.initializationProgress = 80
      
      // Set up message handlers before marking as ready
      this.initializationStage = 'setting_up_handlers'
      this.setupMessageHandlers()
      this.setupEventListeners()
      this.initializationProgress = 90
      
      this.isReady = true
      this.initializationError = null
      this.initializationStage = 'ready'
      this.initializationProgress = 100
      logToFile('P2P service initialized successfully, isReady: ' + this.isReady)
      console.log('P2P service initialized successfully')
    } catch (error) {
      logToFile('Error initializing P2P service: ' + error)
      this.isReady = false
      this.initializationError = error instanceof Error ? error : new Error(String(error))
      this.initializationStage = 'error'
      throw this.initializationError
    }
  }

  private setupMessageHandlers() {
    // Set up default handlers for common message types
    this.onMessage('get-nodes', async (message) => {
      const peers = this.getPeers()
      return {
        type: 'nodes-response',
        data: { 
          peers: peers.map(peer => ({
            id: peer.id,
            addresses: peer.addresses,
            // You can add more peer information here if needed
          }))
        },
        timestamp: new Date().toISOString(),
        success: true
      }
    })

    // Add handler for token hash creation
    this.onMessage('token-hash-created', async (message) => {
      logToFile('Received token hash creation message', message)
      try {
        // Store the token hash in the local state
        const { serialNumber, hash } = message.data
        if (!serialNumber || !hash) {
          throw new Error('Invalid token hash data')
        }

        // Broadcast the token hash to all peers
        await this.broadcastMessage({
          type: 'token-hash-created',
          data: { serialNumber, hash },
          timestamp: new Date().toISOString()
        })

        return {
          type: 'token-hash-created',
          data: { serialNumber, hash },
          timestamp: new Date().toISOString(),
          success: true
        }
      } catch (error) {
        logToFile('Error handling token hash creation', error)
        return {
          type: 'token-hash-created',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          success: false
        }
      }
    })

    // Add handler for token hash verification
    this.onMessage('verify-token-hash', async (message) => {
      logToFile('Received token hash verification request', message)
      try {
        const { serialNumber, hash } = message.data
        if (!serialNumber || !hash) {
          throw new Error('Invalid token hash data')
        }

        // Verify the token hash
        // TODO: Implement actual verification logic
        const isValid = true // Placeholder

        return {
          type: 'token-hash-verification',
          data: { serialNumber, hash, isValid },
          timestamp: new Date().toISOString(),
          success: true
        }
      } catch (error) {
        logToFile('Error handling token hash verification', error)
        return {
          type: 'token-hash-verification',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          success: false
        }
      }
    })

    // Add other default handlers as needed
  }

  public onMessage(type: string, handler: (message: any) => Promise<any> | any): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)?.add(handler)
  }

  public async handleMessage(message: any): Promise<{
    type: string;
    data?: any;
    error?: string;
    timestamp: string;
    success: boolean;
  }> {
    try {
      console.log('[P2P Electron] Received raw message:', message)
      
      // Extract message from args if it's wrapped in an IPC message
      const actualMessage = message.args?.[0] || message
      console.log('[P2P Electron] Extracted message:', actualMessage)

      // Handle port messages differently
      if (message.sender && message.ports) {
        console.log('[P2P Electron] Received port message, skipping type validation')
        return {
          type: 'port-message',
          timestamp: new Date().toISOString(),
          success: true
        }
      }

      // Validate message structure
      if (!actualMessage || typeof actualMessage !== 'object') {
        console.error('[P2P Electron] Invalid message data:', actualMessage)
        return {
          type: 'unknown',
          error: 'Invalid message data',
          timestamp: new Date().toISOString(),
          success: false
        }
      }

      if (!actualMessage.type) {
        console.error('[P2P Electron] Message missing type field:', actualMessage)
        return {
          type: 'unknown',
          error: 'Message missing type field',
          timestamp: new Date().toISOString(),
          success: false
        }
      }

      // Validate message type
      const validTypes = Object.values(P2P_MESSAGE_TYPES)
      console.log('[P2P Electron] Valid message types:', validTypes)
      console.log('[P2P Electron] Message type to validate:', actualMessage.type)
      
      if (!validTypes.includes(actualMessage.type)) {
        console.warn(`[P2P Electron] Unknown message type: ${actualMessage.type}`)
        return {
          type: actualMessage.type,
          error: 'Unknown message type',
          timestamp: new Date().toISOString(),
          success: false
        }
      }

      // Ensure message has required fields
      const formattedMessage = {
        type: actualMessage.type,
        data: actualMessage.data || {},
        timestamp: actualMessage.timestamp || new Date().toISOString(),
        success: actualMessage.success !== undefined ? actualMessage.success : !actualMessage.error
      }
      console.log('[P2P Electron] Formatted message:', formattedMessage)

      // Get handlers for this message type
      const handlers = this.messageHandlers.get(formattedMessage.type)
      console.log('[P2P Electron] Found handlers:', handlers ? handlers.size : 0)
      
      if (handlers) {
        // Execute all handlers and collect responses
        const responses = await Promise.all(
          Array.from(handlers).map(async (handler) => {
            try {
              console.log('[P2P Electron] Calling handler for type:', formattedMessage.type)
              return await handler(formattedMessage)
            } catch (error) {
              console.error(`[P2P Electron] Error in message handler for type ${formattedMessage.type}:`, error)
              return {
                type: formattedMessage.type,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
                success: false
              }
            }
          })
        )

        // Return the first successful response, or the first error if all failed
        const successfulResponse = responses.find(r => r?.success)
        if (successfulResponse) {
          return successfulResponse
        }
        return responses[0] || {
          type: formattedMessage.type,
          error: 'No handlers processed the message successfully',
          timestamp: new Date().toISOString(),
          success: false
        }
      }

      return {
        type: formattedMessage.type,
        error: 'No handlers registered for message type',
        timestamp: new Date().toISOString(),
        success: false
      }
    } catch (error) {
      console.error('[P2P Electron] Error handling P2P message:', error)
      return {
        type: message?.type || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        success: false
      }
    }
  }

  private async loadOrCreatePeerId() {
    logToFile('Loading or creating master node peer ID...')
    try {
      // Check if master key file exists
      if (fs.existsSync(MASTER_KEY_FILE)) {
        const keyData = await fs.promises.readFile(MASTER_KEY_FILE, 'utf-8')
        const { id } = JSON.parse(keyData)
        logToFile('Loaded existing master node peer ID')
        return await peerIdFromString(id)
      } else {
        logToFile('Creating new master node peer ID')
        const peerId = await createEd25519PeerId()
        
        const keyData = {
          id: peerId.toString(),
          pubKey: peerId.publicKey?.toString()
        }
        
        // Ensure directory exists before writing
        ensureDirectoryExists(path.dirname(MASTER_KEY_FILE))
        
        await fs.promises.writeFile(MASTER_KEY_FILE, JSON.stringify(keyData, null, 2))
        logToFile('Saved new master node peer ID to: ' + MASTER_KEY_FILE)
        return peerId
      }
    } catch (error) {
      logToFile('Error in loadOrCreatePeerId: ' + error)
      throw error
    }
  }

  private setupEventListeners() {
    // Handle peer connections
    this.node.addEventListener('peer:connect', async (evt: any) => {
      const remotePeer = evt.detail
      console.log('New peer connected: ', remotePeer.toString())
      
      try {
        // Get peer addresses from the connection manager
        const connections = this.node.getConnections(remotePeer)
        console.log('Connection manager details:', {
          connections: connections.map((conn: { remoteAddr?: Multiaddr; }) => ({
            remoteAddr: conn.remoteAddr?.toString(),
          }))
        })

        // Get all known addresses for this peer
        const peerAddresses: string[] = []
        
        // Get addresses from active connections
        connections.forEach((conn: { remoteAddr?: Multiaddr }) => {
          if (conn.remoteAddr) {
            const addr = conn.remoteAddr.toString()
            if (!peerAddresses.includes(addr)) {
              peerAddresses.push(addr)
            }
          }
        })
        
        // Try to get additional addresses from the peer store
        try {
          const peerInfo = await this.node.peerStore.get(remotePeer)
          if (peerInfo?.addresses) {
            peerInfo.addresses.forEach((addr: any) => {
              const addrStr = addr.toString()
              if (!peerAddresses.includes(addrStr)) {
                peerAddresses.push(addrStr)
              }
            })
          }
        } catch (err) {
          console.log('No additional addresses found in peer store')
        }

        console.log('Peer addresses:', peerAddresses)
        
        connectedPeers.set(remotePeer.toString(), {
          id: remotePeer,
          connectedAt: new Date(),
          lastSeen: new Date(),
          addresses: peerAddresses
        })
        
        this.logPeerList()
        await this.broadcastPeerList()

        // Notify event handlers
        const handlers = this.eventHandlers.get('peer:connect')
        if (handlers) {
          handlers.forEach(handler => handler(remotePeer.toString()))
        }
      } catch (error) {
        console.warn('Error handling peer connection:', error)
        // Still add the peer with empty addresses
        connectedPeers.set(remotePeer.toString(), {
          id: remotePeer,
          connectedAt: new Date(),
          lastSeen: new Date(),
          addresses: []
        })
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

  private getPeerListString(): string {
    const peers = Array.from(connectedPeers.entries()).map(([id, peer]) => ({
      id,
      addresses: peer.addresses,
      connectedAt: peer.connectedAt.toISOString(),
      lastSeen: peer.lastSeen.toISOString()
    }))
    return JSON.stringify(peers)
  }

  private async broadcastPeerList() {
    const peerList = this.getPeerListString()
    console.log('\nBroadcasting peer list to all peers...')
    
    for (const [peerId, peer] of connectedPeers) {
      try {
        const stream = await this.node.dialProtocol(peer.id, PEERLIST_PROTOCOL)
        const encoder = new TextEncoder()
        const peerListBytes = encoder.encode(peerList)
        await stream.sink([peerListBytes])
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
        console.log(`  Addresses: ${peer.addresses.join(', ')}`)
        console.log(`  Connected at: ${peer.connectedAt.toISOString()}`)
        console.log(`  Last seen: ${peer.lastSeen.toISOString()}`)
      })
    }
    console.log()
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

      // Create a new stream for each message
      const stream = await this.node.dialProtocol(peer.id, P2P_PROTOCOL);
      
      try {
        // Create a source that yields the message
        const source = (async function* () {
          yield new TextEncoder().encode(JSON.stringify(messageWithTimestamp));
        })();

        // Send the message
        await stream.sink(source);
        
        // Update last seen timestamp
        peer.lastSeen = new Date();
      } finally {
        // Always close the stream
        await stream.close();
      }
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
    console.log("Broadcasting message:", message);

    const results = [];
    for (const [peerId, peer] of connectedPeers) {
      try {
        await this.sendMessage(peerId, message);
        results.push({ peerId, success: true });
      } catch (error) {
        console.error(`Error broadcasting to peer ${peerId}:`, error);
        results.push({ 
          peerId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    return results;
  }

  public async waitForReady(): Promise<void> {
    if (this.initializationPromise) {
      try {
        await this.initializationPromise
        if (!this.isReady) {
          throw new Error('P2P service initialization failed')
        }
      } catch (error) {
        // If initialization failed, throw the stored error
        if (this.initializationError) {
          throw this.initializationError
        }
        throw error
      }
    } else {
      throw new Error('P2P service initialization not started')
    }
  }

  public isConnected(): boolean {
    return this.isReady && 
           this.node !== null && 
           this.node !== undefined && 
           this.initializationError === null
  }

  public getInitializationError(): Error | null {
    return this.initializationError
  }

  public getPeers(): Array<{ id: string; addresses: string[] }> {
    return Array.from(connectedPeers.entries()).map(([id, peer]) => ({
      id,
      addresses: peer.addresses
    }));
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