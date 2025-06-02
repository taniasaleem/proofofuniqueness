import { createLibp2p } from './libp2p.js'
import { multiaddr, Multiaddr } from '@multiformats/multiaddr'
import { ipcMain, BrowserWindow } from 'electron'
import { Libp2p } from 'libp2p'
import type { PeerId } from '@libp2p/interface-peer-id'
import { Uint8ArrayList } from 'uint8arraylist'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { peerIdFromString } from '@libp2p/peer-id'
import fs from 'fs'
import path from 'path'

// Get the application data directory
const getAppDataPath = () => {
  // In development, use the project directory
  return path.join(process.cwd(), 'ClientNode')
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
    const fallbackPath = path.join(homeDir, '.clientnode')
    console.log('Using fallback directory:', fallbackPath)
    ensureDirectoryExists(fallbackPath)
    appDataPath = fallbackPath
  } else {
    throw new Error('Could not determine application data directory')
  }
}

// Set up file paths
const CLIENT_KEY_FILE = path.join(appDataPath, 'client-key.json')

interface Peer {
  id: string
  connectedAt: string
  lastSeen: string
}

interface PeerMap {
  [key: string]: Peer
}

export class P2PService {
  private clientnode: Libp2p | null
  private peerId: any
  private connectedPeers: Map<string, Peer>
  private isConnecting: boolean
  private readonly MASTER_ADDRESSES: string[]
  private readonly INITIAL_RETRY_INTERVAL: number
  private readonly MAX_RETRY_INTERVAL: number
  private readonly RETRY_BACKOFF_FACTOR: number
  private retryInterval: number
  private readonly PEERLIST_PROTOCOL: string
  private readonly MESSAGE_PROTOCOL: string
  private remotePeer: PeerId | null
  private mainWindow: BrowserWindow | null
  private reconnectTimeout: NodeJS.Timeout | null
  private connectionAttempts: number
  private nodeInitialized: boolean = false

  constructor() {
    this.clientnode = null
    this.peerId = null
    this.connectedPeers = new Map()
    this.isConnecting = false
    this.MASTER_ADDRESSES = [
      '/ip4/127.0.0.1/tcp/10333',
      '/ip4/172.24.128.1/tcp/10333',
      '/ip4/192.168.100.54/tcp/10333'
    ]
    this.INITIAL_RETRY_INTERVAL = 5000 // 5 seconds
    this.MAX_RETRY_INTERVAL = 300000   // 5 minutes
    this.RETRY_BACKOFF_FACTOR = 1.5
    this.retryInterval = this.INITIAL_RETRY_INTERVAL
    this.PEERLIST_PROTOCOL = '/peerlist/1.0.0'
    this.MESSAGE_PROTOCOL = '/p2p/1.0.0'
    this.remotePeer = null
    this.mainWindow = BrowserWindow.getAllWindows()[0] || null
    this.reconnectTimeout = null
    this.connectionAttempts = 0
  }

  private async loadOrCreatePeerId(): Promise<any> {
    console.log('[P2PService] Loading or creating client peer ID...')
    try {
      // Check if client key file exists
      if (fs.existsSync(CLIENT_KEY_FILE)) {
        const keyData = await fs.promises.readFile(CLIENT_KEY_FILE, 'utf-8')
        const { id } = JSON.parse(keyData)
        console.log('[P2PService] Loaded existing client peer ID')
        return await peerIdFromString(id)
      } else {
        console.log('[P2PService] Creating new client peer ID')
        const peerId = await createEd25519PeerId()
        
        const keyData = {
          id: peerId.toString(),
          pubKey: peerId.publicKey?.toString()
        }
        
        // Ensure directory exists before writing
        ensureDirectoryExists(path.dirname(CLIENT_KEY_FILE))
        
        await fs.promises.writeFile(CLIENT_KEY_FILE, JSON.stringify(keyData, null, 2))
        console.log('[P2PService] Saved new client peer ID to: ' + CLIENT_KEY_FILE)
        return peerId
      }
    } catch (error) {
      console.error('[P2PService] Error in loadOrCreatePeerId:', error)
      throw error
    }
  }

  async initialize(): Promise<Libp2p> {
    console.log('[P2PService] Starting initialization');
    try {
      if (this.nodeInitialized && this.clientnode) {
        console.log('[P2PService] Node already initialized');
        return this.clientnode;
      }

      // Load or create peer ID first
      this.peerId = await this.loadOrCreatePeerId();
      console.log('[P2PService] Peer ID loaded/created:', this.peerId.toString());

      console.log('[P2PService] Creating libp2p configuration');
      const config = {
        addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
        peerId: this.peerId
      }
      
      console.log('[P2PService] Creating libp2p instance');
      this.clientnode = await createLibp2p(config);
      
      if (!this.clientnode) {
        console.error('[P2PService] Failed to create libp2p instance - clientnode is null');
        throw new Error('Failed to create libp2p instance');
      }

      console.log('[P2PService] Setting up event listeners');
      this.setupEventListeners();
      
      console.log('[P2PService] Setting up IPC handlers');
      this.setupIpcHandlers();
      
      this.nodeInitialized = true;
      console.log('[P2PService] Node initialization completed successfully');

      // Start connection attempts in the background
      this.startConnectionAttempts();
      
      return this.clientnode;
    } catch (error) {
      console.error('[P2PService] Error during initialization:', error);
      if (error instanceof Error) {
        console.error('[P2PService] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  private setupEventListeners(): void {
    console.log('[P2PService] Setting up event listeners');
    if (!this.clientnode) {
      console.error('[P2PService] Cannot setup event listeners - clientnode is null');
      throw new Error('P2P client not initialized');
    }

    // Register protocol handler
    this.clientnode.handle(this.MESSAGE_PROTOCOL, async ({ stream }) => {
      try {
        let data = new Uint8Array(0);
        for await (const chunk of stream.source) {
          const buffer = (chunk as Uint8ArrayList).subarray();
          const chunkArray = new Uint8Array(buffer);
          const newData = new Uint8Array(data.length + chunkArray.length);
          newData.set(data);
          newData.set(chunkArray, data.length);
          data = newData;
        }
        
        if (data.length > 0) {
          const messageStr = new TextDecoder().decode(data);
          if (messageStr.trim()) {
            const message = JSON.parse(messageStr);
            console.log('[P2PService] Received message:', message);
            // Forward message to renderer process
            if (this.mainWindow) {
              this.mainWindow.webContents.send('p2p:message', message);
            }
          }
        }
      } catch (err) {
        console.error('[P2PService] Error handling message:', err);
      }
    });

    this.clientnode.addEventListener('peer:disconnect', (evt: any) => {
      const remotePeer = evt.detail;
      console.log('[P2PService] Peer disconnected:', remotePeer.toString());
      this.connectedPeers.delete(remotePeer.toString());
      this.logPeerList();
      
      if (this.remotePeer?.toString() === remotePeer.toString()) {
        console.log('[P2PService] Disconnected from master node, attempting to reconnect...');
        // Notify main window about disconnection
        if (this.mainWindow) {
          this.mainWindow.webContents.send('p2p:disconnected');
        }
        // Start connection attempts again
        this.startConnectionAttempts();
      }
    });

    this.clientnode.addEventListener('peer:connect', async (evt: any) => {
      this.remotePeer = evt.detail;
      if (!this.remotePeer) return;
      
      const peerId = this.remotePeer.toString();
      console.log('Peer connected:', peerId);
      
      this.connectedPeers.set(peerId, {
        id: peerId,
        connectedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      });
      
      // Stop any ongoing connection attempts since we're now connected
      this.stopConnectionAttempts();
      
      // Notify main window about connection
      if (this.mainWindow) {
        console.log('[P2PService] Notifying main window about peer connection');
        this.mainWindow.webContents.send('p2p:connected');
      }
      
      this.logPeerList();
      await this.requestPeerList();
    });

    this.clientnode.handle(this.PEERLIST_PROTOCOL, async ({ stream }) => {
      try {
        let data = new Uint8Array(0);
        for await (const chunk of stream.source) {
          const buffer = (chunk as Uint8ArrayList).subarray();
          const chunkArray = new Uint8Array(buffer);
          const newData = new Uint8Array(data.length + chunkArray.length);
          newData.set(data);
          newData.set(chunkArray, data.length);
          data = newData;
        }
        
        if (data.length > 0) {
          const peerListStr = new TextDecoder().decode(data);
          if (peerListStr.trim()) {
            const peers = JSON.parse(peerListStr) as Peer[];
            this.updatePeerList(peers);
          }
        }
      } catch (err) {
        console.error('Error handling peer list:', err);
      }
    });
  }

  private setupIpcHandlers(): void {
    console.log('[P2PService] Setting up IPC handlers');
    if (!this.clientnode) {
      console.error('[P2PService] Cannot setup IPC handlers - clientnode is null');
      throw new Error('P2P client not initialized');
    }

    ipcMain.handle('p2p:getPeers', () => {
      console.log('[P2PService] Handling getPeers request');
      return Array.from(this.connectedPeers.values());
    });

    ipcMain.handle('p2p:getNodeInfo', () => {
      console.log('[P2PService] Handling getNodeInfo request');
      if (!this.clientnode) {
        console.error('[P2PService] Cannot get node info - clientnode is null');
        throw new Error('P2P client not initialized');
      }
      return {
        peerId: this.clientnode.peerId.toString(),
        addresses: this.clientnode.getMultiaddrs().map(ma => ma.toString())
      };
    });
  }

  public startConnectionAttempts() {
    if (this.isConnecting || this.isConnected()) {
      console.log('[P2PService] Already connecting or connected, skipping connection attempts');
      return;
    }

    console.log('[P2PService] Starting connection attempts to master node');
    this.isConnecting = true;
    this.connectionAttempts = 0;
    this.retryInterval = this.INITIAL_RETRY_INTERVAL;
    this.attemptConnection();
  }

  private async attemptConnection() {
    if (!this.isConnecting) {
      console.log('[P2PService] Connection attempts stopped');
      return;
    }

    if (this.isConnected()) {
      console.log('[P2PService] Already connected to master node, stopping connection attempts');
      this.stopConnectionAttempts();
      return;
    }

    try {
      console.log(`[P2PService] Attempting to connect to master node (attempt ${this.connectionAttempts + 1})`);
      await this.tryConnectToMaster();
      
      if (this.isConnected()) {
        console.log('[P2PService] Successfully connected to master node');
        this.stopConnectionAttempts();
        if (this.mainWindow) {
          this.mainWindow.webContents.send('p2p:connected');
        }
        return;
      }
    } catch (error) {
      console.log('[P2PService] Connection attempt failed:', error);
    }

    // Only schedule next attempt if we're still not connected and still trying
    if (!this.isConnected() && this.isConnecting) {
      this.connectionAttempts++;
      // Calculate next retry interval with exponential backoff
      this.retryInterval = Math.min(
        this.retryInterval * this.RETRY_BACKOFF_FACTOR,
        this.MAX_RETRY_INTERVAL
      );

      console.log(`[P2PService] Retrying in ${this.retryInterval/1000} seconds...`);
      
      // Schedule next attempt
      this.reconnectTimeout = setTimeout(() => {
        this.attemptConnection();
      }, this.retryInterval);
    }
  }

  private async connectToMaster(ma: Multiaddr): Promise<void> {
    if (!this.clientnode) return;
    
    try {
      console.log('[P2PService] Attempting to dial to master node...');
      await this.clientnode.dial(ma);
      console.log('[P2PService] Successfully dialed to master node');
      
      // Stop any ongoing connection attempts since we're now connected
      this.stopConnectionAttempts();
      
      // Notify main window about successful connection
      if (this.mainWindow) {
        console.log('[P2PService] Notifying main window about successful connection');
        this.mainWindow.webContents.send('p2p:connected');
      }
    } catch (err) {
      console.log(`[P2PService] Failed to connect to master node: ${err}`);
      throw err;
    }
  }

  public stopConnectionAttempts() {
    console.log('[P2PService] Stopping connection attempts');
    this.isConnecting = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private async tryConnectToMaster(): Promise<void> {
    if (this.isConnected()) {
      console.log('[P2PService] Already connected to master node, skipping connection attempt');
      return;
    }

    for (const addr of this.MASTER_ADDRESSES) {
      try {
        const ma = multiaddr(addr)
        await this.connectToMaster(ma)
        if (this.isConnected()) {
          console.log(`[P2PService] Successfully connected to master node at ${addr}`)
          return
        }
      } catch (err) {
        console.log(`Failed to connect to ${addr}, trying next address...`)
      }
    }
  }

  private async requestPeerList(): Promise<void> {
    if (!this.clientnode || !this.remotePeer) {
      console.log('[P2PService] Cannot request peer list: not connected to master node');
      return;
    }

    try {
      console.log('[P2PService] Requesting peer list from master node');
      const stream = await this.clientnode.dialProtocol(this.remotePeer as any, this.PEERLIST_PROTOCOL);
      let data = new Uint8Array(0);
      
      for await (const chunk of stream.source) {
        const buffer = (chunk as Uint8ArrayList).subarray();
        const chunkArray = new Uint8Array(buffer);
        const newData = new Uint8Array(data.length + chunkArray.length);
        newData.set(data);
        newData.set(chunkArray, data.length);
        data = newData;
      }
      
      if (data.length > 0) {
        const peerListStr = new TextDecoder().decode(data);
        if (peerListStr.trim()) {
          const peers = JSON.parse(peerListStr) as Peer[];
          this.updatePeerList(peers);
        }
      }
    } catch (err) {
      console.error('[P2PService] Error requesting peer list:', err);
    }
  }

  private updatePeerList(peers: Peer[]): void {
    if (!this.clientnode) return;

    console.log('[P2PService] Updating peer list with:', peers);
    peers.forEach(peer => {
      if (peer.id !== this.clientnode?.peerId.toString()) {
        this.connectedPeers.set(peer.id, {
          id: peer.id,
          connectedAt: peer.connectedAt,
          lastSeen: peer.lastSeen
        });
      }
    });

    // Notify about peer list update
    if (this.mainWindow) {
      this.mainWindow.webContents.send('p2p:peers-updated', Array.from(this.connectedPeers.values()));
    }

    this.logPeerList();
  }

  private logPeerList(): void {
    console.log('\n[P2PService] Current connected peers:');
    if (this.connectedPeers.size === 0) {
      console.log('[P2PService] No peers connected');
    } else {
      this.connectedPeers.forEach((peer, id) => {
        console.log(`- ${id}`);
        console.log(`  Connected at: ${peer.connectedAt}`);
        console.log(`  Last seen: ${peer.lastSeen}`);
      });
    }
    console.log();
  }

  async stop(): Promise<void> {
    this.stopConnectionAttempts();
    if (this.clientnode) {
      await this.clientnode.stop();
    }
  }

  public async getNodeInfo(): Promise<{ peerId: string; addresses: string[] }> {
    if (!this.nodeInitialized || !this.clientnode) {
      await this.initialize();
    }

    if (!this.clientnode) {
      throw new Error('P2P client not initialized');
    }

    return {
      peerId: this.clientnode.peerId.toString(),
      addresses: this.clientnode.getMultiaddrs().map(ma => ma.toString())
    };
  }

  async getPeers(): Promise<Peer[]> {
    if (!this.nodeInitialized || !this.clientnode) {
      console.log('[P2PService] Cannot get peers: node not initialized');
      return [];
    }

    if (!this.isConnected()) {
      console.log('[P2PService] Cannot get peers: not connected to master node');
      return [];
    }

    // Convert Map to array
    const peerList = Array.from(this.connectedPeers.values());
    console.log('[P2PService] Returning peer list:', peerList);
    return peerList;
  }

  async handleMessage(type: string, data: any): Promise<void> {
    if (!this.clientnode || !this.remotePeer) {
      throw new Error('P2P client not initialized or not connected')
    }

    try {
      const message = {
        type,
        data,
        timestamp: new Date().toISOString(),
        clientId: this.clientnode.peerId.toString()
      }

      console.log('[P2PService] Sending message:', message);
      const stream = await this.clientnode.dialProtocol(this.remotePeer as any, this.MESSAGE_PROTOCOL)
      const encoder = new TextEncoder()
      const messageBytes = encoder.encode(JSON.stringify(message))
      const source = (async function* () {
        yield messageBytes
      })()
      await stream.sink(source)
      console.log('[P2PService] Message sent successfully');
    } catch (err) {
      console.error('[P2PService] Error sending message:', err)
      throw err
    }
  }

  public isConnected(): boolean {
    return this.nodeInitialized && 
           this.clientnode !== null && 
           this.remotePeer !== null && 
           this.clientnode.getConnections().some(conn => 
             conn.remotePeer.toString() === this.remotePeer?.toString()
           );
  }

  public isInitialized(): boolean {
    return this.nodeInitialized;
  }
} 