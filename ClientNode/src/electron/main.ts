import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from 'url';
import { isDev } from "./util.js";
import { P2PService } from "./p2pService.js";
import { promises as fs } from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[Main] Starting main process');
console.log('[Main] Current directory:', __dirname);

let mainWindow: BrowserWindow | null = null;
let p2pService: P2PService | null = null;

async function createWindow() {
  console.log('[Main] Creating main window');
  
  // Ensure the preload script exists
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[Main] Preload script path:', preloadPath);
  
  try {
    await fs.access(preloadPath);
  } catch (error) {
    console.error('[Main] Preload script not found:', error);
    throw new Error('Preload script not found');
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      sandbox: false,
      preload: preloadPath,
      webSecurity: true,
      allowRunningInsecureContent: false,
      nodeIntegrationInWorker: true
    }
  });

  // Initialize P2P service
  try {
    console.log('[Main] Initializing P2P service');
    p2pService = new P2PService();
    await p2pService.initialize();
    console.log('[Main] P2P service initialization completed');
  } catch (error) {
    console.error('[Main] Failed to initialize P2P service:', error);
    mainWindow?.webContents.send('p2p:error', { 
      message: 'Failed to initialize P2P service. Some features may be limited.' 
    });
  }

  // Set up IPC handlers
  console.log('[Main] Setting up IPC handlers');
  setupIpcHandlers();

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    try {
      console.log('[Main] Loading development server');
      const port = process.env.VITE_DEV_SERVER_PORT || '3001';
      await mainWindow.loadURL(`http://localhost:${port}`);
      console.log('[Main] Development server loaded successfully');
      // open dev tools for debugging
      mainWindow.webContents.openDevTools();
    } catch (error) {
      console.error('[Main] Failed to load development server:', error);
      await mainWindow.loadFile(path.join(__dirname, '../index.html'));
    }
  } else {
    console.log('[Main] Loading production build');
    // Use app.getAppPath() to get the correct path in production
    const indexPath = path.join(app.getAppPath(), 'build-react', 'index.html');
    await mainWindow.loadFile(indexPath);
      // open dev tools for debugging 
    // mainWindow.webContents.openDevTools();
  }
}

function setupIpcHandlers() {
  console.log('[Main] Setting up IPC handlers');
  if (!p2pService) {
    console.error('[Main] P2P service not initialized');
    return;
  }

  const service = p2pService;

  // Connection handlers
  ipcMain.handle('p2p:connect', async () => {
    console.log('[Main] Handling p2p:connect request');
    try {
      if (service.isConnected()) {
        console.log('[Main] Already connected to P2P network');
        return true;
      }

      if (!service.isInitialized()) {
        console.log('[Main] Initializing P2P service before connection');
        await service.initialize();
      }

      console.log('[Main] Starting connection attempts');
      service.startConnectionAttempts();
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      mainWindow?.webContents.send('p2p:error', { message: errorMessage });
      throw error;
    }
  });

  ipcMain.handle('p2p:disconnect', async () => {
    try {
      if (!service.isConnected()) {
        console.log('[Main] Already disconnected from P2P network');
        return true;
      }
      await service.stop();
      mainWindow?.webContents.send('p2p:disconnected');
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      mainWindow?.webContents.send('p2p:error', { message: errorMessage });
      throw error;
    }
  });

  // Status handlers
  ipcMain.handle('p2p:get-status', async () => {
    console.log('[Main] Handling p2p:get-status request');
    try {
      const isConnected = service.isConnected();
      const isInitialized = service.isInitialized();
      console.log('[Main] P2P status:', { isConnected, isInitialized });
      return { isConnected, isInitialized };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[Main] Error getting P2P status:', errorMessage);
      mainWindow?.webContents.send('p2p:error', { message: errorMessage });
      throw error;
    }
  });

  ipcMain.handle('p2p:get-node-info', async () => {
    try {
      const nodeInfo = await service.getNodeInfo();
      return nodeInfo;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      mainWindow?.webContents.send('p2p:error', { message: errorMessage });
      throw error;
    }
  });

  // Message handlers
  ipcMain.handle('p2p:send-message', async (_, message: { type: string; data: any }) => {
    try {
      if (!service.isConnected()) {
        throw new Error('Cannot send message: P2P service is not connected to master node');
      }
      await service.handleMessage(message.type, message.data);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      mainWindow?.webContents.send('p2p:error', { message: errorMessage });
      throw error;
    }
  });

  // Peer list handlers
  ipcMain.handle('p2p:get-peers', async () => {
    try {
      console.log('[Main] Handling get peers request');
      if (!service.isConnected()) {
        console.log('[Main] Cannot get peers: not connected to master node');
        return [];
      }
      const peers = await service.getPeers();
      console.log('[Main] Retrieved peers:', peers);
      return peers;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[Main] Error getting peers:', errorMessage);
      mainWindow?.webContents.send('p2p:error', { message: errorMessage });
      throw error;
    }
  });
}

app.whenReady().then(() => {
  console.log('[Main] App is ready, creating window');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('[Main] All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('[Main] App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  console.log('[Main] App quitting, cleaning up P2P service');
  if (p2pService) {
    await p2pService.stop();
  }
});
