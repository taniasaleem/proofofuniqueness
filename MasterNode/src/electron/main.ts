import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from 'url';
import { isDev } from "./util.js";
import fs from 'fs';
import { p2pService } from './p2p.js';
import { promises as fsPromises } from 'fs';

// Get the directory path using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getPreloadPath = () => {
  // In development, preload.js will be in the same directory as main.js
  // In production, it will be in resources/app/build-electron
  if (app.isPackaged) {
    const preloadPath = path.join(process.resourcesPath, 'app', 'build-electron', 'preload.js');
    console.log('[Main] Production preload path:', preloadPath);
    return preloadPath;
  } else {
    const preloadPath = path.join(__dirname, 'preload.js');
    console.log('[Main] Development preload path:', preloadPath);
    return preloadPath;
  }
};



let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  
  // Get and verify preload script path
  const preloadPath = path.join(__dirname, 'preload.js');
  // preloadPath = getPreloadPath();
  console.log('[Main] Using preload script at:', preloadPath);
  
  try {
    await fsPromises.access(preloadPath);
    console.log('[Main] Preload script found successfully');
  } catch (error) {
    console.error('[Main] Preload script not found:', error);
    console.error('[Main] Current directory:', __dirname);
    console.error('[Main] Is packaged:', app.isPackaged);
    throw new Error('Preload script not found');
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: true
    }
  });


  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline' https:",
          "style-src-elem 'self' 'unsafe-inline' https: data:",
          "font-src 'self' data: https:",
          "img-src 'self' data: https:",
          "connect-src 'self' ws: wss: http: https:"
        ].join('; ')
      }
    });
  });


  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // Use app.getAppPath() to get the correct path in production
    const indexPath = path.join(app.getAppPath(), 'build-react', 'index.html');
    await mainWindow.loadFile(indexPath);
      // open dev tools for debugging 
    // mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Test P2P service integration
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      console.log('Testing P2P service...');
      console.log('P2P service connected:', p2pService.isConnected());
      console.log('Current peers:', p2pService.getPeers());

      // Test IPC communication with P2P
      // mainWindow.webContents.executeJavaScript(`
      //   console.log('Testing P2P IPC API...');
      //   if (window.electron?.ipcRenderer) {
      //     window.electron.ipcRenderer.send('p2p-send', {
      //       type: 'test-message',
      //       data: { message: 'Hello from renderer!' }
      //     });
      //     window.electron.ipcRenderer.send('p2p-get-peers');
      //   } else {
      //     console.error('Electron API not available in renderer');
      //   }
      // `);
    }
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

// Add debug logging function
const debugLog = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data ? data : '');
};

// P2P message handlers
ipcMain.on('p2p-send', async (event, message) => {
  try {
    debugLog('Received P2P send request:', message);

    if (!message || !message.type) {
      throw new Error('Invalid message format');
    }

    // Forward the message to the P2P service
    await p2pService.broadcastMessage(message);
    
    // Send the response back to the renderer
    const response = {
      type: message.type,
      success: true,
      data: { message: 'Message broadcast successfully' },
      timestamp: new Date().toISOString()
    };
    debugLog('Sending P2P response:', response);
    event.reply('p2p-message', response);
  } catch (error) {
    debugLog('Error handling P2P message:', error);
    const errorResponse = {
      type: message?.type || 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
    debugLog('Sending P2P error response:', errorResponse);
    event.reply('p2p-error', errorResponse);
  }
});

ipcMain.on('p2p-get-peers', async (event) => {
  try {
    debugLog('Received get-peers request');
    const peers = p2pService.getPeers();
    const response = {
      type: 'peers-response',
      success: true,
      data: peers,
      timestamp: new Date().toISOString()
    };
    debugLog('Sending peers response:', response);
    event.reply('p2p-message', response);
  } catch (error) {
    debugLog('Error getting peers:', error);
    const errorResponse = {
      type: 'peers-response',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
    debugLog('Sending peers error response:', errorResponse);
    event.reply('p2p-error', errorResponse);
  }
});

// Set up P2P message forwarding to renderer
p2pService.onPeerConnect((peerId: string) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const message = {
      type: 'peer-connected',
      success: true,
      data: {
        peerId,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    debugLog('Peer connected:', message);
    mainWindow.webContents.send('p2p-message', message);
  }
});

p2pService.onPeerDisconnect((peerId: string) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const message = {
      type: 'peer-disconnected',
      success: true,
      data: {
        peerId,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
    debugLog('Peer disconnected:', message);
    mainWindow.webContents.send('p2p-message', message);
  }
});
