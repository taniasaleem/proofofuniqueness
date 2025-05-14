const { contextBridge, ipcRenderer } = require('electron');
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

const validSendChannels = ['ws-send', 'ws-get-clients'] as const;
const validReceiveChannels = ['ws-message', 'ws-client-connected', 'ws-client-disconnected', 'ws-clients-list', 'ws-error'] as const;

type ValidSendChannel = typeof validSendChannels[number];
type ValidReceiveChannel = typeof validReceiveChannels[number];

console.log('Preload script starting...');
console.log('Initial window state:', {
  hasElectron: !!window.electron,
  windowKeys: Object.keys(window),
  electronKeys: window.electron ? Object.keys(window.electron) : []
});

try {
  // Expose protected methods that allow the renderer process to use
  // the ipcRenderer without exposing the entire object
  contextBridge.exposeInMainWorld(
    'electron',
    {
      ipcRenderer: {
        send: (channel: string, data: any) => {
          console.log('IPC send called with channel:', channel, 'data:', data);
          
          // Validate data structure
          if (!data) {
            console.error('IPC send called with undefined data');
            return;
          }
          
          if (typeof data !== 'object') {
            console.error('IPC send called with non-object data:', data);
            return;
          }

          // Special handling for WebSocket messages
          if (channel === 'ws-send') {
            // Ensure the message has the required fields
            const message = {
              type: data.type || 'unknown',
              data: data.data || {},
              timestamp: data.timestamp || Date.now(),
              clientId: data.clientId || 'unknown'
            };
            console.log('Sending formatted WebSocket message:', message);
            ipcRenderer.send(channel, message);
            return;
          }

          // For other channels, ensure type is present
          if (!data.type) {
            console.error('IPC send called with data missing type:', data);
            return;
          }

          if (validSendChannels.includes(channel as ValidSendChannel)) {
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
          if (validReceiveChannels.includes(channel as ValidReceiveChannel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (_event: IpcRendererEvent, ...args: any[]) => {
              try {
                console.log('IPC received message:', { channel, args });
                if (!args || args.length === 0) {
                  console.error('IPC received empty message');
                  return;
                }
                
                // Special handling for client list messages
                if (channel === 'ws-clients-list') {
                  const clientList = args[0];
                  if (Array.isArray(clientList)) {
                    console.log('Processing client list:', clientList);
                    func(...args);
                    return;
                  }
                }

                // Special handling for WebSocket messages
                if (channel === 'ws-message') {
                  const message = args[0];
                  if (message && typeof message === 'object') {
                    // Ensure message has required fields
                    const formattedMessage = {
                      type: message.type || 'unknown',
                      data: message.data || {},
                      timestamp: message.timestamp || Date.now(),
                      clientId: message.clientId || 'unknown'
                    };
                    console.log('Processing WebSocket message:', formattedMessage);
                    func(formattedMessage);
                    return;
                  }
                }

                // Validate message structure for other messages
                const message = args[0];
                if (!message || typeof message !== 'object') {
                  console.error('IPC received invalid message structure:', message);
                  return;
                }

                if (!message.type) {
                  console.error('IPC received message missing type:', message);
                  return;
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
          if (validReceiveChannels.includes(channel as ValidReceiveChannel)) {
            console.log('Removing listener for channel:', channel);
            ipcRenderer.removeListener(channel, func);
          } else {
            console.warn(`Attempted to remove listener from unauthorized channel: ${channel}`);
            throw new Error(`Unauthorized channel: ${channel}`);
          }
        }
      }
    }
  );
  console.log('IPC API successfully exposed to renderer process');
  console.log('Post-exposure window state:', {
    hasElectron: !!window.electron,
    windowKeys: Object.keys(window),
    electronKeys: window.electron ? Object.keys(window.electron) : []
  });
} catch (error) {
  console.error('Failed to expose IPC API:', error);
  console.error('Error state window:', {
    hasElectron: !!window.electron,
    windowKeys: Object.keys(window),
    electronKeys: window.electron ? Object.keys(window.electron) : []
  });
}

// Add a test message to verify the preload script is working
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Preload script is working');
  // Verify the API is exposed
  console.log('Electron API available:', !!window.electron);
  console.log('Window state at DOMContentLoaded:', {
    hasElectron: !!window.electron,
    windowKeys: Object.keys(window),
    electronKeys: window.electron ? Object.keys(window.electron) : [],
    electronMethods: window.electron?.ipcRenderer ? Object.keys(window.electron.ipcRenderer) : []
  });
});

// Handle WebSocket messages
ipcRenderer.on('ws-message', (_: Electron.IpcRendererEvent, message: any) => {
    console.log('Received WebSocket message:', message);
    if (!message || typeof message !== 'object') {
        console.error('Invalid WebSocket message:', message);
        return;
    }

    // Format the message with required fields
    const formattedMessage = {
        type: message.type || 'unknown',
        data: message.data || {},
        timestamp: message.timestamp || Date.now(),
        clientId: message.clientId
    };

    console.log('Sending formatted message:', formattedMessage);
    ipcRenderer.send('ws-send', formattedMessage);
}); 