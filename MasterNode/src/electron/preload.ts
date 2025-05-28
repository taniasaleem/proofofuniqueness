import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';

// Define interfaces
interface IpcRenderer {
  send: (channel: string, data: any) => void;
  on: (channel: string, func: (...args: any[]) => void) => void;
  removeListener: (channel: string, func: (...args: any[]) => void) => void;
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

// Define valid channels for security
const validSendChannels = ['p2p-send', 'p2p-get-peers'];
const validReceiveChannels = ['p2p-message', 'p2p-error', 'p2p-peers-list', 'peer-connected', 'peer-disconnected'];

// Add debug logging function
const debugLog = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data ? data : '');
};

debugLog('=== Preload Script Initialization ===');
debugLog('1. Environment Check:', {
  hasContextBridge: typeof contextBridge !== 'undefined',
  hasIpcRenderer: typeof ipcRenderer !== 'undefined',
  processType: process.type,
  isRenderer: process.type === 'renderer',
  nodeVersion: process.versions.node,
  electronVersion: process.versions.electron
});

console.log('2. Initial Window State:', {
  hasElectron: !!window.electron,
  windowKeys: Object.keys(window),
  electronKeys: window.electron ? Object.keys(window.electron) : []
});

try {
  console.log('3. Attempting to expose IPC API...');
  
  // Expose IPC API to renderer
  const electronAPI = {
    ipcRenderer: {
      send: (channel: string, data: any) => {
        try {
          // Validate channel
          if (!channel || typeof channel !== 'string') {
            console.error('Invalid IPC channel:', channel);
            return;
          }

          // Validate data
          if (data === undefined) {
            console.error('IPC send called with undefined data');
            return;
          }

          // Ensure data is an object
          const messageData = typeof data === 'object' ? data : { data };

          // Add timestamp if not present
          if (!messageData.timestamp) {
            messageData.timestamp = new Date().toISOString();
          }

          // Log the message being sent
          console.log(`[${new Date().toISOString()}] IPC send called with channel: ${channel}`, messageData);

          // Send the message
          ipcRenderer.send(channel, messageData);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Error in IPC send:`, error);
        }
      },

      on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
        try {
          // Validate channel
          if (!channel || typeof channel !== 'string') {
            console.error('Invalid IPC channel:', channel);
            return;
          }

          // Validate callback
          if (typeof callback !== 'function') {
            console.error('Invalid callback function');
            return;
          }

          // Log the listener being added
          console.log(`[${new Date().toISOString()}] IPC on called with channel: ${channel}`);

          // Add the listener
          ipcRenderer.on(channel, (event, ...args) => {
            try {
              // Validate message structure
              if (!args || args.length === 0) {
                console.error('IPC received empty message');
                return;
              }

              const message = args[0];
              if (!message || typeof message !== 'object') {
                console.error('IPC received invalid message structure:', message);
                return;
              }

              // Ensure message has required fields
              if (!message.type) {
                console.error('IPC message missing type field:', message);
                return;
              }

              if (!message.timestamp) {
                message.timestamp = new Date().toISOString();
              }

              // Add success field if missing
              if (message.success === undefined) {
                message.success = !message.error;
              }

              // Call the callback with the validated message
              callback(event, message);
            } catch (error) {
              console.error('Error handling IPC message:', error);
              // Send error back to renderer
              ipcRenderer.send('p2p-error', {
                type: 'error',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
              });
            }
          });
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Error in IPC on:`, error);
        }
      },

      removeListener: (channel: string, callback: (event: any, ...args: any[]) => void) => {
        try {
          // Validate channel
          if (!channel || typeof channel !== 'string') {
            console.error('Invalid IPC channel:', channel);
            return;
          }

          // Validate callback
          if (typeof callback !== 'function') {
            console.error('Invalid callback function');
            return;
          }

          // Log the listener being removed
          console.log(`[${new Date().toISOString()}] IPC removeListener called with channel: ${channel}`);

          // Remove the listener
          ipcRenderer.removeListener(channel, callback);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Error in IPC removeListener:`, error);
        }
      }
    }
  };

  console.log('4. API Object Created:', {
    hasIpcRenderer: !!electronAPI.ipcRenderer,
    methods: Object.keys(electronAPI.ipcRenderer)
  });

  // Expose the API
  console.log('5. Exposing API to renderer...');
  
  // Ensure we're in a renderer process
  if (process.type === 'renderer') {
    // Use a more direct approach to expose the API
    (window as any).electron = electronAPI;
    
    // Also try contextBridge as a backup
    try {
      contextBridge.exposeInMainWorld('electron', electronAPI);
    } catch (error) {
      console.warn('contextBridge exposure failed, using direct assignment:', error);
    }
  } else {
    throw new Error('Not in renderer process');
  }

  console.log('6. Post-exposure Window State:', {
    hasElectron: !!window.electron,
    windowKeys: Object.keys(window),
    electronKeys: window.electron ? Object.keys(window.electron) : [],
    electronMethods: window.electron?.ipcRenderer ? Object.keys(window.electron.ipcRenderer) : []
  });

  console.log('=== Preload Script Initialization Complete ===');
} catch (error) {
  console.error('=== Preload Script Error ===');
  console.error('Failed to expose IPC API:', error);
  console.error('Error state window:', {
    hasElectron: !!window.electron,
    windowKeys: Object.keys(window),
    electronKeys: window.electron ? Object.keys(window.electron) : []
  });
}

// Verify API exposure after DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log('=== DOM Content Loaded ===');
  console.log('1. Preload script verification:', {
    hasElectron: !!window.electron,
    windowKeys: Object.keys(window),
    electronKeys: window.electron ? Object.keys(window.electron) : [],
    electronMethods: window.electron?.ipcRenderer ? Object.keys(window.electron.ipcRenderer) : []
  });

  // Test IPC functionality
  if (window.electron?.ipcRenderer) {
    console.log('2. Testing IPC functionality...');
    // try {
    //   window.electron.ipcRenderer.send('p2p-send', {
    //     type: 'test-message',
    //     data: { message: 'Testing IPC from DOMContentLoaded' }
    //   });
    //   console.log('3. IPC test message sent successfully');
    // } catch (error) {
    //   console.error('3. IPC test failed:', error);
    // }
  } else {
    console.error('2. IPC functionality not available');
  }
}); 