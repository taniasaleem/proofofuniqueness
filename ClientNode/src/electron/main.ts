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
const MAX_P2P_RETRIES = 5;
let p2pRetryCount = 0;

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
    p2pRetryCount = 0; // Reset retry count on successful initialization
    console.log('[Main] P2P service initialized successfully');
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
      await mainWindow.loadURL('http://localhost:3001');
      mainWindow.webContents.openDevTools();
      console.log('[Main] Development server loaded successfully');
    } catch (error) {
      console.error('[Main] Failed to load development server:', error);
      // Fallback to production build if dev server is not available
      console.log('[Main] Falling back to production build');
      await mainWindow.loadFile(path.join(__dirname, '../index.html'));
    }
  } else {
    console.log('[Main] Loading production build');
    await mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }

  // Handle window errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Main] Window failed to load:', errorCode, errorDescription);
  });

  mainWindow.on('unresponsive', () => {
    console.error('[Main] Window became unresponsive');
  });

  // Handle renderer process crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Main] Renderer process crashed:', details);
  });
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
      if (p2pRetryCount >= MAX_P2P_RETRIES) {
        console.error('[Main] Maximum P2P connection retries exceeded');
        throw new Error('Maximum P2P connection retries exceeded');
      }

      await service.initialize();
      p2pRetryCount = 0; // Reset retry count on successful connection
      mainWindow?.webContents.send('p2p:connected');
      console.log('[Main] P2P connection established');
      return true;
    } catch (error: unknown) {
      p2pRetryCount++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[Main] P2P connection error:', errorMessage);
      mainWindow?.webContents.send('p2p:error', { 
        message: errorMessage,
        retryCount: p2pRetryCount,
        maxRetries: MAX_P2P_RETRIES
      });
      throw error;
    }
  });

  ipcMain.handle('p2p:disconnect', async () => {
    try {
      await service.stop();
      p2pRetryCount = 0; // Reset retry count on disconnect
      mainWindow?.webContents.send('p2p:disconnected');
      return true;
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
        throw new Error('P2P service is not connected');
      }
      await service.handleMessage(message.type, message.data);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      mainWindow?.webContents.send('p2p:error', { message: errorMessage });
      throw error;
    }
  });

  ipcMain.handle('p2p:get-node-info', async () => {
    try {
      if (!service.isConnected()) {
        throw new Error('P2P service is not connected');
      }
      const nodeInfo = await service.getNodeInfo();
      return nodeInfo;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      mainWindow?.webContents.send('p2p:error', { message: errorMessage });
      throw error;
    }
  });

  ipcMain.handle('p2p:get-peers', async () => {
    try {
      if (!service.isConnected()) {
        throw new Error('P2P service is not connected');
      }
      const peers = await service.getPeers();
      return peers;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
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
