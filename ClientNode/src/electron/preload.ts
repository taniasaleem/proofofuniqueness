const { contextBridge, ipcRenderer } = require('electron');
const { IpcRendererEvent } = require('electron');

console.log('[Preload] Starting preload script initialization');

interface Peer {
  id: string
  connectedAt: string
  lastSeen: string
}

interface NodeInfo {
  peerId: string
  addresses: string[]
}

interface P2PAPI {
  getPeers: () => Promise<Peer[]>
  getNodeInfo: () => Promise<NodeInfo>
  sendMessage: (type: string, data: any) => Promise<void>
  onMessage: (handler: (message: any) => void) => void
  offMessage: (handler: (message: any) => void) => void
}

// Define valid channels for type safety
const validChannels = [
  'p2p:connected',
  'p2p:disconnected',
  'p2p:error',
  'p2p:message',
  'p2p:peers-updated',
  'p2p:connect',
  'p2p:disconnect',
  'p2p:send-message',
  'p2p:get-node-info',
  'p2p:get-peers',
  'p2p:get-status'
] as const;

type ValidChannel = typeof validChannels[number];
type IpcRendererFunction = (...args: any[]) => void;

// Create a custom event emitter for the renderer process
class RendererEventEmitter {
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private ipcListeners: Map<string, boolean> = new Map();

  on(channel: string, callback: (...args: any[]) => void) {
    console.log(`[EventEmitter] Adding listener for channel: ${channel}`);
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)?.add(callback);
    
    // Set up IPC listener if not already set up
    if (!this.ipcListeners.get(channel)) {
      console.log(`[EventEmitter] Setting up IPC listener for channel: ${channel}`);
      ipcRenderer.on(channel, (event: typeof IpcRendererEvent, ...args: any[]) => {
        console.log(`[EventEmitter] Received message on channel: ${channel}`, args);
        this.emit(channel, ...args);
      });
      this.ipcListeners.set(channel, true);
    }
  }

  removeListener(channel: string, callback: (...args: any[]) => void) {
    console.log(`[EventEmitter] Removing listener for channel: ${channel}`);
    this.listeners.get(channel)?.delete(callback);
  }

  emit(channel: string, ...args: any[]) {
    console.log(`[EventEmitter] Emitting event on channel: ${channel}`, args);
    this.listeners.get(channel)?.forEach(callback => callback(...args));
  }
}

const eventEmitter = new RendererEventEmitter();

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
  console.log('[Preload] Setting up IPC bridge');
  
  // Expose P2P API
  contextBridge.exposeInMainWorld('p2p', {
    getStatus: () => ipcRenderer.invoke('p2p:get-status'),
    getPeers: () => ipcRenderer.invoke('p2p:get-peers'),
    sendMessage: (type: string, data: any) => ipcRenderer.invoke('p2p:send-message', { type, data }),
    onMessage: (callback: (message: any) => void) => {
      ipcRenderer.on('p2p:message', (_event: Electron.IpcRendererEvent, message: any) => callback(message));
    },
    onConnected: (callback: () => void) => {
      ipcRenderer.on('p2p:connected', () => callback());
    },
    onDisconnected: (callback: () => void) => {
      ipcRenderer.on('p2p:disconnected', () => callback());
    },
    onError: (callback: (error: any) => void) => {
      ipcRenderer.on('p2p:error', (_event: Electron.IpcRendererEvent, error: any) => callback(error));
    }
  });

  // Expose electron API
  contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
      on: (channel: ValidChannel, func: IpcRendererFunction) => {
        console.log(`[Preload] Setting up listener for channel: ${channel}`);
        if (validChannels.includes(channel)) {
          eventEmitter.on(channel, func);
        } else {
          console.warn(`[Preload] Attempted to listen to invalid channel: ${channel}`);
        }
      },
      removeListener: (channel: ValidChannel, func: IpcRendererFunction) => {
        console.log(`[Preload] Removing listener for channel: ${channel}`);
        if (validChannels.includes(channel)) {
          eventEmitter.removeListener(channel, func);
        } else {
          console.warn(`[Preload] Attempted to remove listener from invalid channel: ${channel}`);
        }
      },
      invoke: (channel: ValidChannel, ...args: any[]) => {
        console.log(`[Preload] Invoking channel ${channel} with args:`, args);
        if (validChannels.includes(channel)) {
          return ipcRenderer.invoke(channel, ...args);
        }
        console.warn(`[Preload] Attempted to invoke invalid channel: ${channel}`);
        return Promise.reject(new Error(`Invalid channel: ${channel}`));
      }
    }
  });
  
  console.log('[Preload] IPC bridge setup completed successfully');
} catch (error) {
  console.error('[Preload] Error setting up IPC bridge:', error);
  throw error;
}