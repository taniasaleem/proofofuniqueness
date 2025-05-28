const { contextBridge, ipcRenderer } = require('electron');
import type { IpcRendererEvent } from 'electron';

// Define message types for type safety
export enum MessageType {
  TEST = 'test-message',
  GET_NODES = 'get-nodes',
  GET_PEERS = 'get-peers',
  PEERS_LIST = 'peers-list',
  P2P_READY = 'p2p-ready',
  PEER_CONNECTED = 'peer-connected',
  PEER_DISCONNECTED = 'peer-disconnected'
}

// Define message interface
export interface Message {
  type: MessageType;
  data?: any;
  timestamp: string;
  channel?: string;
  broadcast?: boolean;
  peerId?: string;
  success?: boolean;
  error?: string;
}

// Define interfaces for type safety
interface IpcRenderer {
  send: (channel: string, message: Message) => void;
  on: (channel: string, func: (event: IpcRendererEvent, message: Message) => void) => void;
  removeListener: (channel: string, func: (event: IpcRendererEvent, message: Message) => void) => void;
}

interface ElectronAPI {
  ipcRenderer: IpcRenderer;
}

// Export the type for use in other files
export type { ElectronAPI };

// Declare the window interface
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

// Define valid channels
const validSendChannels = ['p2p-send', 'p2p-get-peers'];
const validReceiveChannels = ['p2p-message', 'p2p-error', 'p2p-ready', 'peer-connected', 'peer-disconnected'];

// Add logging utility
const log = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[Preload][${timestamp}] ${message}`, data);
  } else {
    console.log(`[Preload][${timestamp}] ${message}`);
  }
};

// Log environment information
log('Environment Check', {
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  processType: process.type,
  hasContextBridge: !!contextBridge,
  hasIpcRenderer: !!ipcRenderer,
  isRenderer: process.type === 'renderer'
});

// Create the API object
const electronAPI: ElectronAPI = {
  ipcRenderer: {
    send: (channel: string, message: Message) => {
      log('IPC send called', { channel, message });
      
      if (validSendChannels.includes(channel)) {
        const fullMessage: Message = {
          ...message,
          channel,
          timestamp: new Date().toISOString()
        };
        log('Sending valid IPC message', fullMessage);
        ipcRenderer.send(channel, fullMessage);
      } else {
        log('Invalid IPC channel', channel);
        throw new Error(`Invalid IPC channel: ${channel}`);
      }
    },
    on: (channel: string, func: (event: IpcRendererEvent, message: Message) => void) => {
      log('IPC on called', { channel });
      
      if (validReceiveChannels.includes(channel)) {
        const wrappedFunc = (event: IpcRendererEvent, ...args: any[]) => {
          try {
            log('IPC received message', { channel, args });
            if (args[0] && typeof args[0] === 'object') {
              const message = args[0] as Message;
              if (message.type && message.timestamp) {
                func(event, message);
              } else {
                log('Invalid message format received', message);
                throw new Error('Invalid message format');
              }
            } else {
              log('Invalid message format received');
              throw new Error('Invalid message format');
            }
          } catch (error) {
            log('Error handling IPC message', error);
            throw error;
          }
        };
        ipcRenderer.on(channel, wrappedFunc);
      } else {
        log('Invalid IPC channel', channel);
        throw new Error(`Invalid IPC channel: ${channel}`);
      }
    },
    removeListener: (channel: string, func: (event: IpcRendererEvent, message: Message) => void) => {
      if (validReceiveChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, func);
      } else {
        log('Invalid IPC channel for removeListener', channel);
        throw new Error(`Invalid IPC channel: ${channel}`);
      }
    }
  }
};

// Expose the API to the renderer process
try {
  log('Exposing API to renderer');
  contextBridge.exposeInMainWorld('electron', electronAPI);
  log('API exposed successfully via contextBridge');
} catch (error) {
  log('Error exposing API', error);
  throw error;
}

// Verify API exposure after DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
  log('=== DOM Content Loaded ===');
  
  // Check if API is available
  const hasElectron = !!(window as any).electron;
  const windowKeys = Object.keys(window);
  const electronKeys = hasElectron ? Object.keys((window as any).electron) : [];
  const electronMethods = hasElectron ? Object.keys((window as any).electron.ipcRenderer) : [];
  
  log('Preload script verification', {
    hasElectron,
    windowKeys,
    electronKeys,
    electronMethods
  });

  if (!hasElectron) {
    log('IPC functionality not available');
    throw new Error('Electron API not available in renderer process');
  } else {
    // Test IPC functionality
    log('Testing IPC functionality');
    (window as any).electron.ipcRenderer.send('p2p-send', {
      type: MessageType.TEST,
      data: { message: 'Testing IPC from preload' },
      broadcast: true
    });
  }
}); 