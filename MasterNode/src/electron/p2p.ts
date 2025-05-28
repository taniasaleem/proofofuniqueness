import { createLibp2p } from './libp2p.js'
import fs from 'fs/promises'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { peerIdFromString } from '@libp2p/peer-id'
const { ipcMain } = require('electron')
import type { Stream } from '@libp2p/interface'
import { EventEmitter } from 'events'
import { MessageType, type Message } from './preload.js'
import type { IpcMainEvent } from 'electron'

// Store connected peers
const connectedPeers = new Map()
const MASTER_KEY_FILE = 'master-key.json'
const PEERLIST_PROTOCOL = '/peerlist/1.0.0'
const P2P_PROTOCOL = '/p2p/1.0.0'
const P2P_TIMEOUT = 5000 // 5 seconds timeout for P2P operations

// Add logging utility
const log = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[P2P][${timestamp}] ${message}`, data);
  } else {
    console.log(`[P2P][${timestamp}] ${message}`);
  }
};

export class P2PService extends EventEmitter {
  private node: any
  private peerId: any
  private isReady: boolean = false
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map()

  constructor() {
    super();
    this.initialize();
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
          log('Sending peer list:', peerList)
          await stream.sink([new TextEncoder().encode(peerList)])
          await stream.close()
        } catch (err) {
          log('Error sending peer list:', err)
          throw err
        }
      })

      // Handle P2P protocol
      this.node.handle(P2P_PROTOCOL, async ({ stream }: { stream: Stream }) => {
        try {
          const data = await stream.source.next()
          if (data.value) {
            const message = JSON.parse(new TextDecoder().decode(data.value)) as Message
            await this.handleP2PMessage(message)
          }
          await stream.close()
        } catch (err) {
          log('Error handling P2P message:', err)
          throw err
        }
      })

      // Set up event listeners
      this.setupEventListeners()

      this.isReady = true
      this.emit('ready')
      log('P2P service initialized successfully')
    } catch (error) {
      log('Error initializing P2P service:', error)
      this.emit('error', error)
      throw error
    }
  }

  private async loadOrCreatePeerId() {
    try {
      const keyData = await fs.readFile(MASTER_KEY_FILE, 'utf-8')
      const { id } = JSON.parse(keyData)
      log('Loaded existing master node peer ID')
      return await peerIdFromString(id)
    } catch (err) {
      log('Creating new master node peer ID')
      const peerId = await createEd25519PeerId()
      
      const keyData = {
        id: peerId,
        pubKey: peerId.publicKey
      }
      
      await fs.writeFile(MASTER_KEY_FILE, JSON.stringify(keyData, null, 2))
      log('Saved new master node peer ID')
      return peerId
    }
  }

  private setupEventListeners() {
    // Handle peer connections
    this.node.addEventListener('peer:connect', async (evt: any) => {
      const remotePeer = evt.detail
      if (!remotePeer) {
        log('Invalid peer connection event')
        return
      }

      log('New peer connected:', remotePeer.toString())
      
      connectedPeers.set(remotePeer.toString(), {
        id: remotePeer,
        connectedAt: new Date(),
        lastSeen: new Date()
      })
      
      this.logPeerList()
      await this.broadcastPeerList()

      // Notify event handlers
      this.emit('peer:connect', remotePeer.toString())
    })

    // Handle peer disconnections
    this.node.addEventListener('peer:disconnect', async (evt: any) => {
      const remotePeer = evt.detail
      if (!remotePeer) {
        log('Invalid peer disconnection event')
        return
      }

      log('Peer disconnected:', remotePeer.toString())
      
      connectedPeers.delete(remotePeer.toString())
      
      this.logPeerList()
      await this.broadcastPeerList()

      // Notify event handlers
      this.emit('peer:disconnect', remotePeer.toString())
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
    log('Broadcasting peer list to all peers...')
    
    for (const [peerId, peer] of connectedPeers) {
      try {
        const stream = await this.node.dialProtocol(peer.id, PEERLIST_PROTOCOL)
        await stream.sink([new TextEncoder().encode(peerList)])
        await stream.close()
        log(`Sent peer list to: ${peerId}`)
      } catch (err) {
        log(`Error broadcasting to peer ${peerId}:`, err)
      }
    }
  }

  private logPeerList() {
    log('Current connected peers:')
    if (connectedPeers.size === 0) {
      log('No peers connected')
    } else {
      connectedPeers.forEach((peer, id) => {
        log(`- ${id}`)
        log(`  Connected at: ${peer.connectedAt.toISOString()}`)
        log(`  Last seen: ${peer.lastSeen.toISOString()}`)
      })
    }
  }

  private async handleP2PMessage(message: Message) {
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message format')
    }

    if (!message.type || !Object.values(MessageType).includes(message.type)) {
      throw new Error(`Invalid message type: ${message.type}`)
    }

    log('Received P2P message:', message)
    
    switch (message.type) {
      case MessageType.TEST:
        log('Handling test message:', message.data)
        break
      case MessageType.GET_NODES:
        await this.handleGetNodes(message)
        break
      case MessageType.GET_PEERS:
        await this.handleGetPeers(message)
        break
      case MessageType.PEERS_LIST:
        await this.handlePeersList(message)
        break
      default:
        log('Unknown message type:', message.type)
    }
  }

  private async handleGetNodes(message: Message) {
    log('Handling get nodes request:', message)
    // Implement get nodes logic
  }

  private async handleGetPeers(message: Message) {
    log('Handling get peers request:', message)
    // Implement get peers logic
  }

  private async handlePeersList(message: Message) {
    log('Handling peers list:', message)
    // Implement peers list handling logic
  }

  public async sendMessage(peerId: string, message: Message) {
    if (!this.isReady) {
      throw new Error('P2P service not ready')
    }

    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('P2P operation timeout')), P2P_TIMEOUT)
    )

    try {
      const peer = connectedPeers.get(peerId)
      if (!peer) {
        throw new Error(`Peer ${peerId} not found`)
      }

      const stream = await Promise.race([
        this.node.dialProtocol(peer.id, P2P_PROTOCOL),
        timeout
      ])

      await Promise.race([
        stream.sink([new TextEncoder().encode(JSON.stringify(message))]),
        timeout
      ])

      await stream.close()
      log('Message sent successfully to peer:', peerId)
    } catch (error) {
      log('Error sending P2P message:', error)
      throw error
    }
  }

  public async broadcastMessage(message: Message) {
    if (!this.isReady) {
      throw new Error('P2P service not ready')
    }

    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('P2P operation timeout')), P2P_TIMEOUT)
    )

    log('Broadcasting message to all peers:', message)
    
    for (const [peerId, peer] of connectedPeers) {
      try {
        const stream = await Promise.race([
          this.node.dialProtocol(peer.id, P2P_PROTOCOL),
          timeout
        ])

        await Promise.race([
          stream.sink([new TextEncoder().encode(JSON.stringify(message))]),
          timeout
        ])

        await stream.close()
        log(`Message broadcasted to peer: ${peerId}`)
      } catch (error) {
        log(`Error broadcasting to peer ${peerId}:`, error)
      }
    }
  }

  public isConnected(): boolean {
    return this.isReady && this.node.isStarted()
  }

  public getPeers(): string[] {
    return Array.from(connectedPeers.keys())
  }

  public onPeerConnect(handler: (peerId: string) => void): void {
    this.on('peer:connect', handler)
  }

  public onPeerDisconnect(handler: (peerId: string) => void): void {
    this.on('peer:disconnect', handler)
  }
}

// Create and export a singleton instance
export const p2pService = new P2PService()

// Set up IPC handlers
ipcMain.on('p2p-send', async (event: IpcMainEvent, message: Message) => {
  try {
    await p2pService.broadcastMessage(message)
    event.reply('p2p-message', { success: true })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    event.reply('p2p-error', { error: errorMessage })
  }
})

ipcMain.on('p2p-get-peers', (event: IpcMainEvent) => {
  event.reply('p2p-peers-list', p2pService.getPeers())
}) 
