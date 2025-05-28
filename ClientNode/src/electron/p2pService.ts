import { createLibp2p, Libp2pConfig } from './libp2p.js'
import { multiaddr, Multiaddr } from '@multiformats/multiaddr'
import { ipcMain, BrowserWindow } from 'electron'
import { Libp2p } from 'libp2p'
import type { PeerId } from '@libp2p/interface-peer-id'
import { Uint8ArrayList } from 'uint8arraylist'

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
  private connectedPeers: Map<string, Peer>
  private isConnecting: boolean
  private readonly MASTER_ADDRESSES: string[]
  private readonly RETRY_INTERVAL: number
  private readonly MAX_RETRIES: number
  private retryCount: number
  private readonly PEERLIST_PROTOCOL: string
  private readonly MESSAGE_PROTOCOL: string
  private remotePeer: PeerId | null
  private mainWindow: BrowserWindow | null
  private reconnectTimeout: NodeJS.Timeout | null

  constructor() {
    this.clientnode = null
    this.connectedPeers = new Map()
    this.isConnecting = false
    this.MASTER_ADDRESSES = [
      '/ip4/127.0.0.1/tcp/10333',
      '/ip4/172.24.128.1/tcp/10333',
      '/ip4/192.168.100.54/tcp/10333'
    ]
    this.RETRY_INTERVAL = 5000
    this.MAX_RETRIES = 5
    this.retryCount = 0
    this.PEERLIST_PROTOCOL = '/peerlist/1.0.0'
    this.MESSAGE_PROTOCOL = '/token/1.0.0'
    this.remotePeer = null
    this.mainWindow = BrowserWindow.getAllWindows()[0] || null
    this.reconnectTimeout = null
  }

  async initialize(): Promise<Libp2p> {
    console.log('[P2PService] Starting initialization');
    try {
      console.log('[P2PService] Creating libp2p configuration');
      const config: Libp2pConfig = {
        addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] }
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
      
      console.log('[P2PService] Connecting to master node');
      await this.tryConnectToMaster();

      console.log('[P2PService] Initialization completed successfully');
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
        this.connectToMaster(multiaddr(this.MASTER_ADDRESSES[0]));
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

  private async connectToMaster(ma: Multiaddr): Promise<void> {
    if (this.isConnecting || !this.clientnode) return
    
    this.isConnecting = true
    try {
      console.log('Attempting to dial to master node...')
      await this.clientnode.dial(ma)
      console.log('Successfully dialed to master node')
      this.retryCount = 0 // Reset retry count on successful connection
    } catch (err) {
      console.log(`Failed to connect to master node, retrying in ${this.RETRY_INTERVAL / 1000}s...`)
      this.retryCount++
      
      if (this.retryCount >= this.MAX_RETRIES) {
        console.error('Maximum retry attempts reached')
        this.isConnecting = false
        return
      }

      // Clear any existing timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
      }

      // Schedule reconnection
      this.reconnectTimeout = setTimeout(() => {
        this.isConnecting = false
        this.connectToMaster(ma)
      }, this.RETRY_INTERVAL)
    } finally {
      if (!this.reconnectTimeout) {
        this.isConnecting = false
      }
    }
  }

  private async tryConnectToMaster(): Promise<void> {
    for (const addr of this.MASTER_ADDRESSES) {
      try {
        const ma = multiaddr(addr)
        await this.connectToMaster(ma)
        if (this.isConnected()) {
          console.log(`Successfully connected to master node at ${addr}`)
          return
        }
      } catch (err) {
        console.log(`Failed to connect to ${addr}, trying next address...`)
      }
    }
  }

  private async requestPeerList(): Promise<void> {
    if (!this.clientnode || !this.remotePeer) return

    try {
      const stream = await this.clientnode.dialProtocol(this.remotePeer as any, this.PEERLIST_PROTOCOL)
      let data = new Uint8Array(0)
      for await (const chunk of stream.source) {
        const buffer = (chunk as Uint8ArrayList).subarray()
        const chunkArray = new Uint8Array(buffer)
        const newData = new Uint8Array(data.length + chunkArray.length)
        newData.set(data)
        newData.set(chunkArray, data.length)
        data = newData
      }
      
      if (data.length > 0) {
        const peerListStr = new TextDecoder().decode(data)
        if (peerListStr.trim()) {
          const peers = JSON.parse(peerListStr) as Peer[]
          this.updatePeerList(peers)
        }
      }
    } catch (err) {
      console.error('Error requesting peer list:', err)
    }
  }

  private updatePeerList(peers: Peer[]): void {
    if (!this.clientnode) return

    peers.forEach(peer => {
      if (peer.id !== this.clientnode?.peerId.toString()) {
        this.connectedPeers.set(peer.id, {
          id: peer.id,
          connectedAt: peer.connectedAt,
          lastSeen: peer.lastSeen
        })
      }
    })
    this.logPeerList()
  }

  private logPeerList(): void {
    console.log('\nCurrent connected peers:')
    if (this.connectedPeers.size === 0) {
      console.log('No peers connected')
    } else {
      this.connectedPeers.forEach((peer, id) => {
        console.log(`- ${id}`)
        console.log(`  Connected at: ${peer.connectedAt}`)
        console.log(`  Last seen: ${peer.lastSeen}`)
      })
    }
    console.log()
  }

  async stop(): Promise<void> {
    if (this.clientnode) {
      await this.clientnode.stop()
    }
  }

  async getNodeInfo(): Promise<{ peerId: string; addresses: string[] }> {
    if (!this.clientnode) {
      throw new Error('P2P client not initialized')
    }
    return {
      peerId: this.clientnode.peerId.toString(),
      addresses: this.clientnode.getMultiaddrs().map(ma => ma.toString())
    }
  }

  async getPeers(): Promise<Peer[]> {
    return Array.from(this.connectedPeers.values())
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

  isConnected(): boolean {
    return this.clientnode !== null && this.remotePeer !== null && !this.isConnecting;
  }
} 