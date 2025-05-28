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
const validReceiveChannels = ['p2p-message', 'p2p-error', 'p2p-peers-list'];

console.log('=== Preload Script Initialization ===');
console.log('1. Environment Check:', {
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
  
  // Create the API object
  const electronAPI = {
    ipcRenderer: {
      send: (channel: string, data: any) => {
        console.log('IPC send called with channel:', channel, 'data:', data);
        
        if (!data) {
          console.error('IPC send called with undefined data');
          return;
        }
        if (typeof data !== 'object') {
          console.error('IPC send called with non-object data:', data);
          return;
        }
        if (!data.type) {
          console.error('IPC send called with data missing type:', data);
          return;
        }

        if (validSendChannels.includes(channel)) {
          try {
            console.log('Sending valid IPC message:', {
              channel,
              type: data.type,
              timestamp: new Date().toISOString()
            });
            ipcRenderer.send(channel, data);
          } catch (error) {
            console.error('Error sending IPC message:', error);
          }
        } else {
          console.warn(`Attempted to send to unauthorized channel: ${channel}`);
          throw new Error(`Unauthorized channel: ${channel}`);
        }
      },
      on: (channel: string, func: (...args: any[]) => void) => {
        console.log('IPC on called with channel:', channel);
        if (validReceiveChannels.includes(channel)) {
          ipcRenderer.on(channel, (event, ...args) => {
            try {
              console.log('IPC received message:', { channel, args });
              if (!args || args.length === 0) {
                console.error('IPC received empty message');
                return;
              }

              const message = args[0];
              if (!message || typeof message !== 'object') {
                console.error('IPC received invalid message structure:', message);
                return;
              }

              if (!message.type) {
                message.type = channel;
              }

              func(...args);
            } catch (error) {
              console.error('Error handling IPC message:', error);
            }
          });
        } else {
          console.warn(`Attempted to listen to unauthorized channel: ${channel}`);
          throw new Error(`Unauthorized channel: ${channel}`);
        }
      },
      removeListener: (channel: string, func: (...args: any[]) => void) => {
        console.log('IPC removeListener called with channel:', channel);
        if (validReceiveChannels.includes(channel)) {
          console.log('Removing listener for channel:', channel);
          ipcRenderer.removeListener(channel, func);
        } else {
          console.warn(`Attempted to remove listener from unauthorized channel: ${channel}`);
          throw new Error(`Unauthorized channel: ${channel}`);
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
    try {
      window.electron.ipcRenderer.send('p2p-send', {
        type: 'test-message',
        data: { message: 'Testing IPC from DOMContentLoaded' }
      });
      console.log('3. IPC test message sent successfully');
    } catch (error) {
      console.error('3. IPC test failed:', error);
    }
  } else {
    console.error('2. IPC functionality not available');
  }
}); 