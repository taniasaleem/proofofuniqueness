import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { mdns } from '@libp2p/mdns'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import defaultsDeep from '@nodeutils/defaults-deep'
import { createLibp2p as create, Libp2p, Libp2pOptions } from 'libp2p'

export interface Libp2pConfig extends Libp2pOptions {
  addresses?: {
    listen?: string[]
  }
}

export async function createLibp2p(options: Libp2pConfig): Promise<Libp2p> {
  const defaults = {
    transports: [
      tcp(),
      webSockets()
    ],
    streamMuxers: [
      yamux()
    ],
    connectionEncrypters: [
      noise()
    ],
    peerDiscovery: [
      mdns()
    ]
  }

  return create(defaultsDeep(options, defaults))
} 