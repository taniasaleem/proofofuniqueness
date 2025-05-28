import { createLibp2p } from './libp2p.js'
import fs from 'fs/promises'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { peerIdFromString } from '@libp2p/peer-id'
import { ipcMain } from 'electron'
import type { Stream } from '@libp2p/interface'

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
            this.handleP2PMessage(message)
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

  private async handleP2PMessage(message: any) {
    console.log('Received P2P message:', message)
    
    // Handle different message types
    switch (message.type) {
      case 'token-hash-registered':
        // Handle token hash registration
        break
      case 'token-verification':
        // Handle token verification
        break
      default:
        console.log('Unknown message type:', message.type)
    }
  }

  public async sendMessage(peerId: string, message: any) {
    if (!this.isReady) {
      throw new Error('P2P service not ready')
    }

    try {
      const peer = connectedPeers.get(peerId)
      if (!peer) {
        throw new Error(`Peer ${peerId} not found`)
      }

      const stream = await this.node.dialProtocol(peer.id, P2P_PROTOCOL)
      await stream.sink([new TextEncoder().encode(JSON.stringify(message))])
      await stream.close()
    } catch (error) {
      console.error('Error sending P2P message:', error)
      throw error
    }
  }

  public async broadcastMessage(message: any) {
    if (!this.isReady) {
      throw new Error('P2P service not ready')
    }

    for (const [peerId, peer] of connectedPeers) {
      try {
        await this.sendMessage(peerId, message)
      } catch (error) {
        console.error(`Error broadcasting to peer ${peerId}:`, error)
      }
    }
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
  try {
    await p2pService.broadcastMessage(message)
    event.reply('p2p-message', { success: true })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    event.reply('p2p-error', { error: errorMessage })
  }
})

ipcMain.on('p2p-get-peers', (event) => {
  event.reply('p2p-peers-list', p2pService.getPeers())
}) 