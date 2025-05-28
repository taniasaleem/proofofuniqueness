const { app, BrowserWindow, ipcMain } = require('electron');
import path from "path";
import { fileURLToPath } from 'url';
import { isDev } from "./util.js";
import fs from 'fs';
import { p2pService } from './p2p.js';
import { MessageType, type Message } from './preload.js';
import type { IpcMainEvent, WebContents } from 'electron';

// Get the directory path using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAppPath = () => {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname, '..');
};

let mainWindow: typeof BrowserWindow | null = null;
let isP2PInitialized = false;

// Add logging utility
const log = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[Main][${timestamp}] ${message}`, data ? data : '');
};

function createWindow() {
  log('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    }
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details: any, callback: (response: any) => void) => {
    log('Setting Content Security Policy');
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline' https:",
          "img-src 'self' data: https:",
          "font-src 'self' data: https:",
          "connect-src 'self' ws: wss: http: https:"
        ].join('; ')
      }
    });
  });

  // Load the preload script
  const preloadPath = path.join(__dirname, 'preload.js');
  if (fs.existsSync(preloadPath)) {
    log('Preload script found at:', preloadPath);
    const preloadContent = fs.readFileSync(preloadPath, 'utf-8');
    log('Preload script content length:', preloadContent.length);
  } else {
    log('ERROR: Preload script not found at:', preloadPath);
    throw new Error('Preload script not found');
  }

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    log('Loading development URL: http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    log('Loading production build');
    mainWindow.setMenu(null);
    mainWindow.loadFile(path.join(getAppPath(), 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    log('Main window closed');
    mainWindow = null;
  });

  // Wait for P2P service to be ready
  p2pService.on('ready', () => {
    log('P2P service ready event received');
    isP2PInitialized = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      log('Notifying renderer of P2P readiness');
      mainWindow.webContents.send('p2p-ready', {
        type: MessageType.P2P_READY,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Test P2P service integration
  mainWindow.webContents.on('did-finish-load', () => {
    log('Window finished loading');
    if (mainWindow && !mainWindow.isDestroyed()) {
      log('Testing P2P service...', {
        isConnected: p2pService.isConnected(),
        peers: p2pService.getPeers()
      });

      // Only test IPC if P2P is initialized
      if (isP2PInitialized) {
        log('P2P initialized, testing IPC');
        mainWindow.webContents.executeJavaScript(`
          console.log('Testing P2P IPC API...');
          if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.send('p2p-send', {
              type: '${MessageType.TEST}',
              data: { message: 'Hello from renderer!' },
              broadcast: true
            });
            window.electron.ipcRenderer.send('p2p-get-peers', {
              type: '${MessageType.GET_PEERS}'
            });
          } else {
            console.error('Electron API not available in renderer');
          }
        `);
      } else {
        log('Waiting for P2P service to initialize...');
      }
    }
  });

  // Add error handling for renderer process
  mainWindow.webContents.on('render-process-gone', (event: any, details: any) => {
    log('Renderer process crashed:', details);
  });

  // Use the correct event type for process crashes
  mainWindow.webContents.on('did-fail-load', (event: any, errorCode: number, errorDescription: string) => {
    log('Renderer process failed to load:', { errorCode, errorDescription });
  });

  mainWindow.webContents.on('did-fail-provisional-load', (event: any, errorCode: number, errorDescription: string) => {
    log('Renderer process failed provisional load:', { errorCode, errorDescription });
  });

  // Add uncaught exception handler
  process.on('uncaughtException', (error) => {
    log('Uncaught exception:', error);
  });

  // Add unhandled rejection handler
  process.on('unhandledRejection', (reason, promise) => {
    log('Unhandled promise rejection:', { reason, promise });
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// P2P message handlers with timeout
ipcMain.on('p2p-send', async (event: IpcMainEvent, message: Message) => {
  log('Received p2p-send message', message);
  
  try {
    if (!isP2PInitialized) {
      throw new Error('P2P service not initialized');
    }

    if (!message || !message.type) {
      throw new Error('Invalid message format');
    }

    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('P2P operation timeout')), 5000)
    );

    // For broadcast messages, use broadcastMessage
    if (message.broadcast) {
      log('Broadcasting message', message);
      try {
        await Promise.race([
          p2pService.broadcastMessage(message),
          timeout
        ]);
        
        log('Broadcast successful');
        event.reply('p2p-message', {
          type: message.type,
          success: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        log('Error broadcasting message', error);
        event.reply('p2p-error', {
          type: message.type,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // For direct messages, use sendMessage with a specific peer
      if (!message.peerId) {
        throw new Error('Peer ID required for direct messages');
      }
      log('Sending direct message to peer', { peerId: message.peerId, message });
      try {
        await Promise.race([
          p2pService.sendMessage(message.peerId, message),
          timeout
        ]);
        
        log('Direct message sent successfully');
        event.reply('p2p-message', {
          type: message.type,
          success: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        log('Error sending direct message', error);
        event.reply('p2p-error', {
          type: message.type,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    log('Error handling P2P message', error);
    event.reply('p2p-error', {
      type: message?.type,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Handle P2P peer list requests
ipcMain.on('p2p-get-peers', async (event: IpcMainEvent, message: Message) => {
  log('Received p2p-get-peers request', message);
  
  try {
    if (!isP2PInitialized) {
      throw new Error('P2P service not initialized');
    }

    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('P2P operation timeout')), 5000)
    );

    const peers = await Promise.race([
      p2pService.getPeers(),
      timeout
    ]) as string[];

    log('Retrieved peer list', { peerCount: peers.length });
    event.reply('p2p-message', {
      type: MessageType.PEERS_LIST,
      data: peers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log('Error getting peers', error);
    event.reply('p2p-error', {
      type: MessageType.GET_PEERS,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Set up P2P message forwarding to renderer
p2pService.onPeerConnect((peerId: string) => {
  log('Peer connected', { peerId });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('peer-connected', {
      type: MessageType.PEER_CONNECTED,
      peerId,
      timestamp: new Date().toISOString()
    });
  }
});

p2pService.onPeerDisconnect((peerId: string) => {
  log('Peer disconnected', { peerId });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('peer-disconnected', {
      type: MessageType.PEER_DISCONNECTED,
      peerId,
      timestamp: new Date().toISOString()
    });
  }
});
