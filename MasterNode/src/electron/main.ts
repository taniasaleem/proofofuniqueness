import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from 'url';
import { isDev } from "./util.js";
import fs from 'fs';
import { p2pService } from './p2p.js';

// Get the directory path using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAppPath = () => {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname, '..');
};

let mainWindow: BrowserWindow | null = null;

function createWindow() {
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
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "connect-src 'self' ws: wss: http: https:"
        ].join('; ')
      }
    });
  });

  // Load the preload script
  const preloadPath = path.join(__dirname, 'preload.js');
  if (fs.existsSync(preloadPath)) {
    console.log('Preload script found at:', preloadPath);
    const preloadContent = fs.readFileSync(preloadPath, 'utf-8');
    console.log('Preload script content:', preloadContent);
  } else {
    console.error('Preload script not found at:', preloadPath);
  }

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.setMenu(null);
    mainWindow.loadFile(path.join(getAppPath(), 'dist', 'index.html'));
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
      mainWindow.webContents.executeJavaScript(`
        console.log('Testing P2P IPC API...');
        if (window.electron?.ipcRenderer) {
          window.electron.ipcRenderer.send('p2p-send', {
            type: 'test-message',
            data: { message: 'Hello from renderer!' }
          });
          window.electron.ipcRenderer.send('p2p-get-peers');
        } else {
          console.error('Electron API not available in renderer');
        }
      `);
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

// P2P message handlers
ipcMain.on('p2p-send', async (event, message) => {
  try {
    if (!message || !message.type) {
      throw new Error('Invalid message format');
    }

    // Forward the message to the P2P service
    const response = await p2pService.sendMessage(message.type, message.data);
    
    // Send the response back to the renderer
    event.reply('p2p-message', {
      type: message.type,
      data: response
    });
  } catch (error) {
    console.error('Error handling P2P message:', error);
    event.reply('p2p-error', {
      type: message?.type,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

ipcMain.on('p2p-get-peers', async (event) => {
  try {
    const peers = await p2pService.getPeers();
    event.reply('p2p-message', {
      type: 'peers-response',
      data: peers
    });
  } catch (error) {
    console.error('Error getting peers:', error);
    event.reply('p2p-error', {
      type: 'peers-response',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Set up P2P message forwarding to renderer
p2pService.onPeerConnect((peerId: string) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('p2p-message', {
      type: 'peer-connected',
      data: {
        peerId,
        timestamp: new Date().toISOString()
      }
    });
  }
});

p2pService.onPeerDisconnect((peerId: string) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('p2p-message', {
      type: 'peer-disconnected',
      data: {
        peerId,
        timestamp: new Date().toISOString()
      }
    });
  }
});
